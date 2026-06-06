import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { usePromoAdmin } from "../hooks/usePromoAdmin";
import { ADMIN_KO, PROMO_CHANNEL_LABELS_KO } from "@/shared/admin/labels.ko";
import type { PromoChannelId } from "../types";

const CHANNELS: { id: PromoChannelId; warn?: string }[] = [
  { id: "telegram" },
  { id: "discord" },
  { id: "slack" },
  { id: "x", warn: "OAuth 연동 필요 (Cursor Z-OAuth)" },
  { id: "linkedin", warn: "OAuth 연동 필요 (Cursor Z-OAuth)" },
  { id: "tiktok", warn: "콘텐츠 API 연동 (Cursor)" },
  { id: "resend", warn: "수신 동의·광고 정책 확인 필수" },
  { id: "zapier", warn: "웹훅으로 IG·FB·Threads 분기" },
  { id: "copy", warn: "네이버·카카오·IG 수동 발행 · 이용약관 준수" },
];

interface AdapterResult {
  ok: boolean;
  msg: string;
}

function mockVerify(id: PromoChannelId): AdapterResult {
  const name = PROMO_CHANNEL_LABELS_KO[id] ?? id;
  return { ok: true, msg: `[데모] ${name} 연결 확인됨 (Z-2에서 실연동)` };
}
function mockSend(id: PromoChannelId): AdapterResult {
  const name = PROMO_CHANNEL_LABELS_KO[id] ?? id;
  return { ok: true, msg: `[데모] ${name} 발송 대기열에 추가됨` };
}

export function ChannelMatrix() {
  const { dispatches, campaigns, addDispatch, configured } = usePromoAdmin();
  const [log, setLog] = useState<string[]>([]);
  const ko = ADMIN_KO.promo.channels;

  const handleTest = (id: PromoChannelId, mode: "verify" | "send") => {
    const r = mode === "verify" ? mockVerify(id) : mockSend(id);
    setLog((l) => [`${new Date().toLocaleTimeString("ko-KR")} · ${r.msg}`, ...l].slice(0, 20));
    if (mode === "send" && campaigns[0]) {
      addDispatch({
        id: configured ? crypto.randomUUID() : `d-${Date.now()}`,
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
        <h2 className="mb-3 text-base font-bold">{ko.title}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map(({ id, warn }) => (
            <div key={id} className="glass-1 flex flex-col gap-2 rounded-2xl p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{PROMO_CHANNEL_LABELS_KO[id]}</span>
                <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-bold">
                  {configured ? ko.liveBadge : ko.mockBadge}
                </span>
              </div>
              {warn && <p className="text-[10px] text-(--color-muted)">⚠ {warn}</p>}
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleTest(id, "verify")}
                  className="glass-1 flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px]"
                >
                  <CheckCircle2 size={11} /> {ko.verify}
                </button>
                <button
                  onClick={() => handleTest(id, "send")}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-holographic px-2 py-1 text-[11px] font-bold text-(--color-bg-0)"
                >
                  <Send size={11} /> {ko.send}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="glass-2 rounded-3xl p-5">
        <h3 className="mb-2 text-sm font-bold">{ko.logTitle}</h3>
        <p className="mb-2 text-[10px] text-(--color-muted)">
          {ko.logMeta(dispatches.length, log.length)}
        </p>
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto text-[10px] text-(--color-muted)">
          {log.map((line, i) => (
            <li key={`${line}-${i}`}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
