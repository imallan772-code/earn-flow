/**
 * Bulk-fix Tailwind v4 suggestCanonicalClasses warnings.
 * [var(--color-X)] → theme token (text-gold) or (--color-X) when ambiguous.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";

/** Tailwind IntelliSense suggestCanonicalClasses — short theme names only for these. */
const SHORT_TOKENS = new Set(["gold", "emerald", "muted-2", "warning", "pink"]);

const UTILITIES = [
  "text",
  "bg",
  "border",
  "ring",
  "fill",
  "stroke",
  "from",
  "to",
  "via",
  "outline",
  "decoration",
  "caret",
  "accent",
  "divide",
];

/** Known typo: project uses bg-2 in @theme, not surface-2. */
const TOKEN_ALIASES = { "surface-2": "bg-2" };

function canonicalColor(utility, token) {
  const t = TOKEN_ALIASES[token] ?? token;
  if (SHORT_TOKENS.has(t)) return `${utility}-${t}`;
  return `${utility}-(--color-${t})`;
}

function transform(content) {
  let out = content;

  // [var(--color-token)] or [var(--color-token,fallback)]
  out = out.replace(
    /([a-z][\w-]*:)*([a-z]+)-\[var\(--color-([a-z0-9-]+)(?:,[^[\]]+)?\)\]/gi,
    (_, variants, utility, token) => {
      const v = variants ?? "";
      return `${v}${canonicalColor(utility.toLowerCase(), token)}`;
    },
  );

  // Tailwind v4 gradient rename
  out = out.replace(/\bbg-gradient-to-([trblxy]+)\b/g, "bg-linear-to-$1");

  // aspect ratio
  out = out.replace(/\baspect-\[(\d+\/\d+)\]/g, "aspect-$1");

  // Fix tokens that must use (--color-*) per linter (not short names)
  for (const util of UTILITIES) {
    for (const token of ["rose", "cyan", "purple", "success", "danger"]) {
      const re = new RegExp(`(?<![(-])${util}-${token}(?![\\w-])`, "g");
      out = out.replace(re, `${util}-(--color-${token})`);
    }
  }

  // Ensure short tokens never use (--color-*) form
  for (const util of UTILITIES) {
    for (const token of SHORT_TOKENS) {
      out = out.replaceAll(`${util}-(--color-${token})`, `${util}-${token}`);
    }
  }

  return out;
}

async function walk(dir, files = []) {
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === "dist") continue;
      await walk(p, files);
    } else if ([".tsx", ".ts", ".jsx", ".js"].includes(extname(name.name))) {
      files.push(p);
    }
  }
  return files;
}

const root = join(import.meta.dirname, "..", "src");
const files = await walk(root);
let changed = 0;

for (const file of files) {
  const before = await readFile(file, "utf8");
  const after = transform(before);
  if (after !== before) {
    await writeFile(file, after, "utf8");
    changed++;
  }
}

console.log(`Updated ${changed} files under src/`);
