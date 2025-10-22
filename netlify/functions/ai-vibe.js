// netlify/functions/ai-vibe.js
// Live status with real Wilmington, DE weather

// Node 18+ has global fetch
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Wilmington, DE
const LAT = 39.739; 
const LON = -75.539;
const TIMEZONE = "America/New_York";

// Map Open-Meteo weather codes to human text
const W_DESC = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "freezing fog",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  56: "light freezing drizzle", 57: "freezing drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain",
  66: "light freezing rain", 67: "freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow",
  77: "snow grains",
  80: "light showers", 81: "showers", 82: "heavy showers",
  85: "light snow showers", 86: "snow showers",
  95: "thunderstorm", 96: "thunderstorm with hail", 99: "severe thunderstorm with hail"
};

const pick = a => a[Math.floor(Math.random() * a.length)];

async function getWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(TIMEZONE)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Weather fetch failed: ${r.status}`);
  const j = await r.json();
  const c = j.current;
  const desc = W_DESC[c.weather_code] || "unknown conditions";
  return {
    tempF: Math.round(c.temperature_2m),
    feelsF: Math.round(c.apparent_temperature),
    windMph: Math.round(c.wind_speed_10m),
    precipMm: c.precipitation,
    desc
  };
}

// Themes to force structural variety
const THEMES = {
  weather: [
    "Give a playful on-air forecast of Hunter's emotional climate, blending mood with today's actual weather.",
    "Deliver a quick meteorologist-style hit mixing the real weather and Hunter's vibe."
  ],
  fantasy: [
    "Narrate a D&D-style status for Hunter, but work the real-world weather in as an in-game effect."
  ],
  space: [
    "Transmit a retro mission log for Hunter that references today's real weather at the landing site."
  ],
  corporate: [
    "Write a faux Slack status or quarterly micro-headline for Hunter that nods to today's actual weather."
  ],
  surreal: [
    "Write a tiny surreal vignette about Hunter that tangentially weaves in the real weather."
  ],
  haiku: [
    "Write a haiku about Hunter today that includes a hint of the real weather."
  ]
};

const SEEDS = [
  "synthwave","coffee","time travel","mushrooms","data cloud","seagull",
  "retro arcade","tacos","moonlight","bike ride","armadillo","quantum disco"
];

const PREFIXES = ["✅","🪩","🧭","🌤️","✨","🛰️","🍩","🐉","🎸","📡","💾","🦦"];
const SUFFIXES = [
  "— carry on.","— vibes intact.","— probably fine.","— onward.",
  "— status nominal.","— questionable but acceptable.","— cosmic alignment achieved."
];

export default async () => {
  try {
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ message: "🪩 Hunter appears okay — vibes intact." }), { headers: { "Content-Type": "application/json" }});
    }

    // 1) Live weather
    const wx = await getWeather();
    const weatherLine = `${wx.tempF}°F (feels ${wx.feelsF}°F), ${wx.desc}, wind ${wx.windMph} mph${wx.precipMm ? `, precip ${wx.precipMm} mm` : ""}`;

    // 2) Build a varied prompt
    const themeKey = pick(Object.keys(THEMES));
    const basePrompt = pick(THEMES[themeKey]);
    const seedWord = pick(SEEDS);

    const constraint =
      "Use ≤ 35 words. Be playful and **non-repetitive**; vary sentence structure every time. No medical/health claims, no instructions. Avoid clichés.";

    const userPrompt =
      `${basePrompt}\n\nContext: Current weather in Wilmington, DE is: ${weatherLine}.\n` +
      `Also weave in this loose inspiration: "${seedWord}".\n${constraint}`;

    const payload = {
      model: "gpt-4o-mini",
      temperature: 1.3,
      top_p: 0.9,
      max_tokens: 90,
      seed: Math.floor(Math.random() * 1e9),
      messages: [
        { role: "system", content: "You craft short, lively, highly varied status lines. Each answer should feel different in tone and structure." },
        { role: "user", content: userPrompt }
      ]
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenAI error:", t);
      return new Response(JSON.stringify({ message: `🌤️ Wilmington weather: ${weatherLine} — Hunter is probably fine.` }), { headers: { "Content-Type": "application/json" }});
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || `Wilmington weather: ${weatherLine}. Hunter is probably fine.`;
    const final = `${pick(PREFIXES)} ${content} ${pick(SUFFIXES)}`.replace(/\s+/g, " ").trim();

    return new Response(JSON.stringify({ message: final, weather: weatherLine }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ message: "🤖 Status is shy. Try again soon." }), { headers: { "Content-Type": "application/json" }});
  }
}
