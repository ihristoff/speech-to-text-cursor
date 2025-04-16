import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function summarizeWithGemini(text: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key not set');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `Summarize the following transcript in 200-300 words, capturing the main topics, key points, and conclusions.\n\n${text}`
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (err: any) {
    if (err.response) {
      console.error('Gemini API error:', err.response.data);
      throw new Error(`Gemini API error: ${err.response.status} ${JSON.stringify(err.response.data)}`);
    }
    throw new Error('Gemini API request failed: ' + err.message);
  }
} 