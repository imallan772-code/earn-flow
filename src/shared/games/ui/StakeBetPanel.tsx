/**
 * StakeBetPanel — reusable Manual/Auto bet UI for all crash-style games.
 *
 * Hosts the Round-A autoBet reducer; the parent owns the actual bet placement
 * via onBet/onCashout. UI styled with token-only colors.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  type AutoBetConfig,
  type Strategy,
  initAutoBet,
  step as autoStep,
} from "@/shared/games/engine/autoBet";

export interface BetCallbacks {
  onPlace: (amount: number, autoTarget: number) => void;
  onCashout: () => void;
}

interface Props extends BetCallbacks {
  /** "betting" | "running" — controls which action is available */
  canPlace: boolean;
  hasActiveBet: boolean;
  balance: number;
  /** Notify when a round finalizes — feeds the auto-bet reducer */
  lastOutcome?: { outcome: "win" | "loss"; profit: number; nonce: number } | null;
}

const STRATEGIES: Strategy[] = ["Flat", "Martingale", "AntiMartingale", "Fibonacci", "DAlembert"];

export function StakeBetPanel({
  canPlace,
  hasActiveBet,
  balance,
  lastOutcome,
  onPlace,
  onCashout,
}: Props) {
  const [tab, setTab] = useState<"manual" | "auto">("manual");
  const [amount, setAmount] = useState(10);
  const [target, setTarget] = useState(2.0);

  // auto state
  const [cfg, setCfg] = useState<AutoBetConfig>({
    strategy: "Flat",
    baseBet: 10,
    numberOfBets: 0,
    onWinIncreasePct: 0,
    onLossIncreasePct: 100,
    stopOnProfit: 0,
    stopOnLoss: 0,
  });
  const [autoRunning, setAutoRunning] = useState(false);
  const autoStateRef = useRef(initAutoBet(cfg));
  const lastNonceRef = useRef<number | null>(null);

  // when last outcome lands, advance auto state and place next bet
  useEffect(() => {
    if (!autoRunning || !lastOutcome) return;
    if (lastOutcome.nonce === lastNonceRef.current) return;
    lastNonceRef.current = lastOutcome.nonce;
    autoStateRef.current = autoStep(autoStateRef.current, {
      outcome: lastOutcome.outcome,
      delta: lastOutcome.profit,
    });
    if (!autoStateRef.current.running) {
      setAutoRunning(false);
      return;
    }
  }, [lastOutcome, autoRunning]);

  // place next auto bet when betting phase opens
  useEffect(() => {
    if (!autoRunning || !canPlace || hasActiveBet) return;
    const bet = autoStateRef.current.currentBet;
    onPlace(bet, target);
  }, [autoRunning, canPlace, hasActiveBet, onPlace, target]);

  function startAuto() {
    autoStateRef.current = initAutoBet(cfg);
    lastNonceRef.current = null;
    setAutoRunning(true);
  }
  function stopAuto() {
    setAutoRunning(false);
  }

  return (
    <div className="glass-2 flex flex-col gap-3 rounded-2xl p-3">
      {/* tabs */}
      <div className="glass-1 grid grid-cols-2 rounded-xl p-1">
        {(["manual", "auto"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
              tab === t
                ? "bg-[var(--color-cyan)] text-[var(--color-bg-0)]"
                : "text-[var(--color-muted)]"
            )}
          >
            {t === "manual" ? "수동" : "자동"}
          </button>
        ))}
      </div>

      {/* amount */}
      <Field label="베팅액">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            className="font-numeric flex-1 rounded-lg bg-[var(--color-bg-0)] px-2 py-1.5 text-sm outline-none"
          />
          {[
            { lbl: "½", fn: () => setAmount((a) => +(a / 2).toFixed(2)) },
            { lbl: "2x", fn: () => setAmount((a) => +(a * 2).toFixed(2)) },
            { lbl: "MAX", fn: () => setAmount(balance) },
          ].map((b) => (
            <button
              key={b.lbl}
              onClick={b.fn}
              className="rounded-lg bg-[var(--color-surface-hi)] px-2 py-1.5 text-[11px] font-bold"
            >
              {b.lbl}
            </button>
          ))}
        </div>
      </Field>

      {/* auto target */}
      <Field label="자동 캐쉬아웃 (배수)">
        <input
          type="number"
          min={1.01}
          step={0.01}
          value={target}
          onChange={(e) => setTarget(Math.max(1.01, Number(e.target.value) || 1.01))}
          className="font-numeric w-full rounded-lg bg-[var(--color-bg-0)] px-2 py-1.5 text-sm outline-none"
        />
      </Field>

      {/* auto-only config */}
      {tab === "auto" && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-2">
          <Field label="전략">
            <select
              value={cfg.strategy}
              onChange={(e) => setCfg({ ...cfg, strategy: e.target.value as Strategy })}
              className="w-full rounded-lg bg-[var(--color-bg-0)] px-2 py-1.5 text-sm outline-none"
            >
              {STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="패배 시 증가 %">
              <input
                type="number"
                value={cfg.onLossIncreasePct}
                onChange={(e) => setCfg({ ...cfg, onLossIncreasePct: Number(e.target.value) || 0 })}
                className="font-numeric w-full rounded-lg bg-[var(--color-bg-0)] px-2 py-1.5 text-sm outline-none"
              />
            </Field>
            <Field label="승리 시 증가 %">
              <input
                type="number"
                value={cfg.onWinIncreasePct}
                onChange={(e) => setCfg({ ...cfg, onWinIncreasePct: Number(e.target.value) || 0 })}
                className="font-numeric w-full rounded-lg bg-[var(--color-bg-0)] px-2 py-1.5 text-sm outline-none"
              />
            </Field>
            <Field label="익절 정지">
              <input
                type="number"
                value={cfg.stopOnProfit}
                onChange={(e) => setCfg({ ...cfg, stopOnProfit: Number(e.target.value) || 0 })}
                className="font-numeric w-full rounded-lg bg-[var(--color-bg-0)] px-2 py-1.5 text-sm outline-none"
              />
            </Field>
            <Field label="손절 정지">
              <input
                type="number"
                value={cfg.stopOnLoss}
                onChange={(e) => setCfg({ ...cfg, stopOnLoss: Number(e.target.value) || 0 })}
                className="font-numeric w-full rounded-lg bg-[var(--color-bg-0)] px-2 py-1.5 text-sm outline-none"
              />
            </Field>
          </div>
        </div>
      )}

      {/* action */}
      {tab === "manual" ? (
        hasActiveBet ? (
          <button
            onClick={onCashout}
            className="rounded-xl bg-[var(--color-warning)] py-3 text-sm font-extrabold text-[var(--color-bg-0)] shadow-glow-purple active:scale-[0.98]"
          >
            캐쉬아웃
          </button>
        ) : (
          <button
            disabled={!canPlace || amount <= 0}
            onClick={() => onPlace(amount, target)}
            className={cn(
              "rounded-xl py-3 text-sm font-extrabold transition active:scale-[0.98]",
              canPlace && amount > 0
                ? "bg-[var(--color-cyan)] text-[var(--color-bg-0)]"
                : "bg-[var(--color-surface-hi)] text-[var(--color-muted-2)]"
            )}
          >
            {canPlace ? "베팅" : "다음 라운드 대기"}
          </button>
        )
      ) : autoRunning ? (
        <button
          onClick={stopAuto}
          className="rounded-xl bg-[var(--color-rose)] py-3 text-sm font-extrabold text-[var(--color-bg-0)]"
        >
          자동 정지
        </button>
      ) : (
        <button
          onClick={startAuto}
          className="rounded-xl bg-[var(--color-emerald)] py-3 text-sm font-extrabold text-[var(--color-bg-0)]"
        >
          자동 시작
        </button>
      )}

      <div className="flex justify-between text-[11px] text-[var(--color-muted)]">
        <span>잔액</span>
        <span className="font-numeric">{balance.toFixed(2)} USDT</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
