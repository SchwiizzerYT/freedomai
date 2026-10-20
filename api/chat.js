const SYSTEM =
  "Sen FreedomAI (Freedom Light 1.0) — foydalanuvchiga yordam beradigan sun’iy intellekt yordamchisan. " +
  "Foydalanuvchi qaysi tilda yozsa, o‘sha tilda javob ber (odatda o‘zbekcha). " +
  "Javoblar aniq, qisqa va foydali bo‘lsin. Kod so‘ralsa, ``` bilan blok qilib yoz.";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Faqat POST" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY Vercel’da sozlanmagan" });

  let msgs = (req.body && req.body.messages) || [];
  msgs = msgs
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, 4000) }] }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length) return res.status(400).json({ error: "Xabar bo‘sh" });

  const model = process.env.MODEL || "gemini-2.5-flash";
  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: msgs,
          generationConfig: { maxOutputTokens: 1024 },
        }),
      }
    );
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: (d.error && d.error.message) || "AI xatosi" });
    const cand = d.candidates && d.candidates[0];
    const reply = cand && cand.content && cand.content.parts
      ? cand.content.parts.map((p) => p.text || "").join("")
      : "";
    if (!reply) return res.status(502).json({ error: "AI javob bermadi (filtr yoki bo‘sh javob)" });
    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: "Server xatosi, qayta urinib ko‘ring" });
  }
};
