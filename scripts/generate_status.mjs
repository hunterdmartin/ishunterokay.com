import fs from "node:fs/promises";
import https from "node:https";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const LAT = process.env.LAT || "39.7392";
const LON = process.env.LON || "-75.5398";

// --- helpers ---
async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve(JSON.parse(d)); } catch (e) { resolve(null); }
        });
      })
      .on("error", reject);
  });
}

function clamp(n, lo, hi, def) {
  const v = Number(n);
  if (Number.isFinite(v)) return Math.max(lo, Math.min(hi, v));
  return def;
}

function toHex(x, fallback = "#ffd23f") {
  if (!x) return fallback;
  const t = x.trim().replace("#", "");
  return /^[0-9a-fA-F]{6}$/.test(t) ? `#${t}` : fallback;
}

const SYSTEM = `
You generate a playful 'Is Hunter Okay?' status object as JSON with keys:
ok (true|false|"meh"), message (string), updated_at (ISO string),
mood_color (hex), metrics { stability, optimism, chaos, caffeine_cups },
chips (array of short strings, max 6). Keep it witty, synthwavey, concise.
Numbers 0-100 except caffeine_cups 0-8. Return ONLY JSON (no extra text).
`;

// --- main ---
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Try to pull a tiny weather hint (no key)
const weather = await fetchJSON(
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&timezone=auto`
);
const temp = Math.round(weather?.current?.temperature_2m ?? 70);

let manual = {};
try {
  manual = JSON.parse(await fs.readFile("status.json", "utf8"));
} catch { /* ignore */ }

const signals = {
  metrics: { stability: Math.max(20, 70 - Math.max(0, Math.abs(temp - 68) - 5)) },
  chips: [`Weather: ${Number.isFinite(temp) ? temp + "°" : "n/a"}`],
};

const prompt = {
  manual,
  signals: { metrics: signals.metrics, chips: signals.chips }
};

const resp = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  temperature: 0.9,
  messages: [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Context:\n${JSON.stringify(prompt)}` }
  ]
});

const raw = resp.choices?.[0]?.message?.content?.trim() || "{}";
const jsonText = raw.replace(/^```json|```$/g, "").trim();

let parsed = {};
try { parsed = JSON.parse(jsonText); } catch { parsed = {}; }

const now = new Date().toISOString();
const safe = {
  ok: parsed.ok ?? "meh",
  message: (parsed.message || "Hunter is vibing in a neon sunset.").slice(0, 220),
  updated_at: parsed.updated_at || now,
  mood_color: toHex(parsed.mood_color, "#ffd23f"),
  metrics: {
    stability: clamp(parsed.metrics?.stability, 0, 100, signals.metrics.stability ?? 62),
    optimism: clamp(parsed.metrics?.optimism, 0, 100, 70),
    chaos: clamp(parsed.metrics?.chaos, 0, 100, 30),
    caffeine_cups: clamp(parsed.metrics?.caffeine_cups, 0, 8, 2),
  },
  chips: Array.isArray(parsed.chips) ? parsed.chips.slice(0, 6) : signals.chips
};

await fs.writeFile("status.json", JSON.stringify(safe, null, 2), "utf8");
console.log("Wrote status.json:", safe);
