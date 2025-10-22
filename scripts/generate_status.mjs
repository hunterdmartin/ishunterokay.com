// generate_status.mjs
// Build-time status generator for ishunterokay.com
// - Calls OpenAI once during build
// - Writes a short, varied status line to status.json
// - Safe for static hosting (GitHub Pages) and works fine on Netlify too

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------ Config ------------
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini";           // fast, creative
const TEMPERATURE = 1.2;               // more novelty
const TOP_P = 0.85;
const MAX_TOKENS = 80;

// Where to write status.json:
// If /public exists, prefer /public/status.json (Next/Vite style).
// Else write to project root /status.json (works for static hosts).
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, "public"))
  ? path.join(__dirname, "public")
  : __dirname;

const OUTFILE = path.join(PUBLIC_DIR, "status.json");

// ------------ Style rotation ------------
const STYLES = [
  "Write a tiny weather report for Hunter’s mood. Include one emoji.",
  "Write a faux news headline about Hunter’s wellbeing. Keep it playful.",
  "Write a fortune-cookie style line about Hunter right now.",
  "Describe Hunter’s vibe as if narrating a nature documentary.",
  "Write a cryptic logline for a movie trailer starring Hunter’s current mood.",
  "Write a whimsical haiku about Hunter’s status.",
  "Write a supportive coach’s sideline quote about Hunter’s day."
];

const INSPIRATIONS = [
  "rainbow", "noodles", "asteroid", "ferret",
  "traffic cone", "thunder", "cinnamon"
];

const PREFIXES = ["✅", "🪩", "🧭", "🌤️", "✨", "🛰️"];
const SUFFIXES = ["— carry on.", "— vibes intact.", "— so it is.", "— probably fine.", "— onward.", "— noted."];

// Small helper to pick a random item
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Optional: retries for transient network hiccups
async function withRetries(fn, { tries = 3, delayMs = 700 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (i < tries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function main() {
  if (!API_KEY) {
    console.warn("[generate_status] Missing OPENAI_API_KEY; writing a fallback status.json.");
    const fallback = {
      message: "🪩 Hunter appears okay — vibes intact.",
      updated_at: new Date().toISOString()
    };
    fs.writeFileSync(OUTFILE, JSON.stringify(fallback, null, 2));
    console.log(`[generate_status] Wrote fallback ${OUTFILE}`);
    return;
  }

  const style = pick(STYLES);
  const inspiration = pick(INSPIRATIONS);
  const seed = Math.floor(Math.random() * 1e9); // some models honor this

  const userPrompt =
    `${style}\nConstraints: ≤ 28 words, family-friendly, no health claims, no instructions. ` +
    `Inspire using the word "${inspiration}". Avoid repeating common phrasings.`;

  const payload = {
    model: MODEL,
    temperature: TEMPERATURE,
    top_p: TOP_P,
    max_tokens: MAX_TOKENS,
    seed,
    messages: [
      { role: "system", content: "You craft short, varied, delightful status lines with high novelty." },
      { role: "user", content: userPrompt }
    ]
  };

  const data = await withRetries(async () => {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`OpenAI error ${resp.status}: ${text}`);
    }
    return resp.json();
  });

  const content = data?.choices?.[0]?.message?.content?.trim() || "Hunter is… ineffably okay.";
  const final = `${pick(PREFIXES)} ${content} ${pick(SUFFIXES)}`.replace(/\s+/g, " ").trim();

  const out = {
    message: final,
    updated_at: new Date().toISOString()
  };

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(OUTFILE, JSON.stringify(out, null, 2));
  console.log(`[generate_status] Wrote ${OUTFILE}\n${JSON.stringify(out, null, 2)}`);
}

main().catch(err => {
  console.error("[generate_status] Failed:", err);
  process.exitCode = 1;
});
