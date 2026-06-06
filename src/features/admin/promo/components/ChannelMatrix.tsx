import { useEffect, useState } from "react";
import { CheckCircle2, Link2, Send, Zap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePromoAdmin, PROMO_QUERY_KEYS } from "../hooks/usePromoAdmin";
import { ADMIN_KO, PROMO_CHANNEL_LABELS_KO } from "@/shared/admin/labels.ko";
import {
  runPromoCronTick,
  testChannel as testChannelFn,
} from "@/lib/promo/promo.functions";
import { getAdminAuthHeaders } from "@/lib/admin/session";
import type { OAuthChannelId } from "@/lib/promo/oauth/types";
import type { PromoChannelId } from "../types";

const OAUTH_CHANNELS: OAuthChannelId[] = ["x", "linkedin", "tiktok"];

const CHANNELS: { id: PromoChannelId; warn?: string }[] = [
  { id: "telegram" },
  { id: "discord" },
  { id: "slack" },
  { id: "x" },
  { id: "linkedin" },
  { id: "tiktok", warn: "텍스트 발행 미지원 · OAuth 연결 + copy 채널로 캡션 사용" },
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

function isOAuthConnected(id: PromoChannelId, settings: ReturnType<typeof usePromoAdmin>["settings"]) {
  if (id === "x") return settings.xConnected;
  if (id === "linkedin") return settings.linkedinConnected;
  if (id === "tiktok") return settings.tiktokConnected;
  return false;
}

export function ChannelMatrix() {
  const { dispatches, settings, persisting } = usePromoAdmin();
  const ko = ADMIN_KO.promo.channels;
  const koPub = ADMIN_KO.promo.publish;
  const qc = useQueryClient();

  const testFn = useServerFn(testChannelFn);
  const cronFn = useServerFn(runPromoCronTick);
  const [log, setLog] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [connecting, setConnecting] = useState<OAuthChannelId | null>(null);

  function oauthErrorMessage(reason: string | null): string {
    const map = koPub.oauthErrorReasons;
    if (reason && map[reason]) return map[reason];
    if (reason && reason.length <= 40) return `${koPub.oauthCallbackFail}: ${reason}`;
    return koPub.oauthCallbackFail;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (!oauth) return;
    const channel = params.get("channel");
    if (oauth === "ok" && channel) {
      toast.success(
        koPub.oauthCallbackOk(PROMO_CHANNEL_LABELS_KO[channel] ?? channel),
      );
      void qc.invalidateQueries({ queryKey: PROMO_QUERY_KEYS.settings });
    } else if (oauth === "error") {
      toast.error(oauthErrorMessage(params.get("reason")));
    }
    params.delete("oauth");
    params.delete("channel");
    params.delete("reason");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    // koPub is stable (ADMIN_KO const).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);

  function pushLog(msg: string) {
    setLog((l) =>
      [`${new Date().toLocaleTimeString("ko-KR")} · ${msg}`, ...l].slice(0, 20),
    );
  }

  async function startOAuthConnect(channel: OAuthChannelId) {
    const headers = await getAdminAuthHeaders();
    const res = await fetch(`/api/admin/promo/oauth/${channel}/start`, {
      method: "POST",
      headers,
      redirect: "manual",
    });
    if (res.status === 302) {
      const loc = res.headers.get("Location");
      if (loc) {
        window.location.href = loc;
        return;
      }
    }
    let message = `OAuth start failed (${res.status})`;
    try {
      const json = (await res.json()) as { code?: string };
      if (json.code) message = json.code;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  async function handleConnect(id: OAuthChannelId) {
    setConnecting(id);
    try {
      await startOAuthConnect(id);
    } catch (e) {
      toast.error(`${koPub.oauthStartFail}: ${(e as Error).message}`);
      setConnecting(null);
    }
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
        const msg =
          res.code === "OAUTH_REQUIRED"
            ? koPub.oauthRequired
            : res.code === "SSRF_BLOCKED"
              ? koPub.ssrfBlocked
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
          {CHANNELS.map(({ id, warn }) => {
            const oauthChannel = OAUTH_CHANNELS.includes(id as OAuthChannelId);
            const connected = oauthChannel && isOAuthConnected(id, settings);
            const isConnecting = oauthChannel && connecting === id;
            // Badge: OAuth channels in persisting mode get 3-state pill; others keep live/mock.
            let badgeText: string;
            let badgeCls =
              "ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold border";
            if (oauthChannel && persisting) {
              if (connected) {
                badgeText = koPub.oauthConnected;
                badgeCls +=
                  " bg-(--color-emerald)/15 text-(--color-emerald) border-(--color-emerald)/30";
              } else {
                badgeText = koPub.oauthDisconnected;
                badgeCls += " bg-white/8 text-(--color-muted) border-white/10";
              }
            } else {
              badgeText = persisting ? ko.liveBadge : ko.mockBadge;
              badgeCls += " bg-white/8 border-white/10";
            }
            return (
              <div
                key={id}
                className="glass-1 flex min-h-[128px] flex-col gap-2 rounded-2xl p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{PROMO_CHANNEL_LABELS_KO[id]}</span>
                  <span className={badgeCls}>{badgeText}</span>
                </div>
                {warn && <p className="text-[10px] text-(--color-muted)">⚠ {warn}</p>}
                <div className="mt-auto flex flex-wrap gap-1">
                  {oauthChannel && persisting && !connected && (
                    <button
                      type="button"
                      onClick={() => handleConnect(id as OAuthChannelId)}
                      disabled={isConnecting}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-(--color-accent)/30 bg-(--color-accent)/15 px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
                    >
                      <Link2 size={11} />{" "}
                      {isConnecting ? koPub.oauthConnecting : koPub.oauthConnect}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleVerify(id)}
                    className="glass-1 flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px]"
                  >
                    <CheckCircle2 size={11} /> {ko.verify}
                  </button>
                </div>
              </div>
            );
          })}
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
