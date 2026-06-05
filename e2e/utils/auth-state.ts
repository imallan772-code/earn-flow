import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const E2E_AUTH_FILE = path.join(rootDir, ".auth", "user.json");

export function hasStoredAuthState(): boolean {
  return fs.existsSync(E2E_AUTH_FILE);
}
