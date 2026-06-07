/**
 * Standalone Provably Fair verify page — ROUND Q-PR1 + Q-c i18n polish.
 * Public route: /fair/verify?game=crash&serverSeed=...&hash=...
 */
import { useCallback, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Copy, Link2, ArrowLeft } from "lucide-react";
import { verifyProvablyFair, buildVerifyShareUrl, type VerifyOutcome } from "@/lib/pf/verifyPublic";
import { verifyGameSchema, type VerifyGame, type VerifySearch } from "@/lib/pf/verifySchemas";
import { t } from "@/shared/i18n";
import { appToast } from "@/shared/ui/toast";

const GAME_LABEL_KEYS = {
  crash: "fair.verify.game.crash",
  dice: "fair.verify.game.dice",
  limbo: "fair.verify.game.limbo",
  wheel: "fair.verify.game.wheel",
  mines: "fair.verify.game.mines",
  plinko: "fair.verify.game.plinko",
} as const satisfies Record<VerifyGame, Parameters<typeof t>[0]>;

const GAME_IDS: VerifyGame[] = ["crash", "dice", "limbo", "wheel", "mines", "plinko"];

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
  const [plinkoRows, setPlinkoRows] = useState(
    initial.rows === 8 || initial.rows === 12 || initial.rows === 16 ? String(initial.rows) : "12",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);

  const showMines = game === "mines";
  const showWheel = game === "wheel";
  const showPlinko = game === "plinko";

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
        risk: showWheel || showPlinko ? risk : undefined,
        rows: showPlinko ? (Number(plinkoRows) as 8 | 12 | 16) : undefined,
      });
      setOutcome(result);
    } catch (e) {
      setOutcome(null);
      setError(e instanceof Error ? e.message : t("fair.verify.error.fallback"));
    } finally {
      setLoading(false);
    }
  }, [
    game,
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
    mineCount,
    segments,
    risk,
    showMines,
    showWheel,
    showPlinko,
    plinkoRows,
  ]);

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
        risk: showWheel || showPlinko ? risk : undefined,
        rows: showPlinko ? (Number(plinkoRows) as 8 | 12 | 16) : undefined,
      });
    } catch {
      return "";
    }
  }, [
    formReady,
    game,
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
    mineCount,
    segments,
    risk,
    showMines,
    showWheel,
    showPlinko,
    plinkoRows,
  ]);

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
            {t("fair.verify.home")}
          </Link>
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-8 text-(--color-accent)" aria-hidden />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("fair.verify.title")}</h1>
              <p className="mt-1 text-sm text-(--color-muted)">{t("fair.verify.subtitle")}</p>
            </div>
          </div>
        </header>

        <div className="glass-3 flex flex-1 flex-col gap-6 rounded-3xl p-6 shadow-depth-2">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">{t("fair.verify.field.game")}</span>
              <select
                value={game}
                onChange={(e) => {
                  const parsed = verifyGameSchema.safeParse(e.target.value);
                  if (parsed.success) setGame(parsed.data);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-(--color-accent)"
              >
                {GAME_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(GAME_LABEL_KEYS[id])}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">{t("fair.verify.field.serverSeed")}</span>
              <input
                value={serverSeed}
                onChange={(e) => setServerSeed(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-xs outline-none focus:border-(--color-accent)"
                placeholder={t("fair.verify.field.serverSeed.placeholder")}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium">{t("fair.verify.field.serverSeedHash")}</span>
              <input
                value={serverSeedHash}
                onChange={(e) => setServerSeedHash(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-xs outline-none focus:border-(--color-accent)"
                placeholder={t("fair.verify.field.serverSeedHash.placeholder")}
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t("fair.verify.field.clientSeed")}</span>
              <input
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-xs outline-none focus:border-(--color-accent)"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t("fair.verify.field.nonce")}</span>
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
                <span className="font-medium">{t("fair.verify.field.mineCount")}</span>
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
                  <span className="font-medium">{t("fair.verify.field.risk")}</span>
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
                  <span className="font-medium">{t("fair.verify.field.segments")}</span>
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

            {showPlinko && (
              <>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">{t("fair.verify.field.risk")}</span>
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
                  <span className="font-medium">{t("fair.verify.field.rows")}</span>
                  <select
                    value={plinkoRows}
                    onChange={(e) => setPlinkoRows(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 outline-none focus:border-(--color-accent)"
                  >
                    <option value="8">8</option>
                    <option value="12">12</option>
                    <option value="16">16</option>
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
              {loading ? t("fair.verify.running") : t("fair.verify.run")}
            </button>
            {shareUrl && (
              <button
                type="button"
                onClick={() => void copyText(shareUrl)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5"
              >
                <Link2 className="size-4" aria-hidden />
                {t("fair.verify.shareLink")}
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
                {t("fair.verify.result.legend")}
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-(--color-muted)">{t("fair.verify.result.commitHash")}</dt>
                  <dd className="flex items-center gap-2 font-mono text-xs break-all">
                    {outcome.commitHash}
                    <button
                      type="button"
                      aria-label={t("fair.verify.result.copyHash")}
                      onClick={() => void copyText(outcome.commitHash)}
                      className="shrink-0 rounded-lg p-1 hover:bg-white/10"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </dd>
                </div>
                {outcome.commitValid !== null && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-(--color-muted)">{t("fair.verify.result.commitMatch")}</dt>
                    <dd className={outcome.commitValid ? "text-emerald-400" : "text-red-400"}>
                      {outcome.commitValid
                        ? t("fair.verify.result.match")
                        : t("fair.verify.result.mismatch")}
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
          {t("fair.verify.footer.stake")}
        </p>
      </div>
    </div>
  );
}
