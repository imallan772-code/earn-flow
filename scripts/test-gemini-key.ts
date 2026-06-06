import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^GEMINI_API_KEY=(.+)$/);
  if (m) process.env.GEMINI_API_KEY = m[1].trim().replace(/^["']|["']$/g, "");
}

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.log("NO_KEY");
  process.exit(1);
}

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": key },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: '{"ok":true}' }] }],
    generationConfig: { responseMimeType: "application/json" },
  }),
});
const text = await res.text();
console.log("status", res.status);
console.log(text.slice(0, 600));
