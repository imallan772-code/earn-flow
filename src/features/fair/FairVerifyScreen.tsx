/**
 * Standalone Provably Fair verify page — ROUND Q-PR1.
 * Public route: /fair/verify?game=crash&serverSeed=...&hash=...
 */
import { useCallback, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Copy, Link2, ArrowLeft } from "lucide-react";
import { verifyProvablyFair, buildVerifyShareUrl, type VerifyOutcome } from "@/lib/pf/verifyPublic";
import {
  verifyGameSchema,
  type VerifyGame,
  type VerifySearch,
} from "@/lib/pf/verifySchemas";
import { appToast } from "@/shared/ui/toast";

const GAMES: { id: VerifyGame; label: string }[] = [
  { id: "crash", label: "Crash" },
  { id: "dice", label: "Dice" },
  { id: "limbo", label: "Limbo" },
  { id: "wheel", label: "Wheel" },
  { id: "mines", label: "Mines" },
];

interface Props {
  initial: VerifySearch;
}

export function FairVerifyScreen({ initial }: Props) {
  const [game, setGame] = useState<VerifyGame>(initial.game);
  const [serverSeed, setServerSeed] = useState(initial.serverSeed);
  const [serverSeedHash, setServerSeedHash] = useState(initial.serverSeedHash);
  const [clientSeed, setClientSeed] = useState(initial.clientSeed);
  const [nonce, setNonce] = useState(String(initial.nonce));
  const [mineCount, setMineCount] = useState(initial.mineCount ? String(initial.mineCount) : "3");
  const [segments, setSegments] = useState(initial.segments ? String(initial.segments) : "10");
  const [risk, setRisk] = useState<"low" | "medium" | "high">(initial.risk ?? "low");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);

  const showMines = game === "mines";
  const showWheel = game === "wheel";

  const formReady = serverSeed.trim() && clientSeed.trim() && nonce.trim().length > 0;

  const runVerify = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await verifyProvablyFair({
        game,
        serverSeed: serverSeed.trim(),
        serverSeedHash: serverSeedHash.trim() || undefined,
        clientSeed: clientSeed.trim(),
        nonce: Number(nonce),
        mineCount: showMines ? Number(mineCount) : undefined,
        segments: showWheel ? (Number(segments) as 10 | 20 | 30) : undefined,
        risk: showWheel ? risk : undefined,
      });
      setOutcome(result);
    } catch (e) {
      setOutcome(null);
      setError(e instanceof Error ? e.message : "검증 실패");
    } finally {
      setLoading(false);
    }
  }, [game, serverSeed, serverSeedHash, clientSeed, nonce, mineCount, segments, risk, showMines, showWheel]);

  const shareUrl = useMemo(() => {
    if (!formReady || typeof window === "undefined") return "";
    try {
      return buildVerifyShareUrl(window.location.origin, {
        game,
        serverSeed: serverSeed.trim(),
        serverSeedHash: serverSeedHash.trim() || undefined,
        clientSeed: clientSeed.trim(),
        nonce: Number(nonce),
        mineCount: showMines ? Number(mineCount) : undefined,
        segments: showWheel ? (Number(segments) as 10 | 20 | 30) : undefined,
        risk: showWheel ? risk : undefined,
      });
    } catch {
      return "";
    }
  }, [formReady, game, serverSeed, serverSeedHash, clientSeed, nonce, mineCount, segments, risk, showMines, showWheel]);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      appToast.ui.copied();
    } catch {
      appToast.ui.comingSoon();
    }
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-cosmic">
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 py-8 safe-top safe-bottom">
        <header className="mb-8">
          <Link
            to="/feed"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-(--color-muted) hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            홈으로
          </Link>
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-8 text-(--color-accent)" aria-hidden />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Provably Fair 검증</h1>
              <p className="mt-1 text-sm text-(--color-muted)">
                공개된 server seed + client seed + nonce로 라운드 결과를 직접 재현합니다.
              </p>
            </div>
          </div>
        </header>

        <div className="glass-3 flex flex-1 flex-col gap-6 rounded-3xl p-6 shadow-depth-2">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">게임</span>
              <select
                value={game}
                onChange={(e) => {
                  const parsed = verifyGameSchema.safeParse(e.target.value);
                  if (parsed.success) setGame(parsed.data);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-(--color-accent)"
              >
                {GAMES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Server seed (공개)</span>
              <input
                value={serverSeed}
                onChange={(e) => setServerSeed(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-xs outline-none focus:border-(--color-accent)"
                placeholder="라운드 종료 후 공개된 시드"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Server seed hash (선택 — 사전 커밋)</span>
              <input
                value={serverSeedHash}
                onChange={(e) => setServerSeedHash(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-xs outline-none focus:border-(--color-accent)"
                placeholder="SHA256(serverSeed)"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Client seed</span>
              <input
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-xs outline-none focus:border-(--color-accent)"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Nonce</span>
              <input
                type="number"
                min={0}
                value={nonce}
                onChange={(e) => setNonce(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-(--color-accent)"
              />
            </label>

            {showMines && (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Mine count</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={mineCount}
                  onChange={(e) => setMineCount(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-(--color-accent)"
                />
              </label>
            )}

            {showWheel && (
              <>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Risk</span>
                  <select
                    value={risk}
                    onChange={(e) => setRisk(e.target.value as "low" | "medium" | "high")}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-(--color-accent)"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Segments</span>
                  <select
                    value={segments}
                    onChange={(e) => setSegments(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-(--color-accent)"
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="30">30</option>
                  </select>
                </label>
              </>
            )}
          </fieldset>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!formReady || loading}
              onClick={() => void runVerify()}
              className="rounded-xl bg-(--color-accent) px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {loading ? "검증 중…" : "결과 재현"}
            </button>
            {shareUrl && (
              <button
                type="button"
                onClick={() => void copyText(shareUrl)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5"
              >
                <Link2 className="size-4" aria-hidden />
                링크 복사
              </button>
            )}
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          {outcome && (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-(--color-muted)">
                검증 결과
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-(--color-muted)">SHA256(server seed)</dt>
                  <dd className="flex items-center gap-2 font-mono text-xs break-all">
                    {outcome.commitHash}
                    <button
                      type="button"
                      aria-label="커밋 해시 복사"
                      onClick={() => void copyText(outcome.commitHash)}
                      className="shrink-0 rounded-lg p-1 hover:bg-white/10"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </dd>
                </div>
                {outcome.commitValid !== null && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-(--color-muted)">커밋 일치</dt>
                    <dd className={outcome.commitValid ? "text-emerald-400" : "text-red-400"}>
                      {outcome.commitValid ? "일치 ✓" : "불일치 ✗"}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-(--color-muted)">{outcome.label}</dt>
                  <dd className="font-semibold tabular-nums">{outcome.detail}</dd>
                </div>
              </dl>
            </section>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-(--color-muted)">
          Stake.com 동일 HMAC-SHA256 스킴 · 라운드 시작 전 커밋 해시 공개
        </p>
      </div>
    </div>
  );
}
