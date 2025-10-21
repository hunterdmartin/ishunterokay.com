import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function handler(event) {
  // Minimal CORS for local dev and production on your domain
  const cors = {
    "Access-Control-Allow-Origin": "https://ishunterokay.com",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors };
  }

  try {
    const params = new URLSearchParams(event.rawQuery || "");
    const weather = params.get("weather") || "sunny";
    const spotify = params.get("spotify") || "Synthwave";
    const sleep   = params.get("sleep")   || "7h";

    const prompt = `Give a playful one-line "vibe check" for Hunter using:
    Weather: ${weather}
    Spotify: ${spotify}
    Sleep: ${sleep}
    Keep it short, upbeat, and witty.`;

    const out = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const vibe = out.choices?.[0]?.message?.content?.trim() || "Vibes pending…";

    return { statusCode: 200, headers: cors, body: JSON.stringify({ vibe }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String(e) }) };
  }
}
