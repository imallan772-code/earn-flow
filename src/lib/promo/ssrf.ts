/**
 * SSRF guard — block private/loopback/link-local hosts.
 * Used before any server-side outbound fetch to user-supplied URLs.
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + AWS metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function assertSafeUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("SSRF: invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SSRF: protocol not allowed");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) throw new Error("SSRF: blocked host");
  if (isPrivateIPv4(host)) throw new Error("SSRF: private IP not allowed");
  if (host.endsWith(".internal") || host.endsWith(".local")) {
    throw new Error("SSRF: internal host not allowed");
  }
  return url;
}
