import { promoMockStore, usePromoState } from "../store/mockStore";
import { ADMIN_KO } from "@/shared/admin/labels.ko";

export function SettingsPanel() {
  const settings = usePromoState((s) => s.settings);
  const ko = ADMIN_KO.promo.settings;
  return (
    <section className="glass-2 max-w-xl rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">{ko.title}</h2>
      <p className="mb-4 text-[11px] text-(--color-muted)">{ko.hint}</p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">{ko.webhook}</span>
          <input
            value={settings.webhookUrl}
            onChange={(e) => promoMockStore.updateSettings({ webhookUrl: e.target.value })}
            placeholder="https://hooks.zapier.com/..."
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">{ko.hmac}</span>
          <input
            type="password"
            value={settings.hmacSecret}
            onChange={(e) => promoMockStore.updateSettings({ hmacSecret: e.target.value })}
            placeholder="32자 이상 랜덤 문자열"
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">{ko.utm}</span>
          <input
            value={settings.defaultUtmSource}
            onChange={(e) => promoMockStore.updateSettings({ defaultUtmSource: e.target.value })}
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
        </label>
      </div>
    </section>
  );
}
