// Vercel Function: POST /api/chat
// Server-side only: OPENROUTER_API_KEY must be set in Vercel Environment Variables.

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'Desuka AI chat API' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENROUTER_API_KEY is missing. Add it to Vercel → Settings → Environment Variables, then redeploy.'
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON request body.' });
    }
  }

  const personality = typeof body?.personality === 'string'
    ? body.personality.trim()
    : '';

  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages) {
    return res.status(400).json({ error: 'Missing messages array.' });
  }

  const safeMessages = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 12000)
    }))
    .slice(-20);

  if (safeMessages.length === 0) {
    return res.status(400).json({ error: 'No valid chat messages were provided.' });
  }

  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b:free';

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://desuka-ai.vercel.app',
        'X-OpenRouter-Title': 'Desuka AI'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: personality || 'You are a helpful assistant.'
          },
          ...safeMessages
        ],
        temperature: 0.7
      })
    });

    const raw = await upstream.text();
    let data = null;

    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      console.error('OpenRouter returned non-JSON:', raw.slice(0, 1000));
      return res.status(502).json({
        error: `OpenRouter returned an invalid response (HTTP ${upstream.status}).`
      });
    }

    if (!upstream.ok) {
      console.error('OpenRouter error:', upstream.status, data);
      return res.status(upstream.status).json({
        error: data?.error?.message || `OpenRouter request failed (HTTP ${upstream.status}).`,
        code: data?.error?.code || upstream.status
      });
    }

    const reply = data?.choices?.[0]?.message?.content;

    if (typeof reply !== 'string' || !reply.trim()) {
      console.error('OpenRouter response had no message:', data);
      return res.status(502).json({
        error: 'OpenRouter returned no assistant message.'
      });
    }

    return res.status(200).json({
      reply: reply.trim(),
      model: data?.model || model
    });
  } catch (err) {
    console.error('Chat function error:', err);
    return res.status(500).json({
      error: `Could not reach OpenRouter: ${err?.message || 'Unknown error'}`
    });
  }
}
