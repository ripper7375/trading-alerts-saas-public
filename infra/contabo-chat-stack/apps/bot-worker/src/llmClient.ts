import { SYSTEM_PROMPT } from './systemPrompt';

const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-1.5-flash';
const LLM_API_KEY = process.env.LLM_API_KEY;
const REQUEST_TIMEOUT_MS = 15_000;

if (!LLM_API_KEY) {
  throw new Error(
    'LLM_API_KEY is not set — bot worker cannot call the LLM provider.'
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(userText: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_MODEL}:generateContent?key=${LLM_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini API returned no text');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function callClaude(userText: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': LLM_API_KEY as string,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text;
    if (!text) throw new Error('Claude API returned no text');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function getLlmReply(userText: string): Promise<string> {
  const call =
    LLM_PROVIDER === 'claude' ? callClaude(userText) : callGemini(userText);
  return withTimeout(call, REQUEST_TIMEOUT_MS + 2_000);
}
