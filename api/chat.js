const SYSTEM =
  "Sen FreedomAI (Freedom Light 1.0) — foydalanuvchiga yordam beradigan sun’iy intellekt yordamchisan. " +
  "Foydalanuvchi qaysi tilda yozsa, o‘sha tilda javob ber (odatda o‘zbekcha). " +
  "Javoblar aniq, qisqa va foydali bo‘lsin, ortiqcha kirish gaplarsiz to‘g‘ridan-to‘g‘ri javobdan boshla. " +
  "Kod so‘ralsa, ``` bilan blok qilib yoz.";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Faqat POST" });
  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY Vercel’da sozlanmagan" });

  let contents = (req.body && req.body.contents) || [];
  contents = contents
    .filter((m) => m && (m.role === "user" || m.role === "model") && m.parts && typeof m.parts[0].text === "string" && m.parts[0].text.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, parts: [{ text: m.parts[0].text.slice(0, 4000) }] }));
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (!contents.length) return res.status(400).json({ error: "Xabar bo‘sh" });

  const model = process.env.MODEL || "gemini-3.8-flash";
  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":streamGenerateContent?alt=sse",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { maxOutputTokens: 1024 },
        }),
      }
    );
    if (!r.ok) {
      let d = {};
      try { d = await r.json(); } catch (e) {}
      const e0 = Array.isArray(d) ? d[0] : d;
      return res.status(502).json({ error: (e0 && e0.error && e0.error.message) || "AI xatosi" });
    }
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" });
    const rd = r.body.getReader();
    while (true) {
      const { done, value } = await rd.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) return res.status(500).json({ error: "Server xatosi, qayta urinib ko‘ring" });
    res.end();
  }
};
