/**
 * StakeBetPanel — reusable Manual/Auto bet UI for all crash-style games.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { AutoBetConfigFields } from "./AutoBetConfigFields";
import { useAutoBetController } from "./useAutoBetController";

export interface BetCallbacks {
  /** Return false when the bet did not land (e.g. debit failed) so auto-bet can retry. */
  onPlace: (amount: number, autoTarget: number) => void | Promise<boolean>;
  onCashout: () => void;
}

interface Props extends BetCallbacks {
  canPlace: boolean;
  hasActiveBet: boolean;
  balance: number;
  lastOutcome?: { outcome: "win" | "loss"; profit: number; nonce: number } | null;
  bettingRoundKey?: number;
  bettingProgress?: number;
  suppressCashoutButton?: boolean;
  variant?: "full" | "compact";
  showAutoTarget?: boolean;
}

export function StakeBetPanel({
  canPlace,
  hasActiveBet,
  balance,
  lastOutcome,
  bettingRoundKey,
  onPlace,
  onCashout,
  bettingProgress,
  suppressCashoutButton,
  variant = "full",
  showAutoTarget = true,
}: Props) {
  const compact = variant === "compact";
  const [tab, setTab] = useState<"manual" | "auto">("manual");
  const effectiveTab: "manual" | "auto" = compact ? "manual" : tab;
  const [amount, setAmount] = useState(10);
  const [target, setTarget] = useState(2.0);
  const placingRef = useRef(false);

  const { cfg, setCfg, autoRunning, autoState, startAuto, stopAuto } = useAutoBetController({
    canPlace,
    hasActiveBet,
    balance,
    amount,
    target,
    lastOutcome,
    bettingRoundKey,
    onPlace,
  });

  useEffect(() => {
    if (!canPlace) placingRef.current = false;
  }, [canPlace]);

  const progressPct = Math.max(0, Math.min(1, bettingProgress ?? 0)) * 100;

  return (
    <div className="glass-2 flex flex-col gap-3 rounded-2xl p-3">
      {!compact && (
        <div className="glass-1 grid grid-cols-2 rounded-xl p-1">
          {(["manual", "auto"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
                tab === t ? "bg-(--color-cyan) text-(--color-bg-0)" : "text-(--color-muted)",
              )}
            >
              {t === "manual" ? "수동" : "자동"}
            </button>
          ))}
        </div>
      )}

      {effectiveTab === "auto" && autoRunning && autoState && (
        <div className="glass-1 flex items-center justify-between rounded-xl px-3 py-2 text-[11px]">
          <span className="font-bold uppercase tracking-wider text-(--color-cyan)">● AUTO</span>
          <span className="text-(--color-muted)">
            라운드{" "}
            <span className="font-numeric text-(--color-foreground)">{autoState.betsPlaced}</span>
            {cfg.numberOfBets > 0 ? ` / ${cfg.numberOfBets}` : " / ∞"}
          </span>
          <span
            className={cn(
              "font-numeric font-bold",
              autoState.pnl >= 0 ? "text-emerald" : "text-(--color-rose)",
            )}
          >
            {autoState.pnl >= 0 ? "+" : ""}
            {autoState.pnl.toFixed(2)}
          </span>
        </div>
      )}

      <Field label="베팅액">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            className="font-numeric flex-1 rounded-lg bg-(--color-bg-0) px-2 py-1.5 text-sm outline-none"
          />
          {[
            { lbl: "½", fn: () => setAmount((a) => +(a / 2).toFixed(2)) },
            { lbl: "2x", fn: () => setAmount((a) => +(a * 2).toFixed(2)) },
            { lbl: "MAX", fn: () => setAmount(balance) },
          ].map((b) => (
            <button
              key={b.lbl}
              type="button"
              onClick={b.fn}
              className="rounded-lg bg-(--color-surface-hi) px-2 py-1.5 text-[11px] font-bold"
            >
              {b.lbl}
            </button>
          ))}
        </div>
      </Field>

      {showAutoTarget && (
        <Field label="자동 캐쉬아웃 (배수)">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTarget((t) => Math.max(1.01, +(t - 0.1).toFixed(2)))}
              className="rounded-lg bg-(--color-surface-hi) px-2 py-1.5 text-[11px] font-bold"
            >
              −
            </button>
            <input
              type="number"
              min={1.01}
              step={0.01}
              value={target}
              onChange={(e) => setTarget(Math.max(1.01, Number(e.target.value) || 1.01))}
              className="font-numeric flex-1 rounded-lg bg-(--color-bg-0) px-2 py-1.5 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setTarget((t) => +(t + 0.1).toFixed(2))}
              className="rounded-lg bg-(--color-surface-hi) px-2 py-1.5 text-[11px] font-bold"
            >
              +
            </button>
          </div>
        </Field>
      )}

      {!compact && tab === "auto" && <AutoBetConfigFields cfg={cfg} onChange={setCfg} />}

      {effectiveTab === "manual" ? (
        hasActiveBet ? (
          suppressCashoutButton ? (
            <button
              type="button"
              disabled
              className="rounded-xl bg-(--color-surface-hi) py-3 text-sm font-bold text-muted-2"
            >
              라운드 진행 중 — 위에서 캐쉬아웃
            </button>
          ) : (
            <button
              type="button"
              onClick={onCashout}
              className="rounded-xl bg-warning py-3 text-sm font-extrabold text-(--color-bg-0) shadow-glow-gold active:scale-[0.98]"
            >
              캐쉬아웃
            </button>
          )
        ) : (
          <button
            type="button"
            disabled={!canPlace || amount <= 0}
            onClick={() => {
              if (placingRef.current) return;
              if (!canPlace || amount <= 0) return;
              placingRef.current = true;
              onPlace(amount, target);
              window.setTimeout(() => {
                placingRef.current = false;
              }, 600);
            }}
            className={cn(
              "relative overflow-hidden rounded-xl py-3 text-sm font-extrabold transition active:scale-[0.98]",
              canPlace && amount > 0
                ? "bg-(--color-cyan) text-(--color-bg-0) shadow-glow-cyan"
                : "bg-(--color-surface-hi) text-muted-2",
            )}
          >
            {bettingProgress != null && canPlace && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 bg-[color-mix(in_oklab,var(--color-bg-0)_28%,transparent)] transition-[width] duration-100"
                style={{ width: `${progressPct}%` }}
              />
            )}
            <span className="relative">{canPlace ? "베팅" : "라운드 진행 중"}</span>
          </button>
        )
      ) : autoRunning ? (
        <button
          type="button"
          onClick={stopAuto}
          className="rounded-xl bg-(--color-rose) py-3 text-sm font-extrabold text-(--color-bg-0)"
        >
          자동 정지
        </button>
      ) : (
        <button
          type="button"
          onClick={startAuto}
          className="rounded-xl bg-emerald py-3 text-sm font-extrabold text-(--color-bg-0) shadow-glow-cyan"
        >
          자동 시작
        </button>
      )}

      <div className="flex justify-between text-[11px] text-(--color-muted)">
        <span>잔액</span>
        <span className="font-numeric">{balance.toFixed(2)} USDT</span>
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
