import { useCallback, useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { isPasskeySupported } from "@/lib/auth/webauthn";
import { appToast } from "@/shared/ui/toast";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";

interface PasskeyRow {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
}

export function PasskeySettings() {
  const { registerPasskey, isConfigured } = useAuth();
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const supported = isPasskeySupported();

  const refresh = useCallback(async () => {
    if (!isConfigured) {
      setPasskeys([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.passkey.list();
      if (error) throw error;
      setPasskeys(data ?? []);
    } catch {
      setPasskeys([]);
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRegister() {
    if (!supported) {
      appToast.raw.error("이 브라우저는 패스키를 지원하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      await registerPasskey();
      appToast.raw.success("패스키가 등록되었습니다");
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "패스키 등록에 실패했습니다";
      appToast.raw.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(passkeyId: string) {
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.passkey.delete({ passkeyId });
      if (error) throw error;
      appToast.raw.success("패스키를 삭제했습니다");
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "패스키 삭제에 실패했습니다";
      appToast.raw.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Premium3DCard className="p-4" glow="cyan">
      <div className="flex items-center gap-2">
        <KeyRound size={18} style={{ color: "var(--color-cyan)" }} />
        <div className="text-sm font-semibold">패스키</div>
      </div>
      <p className="mt-2 text-xs text-(--color-muted)">
        Face ID · Touch ID · Windows Hello로 1초 로그인
      </p>

      {!supported && (
        <p className="mt-3 text-xs text-(--color-muted)">이 기기/브라우저에서는 패스키를 쓸 수 없습니다.</p>
      )}

      {loading ? (
        <p className="mt-3 text-xs text-(--color-muted)">불러오는 중…</p>
      ) : passkeys.length === 0 ? (
        <p className="mt-3 text-xs text-(--color-muted)">등록된 패스키가 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs"
            >
              <div>
                <div className="font-semibold text-foreground">
                  {pk.friendly_name ?? "패스키"}
                </div>
                <div className="text-(--color-muted)">
                  등록 {new Date(pk.created_at).toLocaleDateString("ko-KR")}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDelete(pk.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-(--color-muted) hover:bg-white/10 hover:text-pink disabled:opacity-50"
                aria-label="패스키 삭제"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={!supported || busy || !isConfigured}
        onClick={() => void handleRegister()}
        className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-holographic text-sm font-bold text-bg-0 disabled:opacity-50"
      >
        {busy ? "처리 중…" : "패스키 등록"}
      </button>
    </Premium3DCard>
  );
}
