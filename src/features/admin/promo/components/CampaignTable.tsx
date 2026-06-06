import { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { usePromoAdmin } from "../hooks/usePromoAdmin";
import { ADMIN_KO, promoStatusLabel } from "@/shared/admin/labels.ko";
import { publishPromoCampaign } from "@/lib/promo/promo.functions";
import { RiskBadge } from "./RiskBadge";

export function CampaignTable() {
  const { campaigns, removeCampaign, settings, loading } = usePromoAdmin();
  const ko = ADMIN_KO.promo.campaigns;
  const koPub = ADMIN_KO.promo.publish;
  const publishFn = useServerFn(publishPromoCampaign);
  const [busy, setBusy] = useState<string | null>(null);

  async function onPublishRow(id: string) {
    setBusy(id);
    try {
      const res = await publishFn({
        data: {
          campaignId: id,
          settings: {
            webhookUrl: settings.webhookUrl,
            telegramBotToken: settings.telegramBotToken,
            telegramChatId: settings.telegramChatId,
          },
        },
      });
      if (res.ok) {
        toast.success(`${koPub.sent(res.sent)} · ${koPub.failed(res.failed)}`);
      } else if (res.code === "DB_NOT_CONFIGURED") {
        toast.error(koPub.dbNotConfigured);
      } else {
        toast.error(koPub.campaignMissing);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="glass-2 rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">{ko.title}</h2>
      {loading ? (
        <p className="text-xs text-(--color-muted)">{ko.loading}</p>
      ) : campaigns.length === 0 ? (
        <p className="text-xs text-(--color-muted)">{ko.empty}</p>
      ) : (
        <div className="grid gap-2">
          {campaigns.map((c) => (
            <div key={c.id} className="glass-1 flex items-center gap-3 rounded-2xl p-3">
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold">
                {promoStatusLabel(c.status)}
              </span>
              <span className="flex-1 truncate text-sm font-semibold">{c.title}</span>
              <RiskBadge score={c.riskScore} flags={[]} />
              <span className="font-numeric text-[11px] text-(--color-muted)">
                {c.scheduledAt.slice(0, 16).replace("T", " ")}
              </span>
              <button
                onClick={() => onPublishRow(c.id)}
                disabled={busy === c.id}
                className="flex items-center gap-1 rounded-lg bg-holographic px-2 py-1 text-[11px] font-bold text-(--color-bg-0) disabled:opacity-50"
                aria-label={koPub.publishRow}
              >
                <Send size={11} /> {busy === c.id ? koPub.sending : koPub.publishRow}
              </button>
              <button
                onClick={() => removeCampaign(c.id)}
                className="rounded-lg p-1.5 text-(--color-rose) hover:bg-white/8"
                aria-label={ko.delete}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
