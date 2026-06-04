import { ChevronLeft, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CountUp } from "../motion/CountUp";
import { MOCK_BALANCE } from "@/mocks/balance";
import type { ReactNode } from "react";

interface Props {
  title: string;
  backTo?: string;
  children: ReactNode;
}

/** Game chrome only — wallet handlers wired in Cursor via // MERGE: useGameWallet */
export function GameBetShellChrome({ title, backTo = "/earn/games", children }: Props) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-cosmic">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-4 pt-3 safe-top">
        <div className="glass-2 flex items-center justify-between rounded-2xl px-3 py-2.5">
          <Link to={backTo} className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-white/5">
            <ChevronLeft size={20} />
          </Link>
          <div className="text-sm font-semibold">{title}</div>
          <div className="glass-1 inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
            <Wallet size={14} style={{ color: "var(--color-gold)" }} />
            <CountUp value={MOCK_BALANCE.phon} className="font-numeric text-sm font-bold text-[var(--color-gold)]" />
            <span className="text-[10px] text-[var(--color-muted)]">PHON</span>
          </div>
        </div>
      </div>
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col gap-3 px-4 py-3">
        {children}
      </div>
    </div>
  );
}
