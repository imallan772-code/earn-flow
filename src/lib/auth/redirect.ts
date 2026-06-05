const DEFAULT_SITE = "http://localhost:8080";

/** Post-auth redirect target (email confirm, OAuth, password reset). */
export function getAuthRedirectUrl(path = "/feed"): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : ((import.meta.env.VITE_SITE_URL as string | undefined) ?? DEFAULT_SITE);
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base.replace(/\/$/, "")}${normalized}`;
}
