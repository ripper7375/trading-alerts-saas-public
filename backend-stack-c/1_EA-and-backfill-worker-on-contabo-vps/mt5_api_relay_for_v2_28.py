import asyncio
import aiohttp
import json
import logging

# Configuration matching the API Gateway
RAILWAY_URL = "https://your-api.railway.app/api/v1/market-data"
API_KEY = "YOUR_API_KEY_HERE"
LOCAL_PORT = 5555

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

async def send_to_railway(session, payload_str):
    try:
        data = json.loads(payload_str)
        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "X-Terminal-ID": data.get("terminal_id", "unknown"),
            "X-EA-Version": "v2.28-ASYNC"
        }
        
        # This handles the heavy internet latency asynchronously 
        async with session.post(RAILWAY_URL, headers=headers, json=data, timeout=5) as response:
            if response.status not in (200, 201):
                logging.error(f"Railway rejected payload: {response.status}")
    except Exception as e:
        logging.error(f"Failed to forward: {str(e)}")

async def handle_mt5_client(reader, writer, session):
    # MT5 connects and sends data
    data = await reader.read(8192)
    payload = data.decode('utf-8').strip()
    
    # Immediately close connection so MT5 thread resumes instantly
    writer.close()
    await writer.wait_closed()

    if payload:
        # Spawn background task to push to Railway
        asyncio.create_task(send_to_railway(session, payload))

async def main():
    async with aiohttp.ClientSession() as session:
        server = await asyncio.start_server(
            lambda r, w: handle_mt5_client(r, w, session), 
            '127.0.0.1', 
            LOCAL_PORT
        )
        logging.info(f"🚀 MQL5 Local Relay listening on 127.0.0.1:{LOCAL_PORT}")
        async with server:
            await server.serve_forever()

if __name__ == "__main__":
    asyncio.run(main())