// generate_status.mjs
// Build-time status generator for ishunterokay.com
// - Calls OpenAI once during build
// - Writes a short, varied status line to status.json
// - Safe for static hosting (GitHub Pages) and fine on Netlify

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Node 18+ has global fetch. If you're on older Node, add:  import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------ Config ------------
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini";
const TEMPERATURE = 1.3;      // bump a bit for more variety
const TOP_P = 0.9;
const MAX_TOKENS = 90;

// Where to write status.json (prefer /public)
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, "public"))
  ? path.join(__dirname, "public")
  : __dirname;

const OUTFILE = path.join(PUBLIC_DIR, "status.json");

// ------------ Helpers ------------
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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

// ------------ Prompt generation for high variety ------------
const THEMES = {
  weather: [
    "Write today's forecast for Hunter's emotional climate.",
    "If Hunter's mood were a weather system, describe it.",
    "Report live from the skies over Hunter's inner world."
  ],
  fantasy: [
    "As if in a D&D campaign, narrate Hunter's current quest or condition.",
    "Describe Hunter's vibe as though it were a magical aura or spell effect.",
    "Tell me Hunter's alignment and current hit points in a dramatic tone."
  ],
  space: [
    "Transmit a mission log update from Hunter aboard a retro spacecraft.",
    "As a cosmic radio DJ, broadcast Hunter's current vibe to the galaxy.",
    "Describe Hunter’s emotional state as a distant celestial event."
  ],
  corporate: [
    "Write a fake Slack status that subtly reveals Hunter's mood.",
    "Summarize Hunter's day in the style of a quarterly report headline.",
    "Generate a faux meeting note about Hunter's wellbeing metrics."
  ],
  surreal: [
    "Describe Hunter’s day as a dream sequence directed by David Lynch.",
    "If Hunter were a color or sound today, what would it be?",
    "Write a tiny absurdist story about Hunter’s current vibe."
  ],
  haiku: [
    "Express Hunter's current energy as a three-line haiku.",
    "Write a short poem about Hunter’s status in 17 syllables.",
    "Render Hunter’s vibe as an elegant minimalist haiku."
  ]
};

const SEEDS = [
  "synthwave","coffee","time travel","mushrooms","data cloud","seagull",
  "retro arcade","tacos","moonlight","404 error","bike ride","armadillo",
  "quantum disco"
];

const PREFIXES = ["✅","🪩","🧭","🌤️","✨","🛰️","🍩","🐉","🎸","📡","💾","🦦"];
const SUFFIXES = [
  "— carry on.","— vibes intact.","— probably fine.","— onward.",
  "— status nominal.","— questionable but acceptable.","— cosmic alignment achieved."
];

async function main() {
  // If no key, write a safe fallback and exit gracefully
  if (!API_KEY) {
    const fallback = {
      message: "🪩 Hunter appears okay — vibes intact.",
      updated_at: new Date().toISOString()
    };
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    fs.writeFileSync(OUTFILE, JSON.stringify(fallback, null, 2));
    console.warn("[generate_status] OPENAI_API_KEY missing; wrote fallback status.json");
    return;
    }

  const themeKey = pick(Object.keys(THEMES));
  const basePrompt = pick(THEMES[themeKey]);
  const seedWord = pick(SEEDS);

  const constraint =
    "Use ≤ 35 words, be playful, non-repetitive, no health talk. " +
    "Inspire from the word '" + seedWord + "'. Avoid reusing sentence patterns. Surprise me.";

  const userPrompt = `${basePrompt}\n\n${constraint}`;
  const seed = Math.floor(Math.random() * 1e9);

  const payload = {
    model: MODEL,
    temperature: TEMPERATURE,
    top_p: TOP_P,
    max_tokens: MAX_TOKENS,
    seed,
    messages: [
      { role: "system", content: "You craft short, varied, delightful status lines with high novelty. Each response must feel different in tone and structure." },
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

  const out = { message: final, updated_at: new Date().toISOString() };

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(OUTFILE, JSON.stringify(out, null, 2));
  console.log(`[generate_status] Wrote ${OUTFILE}\n${JSON.stringify(out, null, 2)}`);
}

main().catch(err => {
  console.error("[generate_status] Failed:", err);
  process.exitCode = 1;
});
