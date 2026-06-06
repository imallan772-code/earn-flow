import { readFileSync } from "node:fs";

function loadEnv(key: string): string | undefined {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(new RegExp(`^${key}=(.+)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return process.env[key];
}

const key = loadEnv("OPENROUTER_API_KEY");
const model = process.argv[2] || loadEnv("OPENROUTER_PROMO_MODEL") || "openrouter/free";

if (!key) {
  console.log("NO_OPENROUTER_KEY in .env");
  process.exit(1);
}

console.log("model:", model);
console.log("key prefix:", key.slice(0, 12) + "...");

const siteUrl = loadEnv("VITE_SITE_URL") || "http://localhost:8080";
const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": siteUrl,
    "X-Title": "PHONARA earn-flow Promo test",
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: '{"ok":true}' }],
    response_format: { type: "json_object" },
  }),
});

const text = await res.text();
console.log("HTTP", res.status);
console.log(text.slice(0, 800));

if (res.ok) {
  const usage = res.headers.get("x-ratelimit-remaining");
  if (usage) console.log("x-ratelimit-remaining:", usage);
}
