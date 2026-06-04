/**
 * DiceScreen — Stake-style Dice game UI.
 *
 * Reuses Round B StakeBetPanel + Round A Provably Fair scheme.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, X } from "lucide-react";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { DiceSlider } from "@/shared/games/dice/DiceSlider";
import {
  type DiceMode,
  computeRoll,
  isWin,
  payoutMultiplier,
  winChance,
} from "@/shared/games/dice/DiceEngine";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import { cn } from "@/lib/utils";

const SERVER_SEED = "phonara-dice-demo-server-seed-v1";
const CLIENT_SEED = "phonara-player-001";

interface Roll {
  id: string;
  roll: number;
  win: boolean;
}

export function DiceScreen() {
  const [nonce, setNonce] = useState(0);
  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState<DiceMode>("over");
  const [balance, setBalance] = useState(1000);
  const [history, setHistory] = useState<Roll[]>([]);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [resultFlash, setResultFlash] = useState<"win" | "loss" | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<
    { outcome: "win" | "loss"; profit: number; nonce: number } | null
  >(null);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);

  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  const handlePlace = useCallback(
    async (amount: number) => {
      if (busy || amount <= 0 || amount > balance) return;
      setBusy(true);
      setBalance((b) => b - amount);
      const roll = await computeRoll({
        serverSeed: SERVER_SEED,
        clientSeed: CLIENT_SEED,
        nonce,
      });
      const win = isWin(roll, target, mode);
      const pm = payoutMultiplier(winChance(target, mode));
      const profit = win ? amount * (pm - 1) : -amount;
      if (win) setBalance((b) => b + amount * pm);
      setLastRoll(roll);
      setResultFlash(win ? "win" : "loss");
      setHistory((h) => [{ id: `n${nonce}`, roll, win }, ...h].slice(0, 30));
      setLastOutcome({ outcome: win ? "win" : "loss", profit, nonce });
      setNonce((n) => n + 1);
      window.setTimeout(() => setResultFlash(null), 600);
      window.setTimeout(() => setBusy(false), 150);
    },
    [busy, balance, nonce, target, mode],
  );

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <Link
          to="/earn"
          className="glass-1 grid h-9 w-9 place-items-center rounded-full"
          aria-label="뒤로"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold">Dice</h1>
          <p className="text-[11px] text-[var(--color-muted)]">99% RTP · Provably Fair</p>
        </div>
        <button
          onClick={() => setShowFair(true)}
          className="glass-1 ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
        >
          <ShieldCheck size={12} className="text-[var(--color-emerald)]" />
          공정성
        </button>
      </header>

      {/* history strip */}
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {history.map((h) => (
          <li
            key={h.id}
            className={cn(
              "font-numeric shrink-0 rounded-full px-2 py-1 text-[11px] font-bold",
              h.win
                ? "bg-[color-mix(in_oklab,var(--color-emerald)_22%,transparent)] text-[var(--color-emerald)]"
                : "bg-[color-mix(in_oklab,var(--color-rose)_22%,transparent)] text-[var(--color-rose)]",
            )}
          >
            {h.roll.toFixed(2)}
          </li>
        ))}
        {history.length === 0 && (
          <li className="text-[11px] text-[var(--color-muted-2)]">아직 라운드 없음</li>
        )}
      </ul>

      {/* result display */}
      <div
        className={cn(
          "glass-2 relative flex aspect-[4/3] items-center justify-center rounded-2xl transition-all",
          resultFlash === "win" && "ring-2 ring-[var(--color-emerald)]",
          resultFlash === "loss" && "animate-pulse ring-2 ring-[var(--color-rose)]",
        )}
        style={{ background: "var(--color-bg-1)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-muted)]">
            Roll Result
          </div>
          <div
            className="font-numeric text-7xl font-black"
            style={{
              color: resultFlash === "loss"
                ? "var(--color-rose)"
                : resultFlash === "win"
                  ? "var(--color-emerald)"
                  : "var(--color-foreground)",
            }}
          >
            {lastRoll != null ? lastRoll.toFixed(2) : "—"}
          </div>
          {resultFlash && (
            <div
              className="rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider"
              style={{
                background: resultFlash === "win"
                  ? "color-mix(in oklab, var(--color-emerald) 22%, transparent)"
                  : "color-mix(in oklab, var(--color-rose) 22%, transparent)",
                color: resultFlash === "win" ? "var(--color-emerald)" : "var(--color-rose)",
              }}
            >
              {resultFlash}
            </div>
          )}
        </div>
      </div>

      {/* slider */}
      <div className="glass-2 rounded-2xl p-4">
        <DiceSlider
          target={target}
          mode={mode}
          onTargetChange={setTarget}
          onModeChange={setMode}
          lastRoll={lastRoll}
        />
      </div>

      {/* bet panel — reuses Crash component */}
      <StakeBetPanel
        canPlace={!busy}
        hasActiveBet={false}
        balance={balance}
        lastOutcome={lastOutcome}
        onPlace={(amount) => handlePlace(amount)}
        onCashout={() => {}}
      />

      {/* provably fair */}
      {showFair && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowFair(false)}
        >
          <div
            className="glass-2 w-full max-w-md rounded-t-3xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">공정성 검증</h2>
              <button onClick={() => setShowFair(false)}>
                <X size={18} />
              </button>
            </div>
            <dl className="flex flex-col gap-3 text-xs">
              <Row k="Server Seed (Hash)">
                <code className="break-all text-[10px] text-[var(--color-cyan)]">
                  {commit || "loading..."}
                </code>
              </Row>
              <Row k="Client Seed">
                <code className="text-[var(--color-purple)]">{CLIENT_SEED}</code>
              </Row>
              <Row k="다음 Nonce">
                <code className="font-numeric">{nonce}</code>
              </Row>
              <Row k="마지막 Roll">
                <code className="font-numeric text-[var(--color-gold)]">
                  {lastRoll != null ? lastRoll.toFixed(2) : "—"}
                </code>
              </Row>
            </dl>
            <p className="mt-4 text-[10px] leading-relaxed text-[var(--color-muted)]">
              roll = floor(floatFromBytes(HMAC-SHA256(serverSeed, &quot;clientSeed:nonce:0&quot;)) × 10000) / 100
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[var(--color-muted)]">{k}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
