/** Supabase PKCE / implicit callback params in the current URL. */
export function hasAuthCallbackInUrl(): boolean {
  if (typeof window === "undefined") return false;

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    search.has("code") ||
    hash.has("access_token") ||
    search.get("type") === "recovery" ||
    hash.get("type") === "recovery"
  );
}

export function readOAuthErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  const search = new URLSearchParams(window.location.search);
  if (!search.has("error") && !search.has("error_code")) return null;

  const raw =
    search.get("error_description") ??
    search.get("error_code") ??
    search.get("error");
  if (!raw) return null;

  return decodeURIComponent(raw.replace(/\+/g, " "));
}

export function clearAuthParamsFromUrl(): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  const keys = [
    "code",
    "error",
    "error_code",
    "error_description",
    "state",
    "access_token",
    "refresh_token",
    "type",
  ];
  for (const key of keys) {
    url.searchParams.delete(key);
  }
  url.hash = "";
  window.history.replaceState({}, "", url.pathname + url.search);
}
