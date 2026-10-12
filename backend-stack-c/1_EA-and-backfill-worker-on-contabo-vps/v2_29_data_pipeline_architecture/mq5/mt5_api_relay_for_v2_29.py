import asyncio
import aiohttp
import json
import logging
import os

# Configuration matching the API Gateway
RAILWAY_URL = "https://your-api.railway.app/api/v1/market-data"
API_KEY = "YOUR_API_KEY_HERE"
LOCAL_PORT = 5555

# Reliability configuration
WORKER_COUNT = 4                    # Concurrent uploads to Railway
QUEUE_MAX_SIZE = 10000              # In-memory payload buffer
MAX_RETRIES = 5                     # POST attempts per payload before spilling to disk
RETRY_BACKOFF_BASE = 2              # Backoff: 2s, 4s, 8s, 16s between retries
SPILL_FILE = "relay_spill_queue.jsonl"  # Payloads that exhausted retries (replayed later)
SPILL_REPLAY_INTERVAL = 60          # Seconds between spill-file replay attempts

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

# Serializes spill-file access between workers and the replay task
spill_lock = asyncio.Lock()


async def spill_to_disk(payload_str):
    """Persist a payload that could not be delivered so it survives restarts."""
    async with spill_lock:
        with open(SPILL_FILE, "a", encoding="utf-8") as f:
            f.write(payload_str + "\n")
    logging.warning("Payload spilled to disk for later replay")


async def send_to_railway(session, payload_str):
    """POST one payload to Railway with retries. Returns True on success.

    4xx responses (except 429) are treated as permanent rejections: the data
    itself is invalid, so retrying or spilling would loop forever.
    """
    try:
        data = json.loads(payload_str)
    except json.JSONDecodeError as e:
        logging.error(f"Dropping malformed JSON from EA: {e}")
        return True  # Nothing recoverable — treat as handled

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "X-Terminal-ID": data.get("terminal_id", "unknown"),
        "X-EA-Version": "v2.29-ASYNC"
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            async with session.post(RAILWAY_URL, headers=headers, json=data, timeout=5) as response:
                if response.status in (200, 201):
                    return True
                if 400 <= response.status < 500 and response.status != 429:
                    body = await response.text()
                    logging.error(f"Railway rejected payload permanently ({response.status}): {body[:300]}")
                    return True  # Permanent rejection — do not retry/spill
                logging.warning(f"Railway returned {response.status} (attempt {attempt}/{MAX_RETRIES})")
        except Exception as e:
            logging.warning(f"POST failed (attempt {attempt}/{MAX_RETRIES}): {e}")

        if attempt < MAX_RETRIES:
            await asyncio.sleep(RETRY_BACKOFF_BASE ** attempt)

    return False


async def upload_worker(session, queue):
    """Drain the queue; spill payloads that exhaust their retries."""
    while True:
        payload_str = await queue.get()
        try:
            delivered = await send_to_railway(session, payload_str)
            if not delivered:
                await spill_to_disk(payload_str)
        finally:
            queue.task_done()


async def replay_spill_file(queue):
    """Periodically re-enqueue spilled payloads once there is queue capacity."""
    while True:
        await asyncio.sleep(SPILL_REPLAY_INTERVAL)
        async with spill_lock:
            if not os.path.exists(SPILL_FILE) or os.path.getsize(SPILL_FILE) == 0:
                continue
            with open(SPILL_FILE, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]

            requeued = 0
            for line in lines:
                if queue.full():
                    break
                queue.put_nowait(line)
                requeued += 1

            remaining = lines[requeued:]
            with open(SPILL_FILE, "w", encoding="utf-8") as f:
                for line in remaining:
                    f.write(line + "\n")

        if requeued:
            logging.info(f"Replayed {requeued} spilled payload(s); {len(remaining)} still on disk")


async def handle_mt5_client(reader, writer, queue):
    # MT5 sends one payload then closes, so read until EOF — a fixed-size
    # read() can return a partial TCP segment and produce broken JSON.
    data = await reader.read(-1)
    payload = data.decode('utf-8').strip()

    # Immediately close connection so the MT5 thread resumes instantly
    writer.close()
    await writer.wait_closed()

    if not payload:
        return

    try:
        queue.put_nowait(payload)
    except asyncio.QueueFull:
        # Railway has been down long enough to fill the buffer — persist instead of dropping
        await spill_to_disk(payload)


async def main():
    queue = asyncio.Queue(maxsize=QUEUE_MAX_SIZE)

    async with aiohttp.ClientSession() as session:
        workers = [asyncio.create_task(upload_worker(session, queue)) for _ in range(WORKER_COUNT)]
        replayer = asyncio.create_task(replay_spill_file(queue))

        server = await asyncio.start_server(
            lambda r, w: handle_mt5_client(r, w, queue),
            '127.0.0.1',
            LOCAL_PORT
        )
        logging.info(f"🚀 MQL5 Local Relay listening on 127.0.0.1:{LOCAL_PORT} "
                     f"({WORKER_COUNT} workers, queue={QUEUE_MAX_SIZE}, spill={SPILL_FILE})")
        async with server:
            await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
