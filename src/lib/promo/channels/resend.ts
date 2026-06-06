/**
 * Resend email adapter — Z-2 stub. Cursor wires the Edge function.
 */
import type { ChannelAdapter } from "./types";

export const resendAdapter: ChannelAdapter = {
  id: "resend",
  async send() {
    return { ok: false, code: "NOT_IMPLEMENTED", message: "resend edge fn pending (Cursor)" };
  },
  async verify() {
    return { ok: false, code: "NOT_IMPLEMENTED" };
  },
};
