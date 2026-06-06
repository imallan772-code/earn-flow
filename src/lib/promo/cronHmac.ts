import { createHmac, timingSafeEqual } from "crypto";

export function verifyPromoCronHmac(
  secret: string,
  body: string,
  sig: string | null,
): boolean {
  if (!sig) return false;
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
