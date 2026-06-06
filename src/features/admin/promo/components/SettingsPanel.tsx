import { usePromoAdmin } from "../hooks/usePromoAdmin";
import { ADMIN_KO, PROMO_SETTINGS_KO_EXTRA } from "@/shared/admin/labels.ko";

export function SettingsPanel() {
  const { settings, updateSettings, persisting, loading } = usePromoAdmin();
  const ko = ADMIN_KO.promo.settings;
  const koTg = PROMO_SETTINGS_KO_EXTRA;
  const hint = persisting ? ko.hintConfigured : ko.hint;

  return (
    <section className="glass-2 max-w-xl rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">{ko.title}</h2>
      <p className="mb-4 text-[11px] text-(--color-muted)">{loading ? ko.loading : hint}</p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">{ko.webhook}</span>
          <input
            value={settings.webhookUrl}
            onChange={(e) => updateSettings({ webhookUrl: e.target.value })}
            placeholder="https://hooks.zapier.com/..."
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">{ko.hmac}</span>
          <input
            type="password"
            value={settings.hmacSecret}
            onChange={(e) => updateSettings({ hmacSecret: e.target.value })}
            placeholder="32자 이상 랜덤 문자열"
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">{ko.utm}</span>
          <input
            value={settings.defaultUtmSource}
            onChange={(e) => updateSettings({ defaultUtmSource: e.target.value })}
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">{koTg.telegramToken}</span>
          <input
            type="password"
            value={settings.telegramBotToken ?? ""}
            onChange={(e) => updateSettings({ telegramBotToken: e.target.value })}
            placeholder="123456:ABC-XYZ..."
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">{koTg.telegramChat}</span>
          <input
            value={settings.telegramChatId ?? ""}
            onChange={(e) => updateSettings({ telegramChatId: e.target.value })}
            placeholder="@phonara 또는 -1001234567890"
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
        </label>
      </div>
    </section>
  );
}
