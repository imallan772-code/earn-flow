import { promoMockStore, usePromoState } from "../store/mockStore";

export function SettingsPanel() {
  const settings = usePromoState((s) => s.settings);
  return (
    <section className="glass-2 max-w-xl rounded-3xl p-5">
      <h2 className="mb-3 text-base font-bold">Settings</h2>
      <p className="mb-4 text-[11px] text-(--color-muted)">
        Z-0에선 mockStore에 저장만 됩니다. 실 secret은 Cursor Z-DB의 Lovable Cloud secrets에 등록.
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">Zapier Webhook URL</span>
          <input
            value={settings.webhookUrl}
            onChange={(e) => promoMockStore.updateSettings({ webhookUrl: e.target.value })}
            placeholder="https://hooks.zapier.com/..."
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">Cron HMAC Secret</span>
          <input
            type="password"
            value={settings.hmacSecret}
            onChange={(e) => promoMockStore.updateSettings({ hmacSecret: e.target.value })}
            placeholder="hex string ≥32"
            className="glass-1 rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-(--color-muted)">Default utm_source</span>
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
