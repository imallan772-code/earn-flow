import type { AutoBetConfig, Strategy } from "@/shared/games/engine/autoBet";
import { t } from "@/shared/i18n";

const STRATEGIES: Strategy[] = ["Flat", "Martingale", "AntiMartingale", "Fibonacci", "DAlembert"];

interface Props {
  cfg: AutoBetConfig;
  onChange: (next: AutoBetConfig) => void;
}

export function AutoBetConfigFields({ cfg, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2 border-t border-(--color-border) pt-2">
      <Field label="전략">
        <select
          value={cfg.strategy}
          onChange={(e) => onChange({ ...cfg, strategy: e.target.value as Strategy })}
          className="w-full rounded-lg bg-(--color-bg-0) px-2 py-1.5 text-sm outline-none"
        >
          {STRATEGIES.map((s) => (
            <option key={s} value={s}>
              {t(`strategy.${s}` as never)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="베팅 횟수 (0=무한)">
        <input
          type="number"
          min={0}
          value={cfg.numberOfBets}
          onChange={(e) => onChange({ ...cfg, numberOfBets: Number(e.target.value) || 0 })}
          className="font-numeric w-full rounded-lg bg-(--color-bg-0) px-2 py-1.5 text-sm outline-none"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="패배 시 증가 %">
          <input
            type="number"
            value={cfg.onLossIncreasePct}
            onChange={(e) => onChange({ ...cfg, onLossIncreasePct: Number(e.target.value) || 0 })}
            className="font-numeric w-full rounded-lg bg-(--color-bg-0) px-2 py-1.5 text-sm outline-none"
          />
        </Field>
        <Field label="승리 시 증가 %">
          <input
            type="number"
            value={cfg.onWinIncreasePct}
            onChange={(e) => onChange({ ...cfg, onWinIncreasePct: Number(e.target.value) || 0 })}
            className="font-numeric w-full rounded-lg bg-(--color-bg-0) px-2 py-1.5 text-sm outline-none"
          />
        </Field>
        <Field label="익절 정지">
          <input
            type="number"
            value={cfg.stopOnProfit}
            onChange={(e) => onChange({ ...cfg, stopOnProfit: Number(e.target.value) || 0 })}
            className="font-numeric w-full rounded-lg bg-(--color-bg-0) px-2 py-1.5 text-sm outline-none"
          />
        </Field>
        <Field label="손절 정지">
          <input
            type="number"
            value={cfg.stopOnLoss}
            onChange={(e) => onChange({ ...cfg, stopOnLoss: Number(e.target.value) || 0 })}
            className="font-numeric w-full rounded-lg bg-(--color-bg-0) px-2 py-1.5 text-sm outline-none"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-(--color-muted)">
        {label}
      </span>
      {children}
    </label>
  );
}
