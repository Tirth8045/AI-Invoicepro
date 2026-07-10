const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_MODEL ||'openai/gpt-oss-20b';
const TIMEOUT_MS = 20000;

const RETRYABLE_STATUS = new Set([401, 403, 429, 500, 502, 503, 504]);

function getKeys() {
  return [
    { label: 'Primary key', value: process.env.GROQ_PRIMARY_KEY },
    { label: 'Fallback key 1', value: process.env.GROQ_FALLBACK_KEY_1 },
    { label: 'Fallback key 2', value: process.env.GROQ_FALLBACK_KEY_2 },
  ].filter((k) => k.value);
}

async function callWithKey(key, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = new Error(`Groq responded with ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Groq returned an empty response');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function aiCall(prompt) {
  const keys = getKeys();

  if (keys.length === 0) {
    console.warn('[aiService] No Groq keys configured.');
    return null;
  }

  for (let i = 0; i < keys.length; i++) {
    const { label, value } = keys[i];
    try {
      const result = await callWithKey(value, prompt);
      if (i > 0) console.log(`[aiService] ${label} succeeded.`);
      return result;
    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      const reason = isTimeout ? 'timeout' : err.status || err.message;
      console.warn(`[aiService] ${label} failed (${reason}).`);

      const shouldRetryNext =
        isTimeout || err.status === undefined || RETRYABLE_STATUS.has(err.status);

      if (!shouldRetryNext) return null;

      if (i < keys.length - 1) {
        console.log(`[aiService] Trying ${keys[i + 1].label.toLowerCase()}...`);
      }
    }
  }

  console.warn('[aiService] All Groq keys failed.');
  return null;
}

module.exports = { aiCall };