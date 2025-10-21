const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

function json(res, status = 200) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(res)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return json({ ok: true });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: "Missing OPENAI_API_KEY" }, 500);

  // Accept GET with query params or POST with JSON
  let prompt = "Ping";
  if (event.httpMethod === "GET") {
    const params = new URLSearchParams(event.rawQuery || "");
    prompt = `Create a fun one-liner. Weather=${params.get("weather")}, Spotify=${params.get("spotify")}, Sleep=${params.get("sleep")}`;
  } else if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      if (body.prompt) prompt = body.prompt;
    } catch {}
  }

  try {
    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const text = await r.text();
    if (!r.ok) return json({ error: "OpenAI request failed", status: r.status, details: text }, r.status);

    const data = JSON.parse(text);
    const content = data?.choices?.[0]?.message?.content ?? "";
    return json({ ok: true, content });
  } catch (err) {
    return json({ error: "Function error", details: String(err) }, 500);
  }
};
