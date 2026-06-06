import { useState } from "react";
import { CheckCircle2, Send, Zap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePromoAdmin } from "../hooks/usePromoAdmin";
import { ADMIN_KO, PROMO_CHANNEL_LABELS_KO } from "@/shared/admin/labels.ko";
import {
  runPromoCronTick,
  testChannel as testChannelFn,
} from "@/lib/promo/promo.functions";
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

function settingsPayload(s: {
  webhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}) {
  return {
    webhookUrl: s.webhookUrl,
    telegramBotToken: s.telegramBotToken,
    telegramChatId: s.telegramChatId,
  };
}

export function ChannelMatrix() {
  const { dispatches, settings, configured } = usePromoAdmin();
  const ko = ADMIN_KO.promo.channels;
  const koPub = ADMIN_KO.promo.publish;

  const testFn = useServerFn(testChannelFn);
  const cronFn = useServerFn(runPromoCronTick);
  const [log, setLog] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  function pushLog(msg: string) {
    setLog((l) =>
      [`${new Date().toLocaleTimeString("ko-KR")} · ${msg}`, ...l].slice(0, 20),
    );
  }

  async function handleVerify(id: PromoChannelId) {
    const name = PROMO_CHANNEL_LABELS_KO[id] ?? id;
    try {
      const res = await testFn({
        data: { channel: id, settings: settingsPayload(settings) },
      });
      if (res.ok) {
        pushLog(`${name} · ${koPub.testOk}`);
        toast.success(`${name} · ${koPub.testOk}`);
      } else {
        const msg = res.code === "OAUTH_REQUIRED" ? koPub.oauthRequired
          : res.code === "SSRF_BLOCKED" ? koPub.ssrfBlocked
          : `${koPub.testFail} (${res.code})`;
        pushLog(`${name} · ${msg}`);
        toast.error(`${name} · ${msg}`);
      }
    } catch (e) {
      pushLog(`${name} · ${(e as Error).message}`);
      toast.error(`${name} · ${koPub.testFail}`);
    }
  }

  async function handlePublishNow() {
    // 「지금 발행」 = runPromoCronTick (scheduled due 캠페인 fan-out 전용)
    setPublishing(true);
    try {
      const res = await cronFn({ data: { settings: settingsPayload(settings) } });
      if (res.ok) {
        pushLog(`${koPub.publishNow} · ${koPub.sent(res.sent)} · ${koPub.failed(res.failed)}`);
        toast.success(`${koPub.sent(res.sent)} · ${koPub.failed(res.failed)}`);
      } else {
        pushLog(`${koPub.publishNow} · ${koPub.dbNotConfigured}`);
        toast.error(koPub.dbNotConfigured);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="glass-2 rounded-3xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-bold">{ko.title}</h2>
          <button
            type="button"
            onClick={handlePublishNow}
            disabled={publishing}
            className="ml-auto flex items-center gap-1.5 rounded-2xl bg-holographic px-3 py-1.5 text-xs font-bold text-(--color-bg-0) disabled:opacity-50"
          >
            <Zap size={12} /> {publishing ? koPub.sending : koPub.publishNow}
          </button>
        </div>
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
              <button
                onClick={() => handleVerify(id)}
                className="glass-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px]"
              >
                <CheckCircle2 size={11} /> {ko.verify}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="glass-2 rounded-3xl p-5">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold">
          <Send size={12} /> {ko.logTitle}
        </h3>
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
