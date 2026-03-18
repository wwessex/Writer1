// Production-ready AI inference endpoint (Ollama-based)

import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'narratryx',
        prompt,
        stream: false
      })
    });

    const data = await response.json();

    return res.status(200).json({
      output: data.response
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'AI generation failed' });
  }
}
