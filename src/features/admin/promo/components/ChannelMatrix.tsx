import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { promoMockStore, usePromoState } from "../store/mockStore";
import { CHANNEL_LABELS, type PromoChannelId } from "../types";

const CHANNELS: { id: PromoChannelId; warn?: string }[] = [
  { id: "telegram" },
  { id: "discord" },
  { id: "slack" },
  { id: "x", warn: "OAuth 1.0a (Cursor Z-OAuth)" },
  { id: "linkedin", warn: "OAuth 2.0 (Cursor Z-OAuth)" },
  { id: "tiktok", warn: "Content Posting API (Cursor)" },
  { id: "resend", warn: "수신 동의 필수" },
  { id: "zapier", warn: "Webhook fan-out" },
  { id: "copy", warn: "Naver/Kakao/IG 수동 — ToS 주의" },
];

interface AdapterResult {
  ok: boolean;
  msg: string;
}

function mockVerify(id: PromoChannelId): AdapterResult {
  return { ok: true, msg: `[mock] ${id} 자격 확인됨 (Z-1에서 실호출)` };
}
function mockSend(id: PromoChannelId): AdapterResult {
  return { ok: true, msg: `[mock] ${id} dispatch queued` };
}

export function ChannelMatrix() {
  const dispatches = usePromoState((s) => s.dispatches);
  const campaigns = usePromoState((s) => s.campaigns);
  const [log, setLog] = useState<string[]>([]);

  const handleTest = (id: PromoChannelId, mode: "verify" | "send") => {
    const r = mode === "verify" ? mockVerify(id) : mockSend(id);
    setLog((l) => [`${new Date().toLocaleTimeString()} · ${r.msg}`, ...l].slice(0, 20));
    if (mode === "send" && campaigns[0]) {
      promoMockStore.addDispatch({
        id: `d-${Date.now()}`,
        campaignId: campaigns[0].id,
        channel: id,
        variantId: campaigns[0].variants[0]?.id ?? "v-mock",
        sentAt: new Date().toISOString(),
        status: "sent",
      });
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="glass-2 rounded-3xl p-5">
        <h2 className="mb-3 text-base font-bold">Channel Matrix</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map(({ id, warn }) => (
            <div key={id} className="glass-1 flex flex-col gap-2 rounded-2xl p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{CHANNEL_LABELS[id]}</span>
                <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-bold">
                  mock
                </span>
              </div>
              {warn && <p className="text-[10px] text-(--color-muted)">⚠ {warn}</p>}
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleTest(id, "verify")}
                  className="glass-1 flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px]"
                >
                  <CheckCircle2 size={11} /> verify()
                </button>
                <button
                  onClick={() => handleTest(id, "send")}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-holographic px-2 py-1 text-[11px] font-bold text-(--color-bg-0)"
                >
                  <Send size={11} /> send()
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="glass-2 rounded-3xl p-5">
        <h2 className="mb-2 text-sm font-bold">Dispatch Log</h2>
        <p className="mb-2 text-[10px] text-(--color-muted)">
          최근 {dispatches.length} dispatch · {log.length} test
        </p>
        <ul className="font-numeric flex max-h-80 flex-col gap-1 overflow-auto text-[11px]">
          {log.map((l, i) => (
            <li key={i} className="rounded-lg bg-white/5 px-2 py-1">
              {l}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
