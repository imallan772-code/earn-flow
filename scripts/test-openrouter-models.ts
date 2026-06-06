import { readFileSync } from "node:fs";

function loadEnv(key: string): string | undefined {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(new RegExp(`^${key}=(.+)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
}

const key = loadEnv("OPENROUTER_API_KEY")!;
const models = [
  "openrouter/free",
  "google/gemma-2-9b-it:free",
  "qwen/qwen3-4b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

for (const model of models) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Say OK" }],
    }),
  });
  const text = await res.text();
  const msg = text.match(/"message":"([^"]{0,120})/)?.[1] ?? text.slice(0, 120);
  console.log(`${model}\n  → ${res.status} ${msg}\n`);
}
