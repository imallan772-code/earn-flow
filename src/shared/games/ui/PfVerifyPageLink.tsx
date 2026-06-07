/**
 * ROUND Q-c — shared CTA: PF modal → /fair/verify (seed prefill).
 *
 * Renders a TanStack <Link> with verifySearchSchema-aligned search params.
 * Disabled (span) until commit hash arrives (!serverSeedHash).
 */
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { t } from "@/shared/i18n";
import type { VerifyGame } from "@/lib/pf/verifySchemas";

export interface PfVerifyPageLinkProps {
  game: VerifyGame;
  serverSeed: string;
  serverSeedHash?: string;
  clientSeed: string;
  nonce: number;
  mineCount?: number;
  risk?: "low" | "medium" | "high";
  segments?: number;
  rows?: 8 | 12 | 16;
}

export function PfVerifyPageLink({
  game,
  serverSeed,
  serverSeedHash,
  clientSeed,
  nonce,
  mineCount,
  risk,
  segments,
  rows,
}: PfVerifyPageLinkProps) {
  const label = t("fair.verify.openFromModal");
  const ready = Boolean(serverSeedHash);

  if (!ready) {
    return (
      <span
        aria-disabled="true"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-(--color-muted) opacity-50"
      >
        <ShieldCheck size={11} aria-hidden />
        {label}
      </span>
    );
  }

  return (
    <Link
      to="/fair/verify"
      search={{
        game,
        serverSeed,
        hash: serverSeedHash,
        clientSeed,
        nonce,
        mineCount,
        risk,
        segments,
        rows,
      }}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-(--color-accent)/40 bg-(--color-accent)/10 px-2.5 py-1.5 text-[11px] font-semibold text-(--color-accent) hover:bg-(--color-accent)/20"
    >
      <ShieldCheck size={11} aria-hidden />
      {label}
    </Link>
  );
}
