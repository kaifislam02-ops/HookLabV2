export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'Server not configured. Contact support.' });
  }

  try {
    const { topic, platform, tone, language } = req.body;

    if (!topic || !platform || !tone || !language) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Rate limit: basic IP-based (Vercel provides x-forwarded-for)
    // For now just pass through — can add Redis rate limiting later

    const platformTone = {
      'YouTube':    'engaging, watch-time optimized, conversational',
      'Instagram':  'visual, emotional, punchy and personal',
      'Twitter / X':'concise and punchy, under 280 characters ideally',
      'LinkedIn':   'professional yet engaging, insight-driven',
    }[platform] || 'engaging';

    const toneGuide = {
      'Funny':         'Use humour, wit, and a lighthearted voice. Make people laugh or smile.',
      'Serious':       'Be direct, no-nonsense, and authoritative. Every word counts.',
      'Inspirational': 'Be uplifting, motivational, and emotionally charged. Make people feel something.',
      'Educational':   'Be clear, informative, and insightful. Lead with a surprising fact or insight.',
    }[tone] || 'engaging';

    const langGuide = {
      'English':  'Write entirely in English.',
      'Hindi':    'Write entirely in Hindi (Devanagari script).',
      'Hinglish': 'Write in Hinglish — a natural mix of Hindi and English as used by Indian creators on Instagram.',
      'Urdu':     'Write entirely in Urdu (Nastaliq script).',
    }[language] || 'Write in English.';

    const prompt = `You are an expert content creator and viral copywriter specialising in ${platform} content.

Generate exactly 5 scroll-stopping hooks for:

TOPIC: "${topic}"
PLATFORM: ${platform} (${platformTone})
TONE: ${tone} — ${toneGuide}
LANGUAGE: ${langGuide}

Write one hook for each style:
1. SHOCK - A shocking fact or stat that stops people mid-scroll
2. QUESTION - A question they absolutely must know the answer to
3. STORY - A first-person story opener with immediate emotional pull
4. BOLD - A confident statement that challenges conventional wisdom
5. CURIOSITY - Creates an irresistible information gap they must close

Rules:
- 1-3 sentences max per hook
- Be SPECIFIC to the topic, never generic
- Match the tone and language strictly
- No quotation marks, no numbering, no labels
- Make them feel fresh and different from each other

Return ONLY this JSON, nothing else:
{
  "shock": "...",
  "question": "...",
  "story": "...",
  "bold": "...",
  "curiosity": "..."
}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.92,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content: 'You are a viral content hook writer. Always respond with valid JSON only — no markdown, no explanation, just the raw JSON object.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({ error: err.error?.message || 'AI service error' });
    }

    const data = await groqRes.json();
    const raw  = data.choices?.[0]?.message?.content?.trim();

    if (!raw) return res.status(500).json({ error: 'Empty response from AI. Try again.' });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse AI response. Try again.' });

    const hooks = JSON.parse(jsonMatch[0]);

    return res.status(200).json({ hooks });

  } catch (err) {
    console.error('Hook generation error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
