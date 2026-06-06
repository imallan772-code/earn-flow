/** PHONARA auth email shell — table layout for email client compatibility. */
export function phonaraEmailLayout(options: {
  headline: string;
  bodyHtml: string;
  ctaHref?: string;
  ctaLabel?: string;
  footerNote?: string;
}): string {
  const { headline, bodyHtml, ctaHref, ctaLabel, footerNote } = options;
  const cta =
    ctaHref && ctaLabel
      ? `<p style="margin:28px 0 0;text-align:center;">
  <a href="${ctaHref}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#ffffff;text-decoration:none;font-weight:600;border-radius:12px;font-size:15px;">${ctaLabel}</a>
</p>`
      : "";

  const footer =
    footerNote ??
    "본인이 요청하지 않았다면 이 메일을 무시하고, 계정 보안을 위해 비밀번호를 변경해 주세요.";

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0b0b14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b14;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#12121f;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
<tr><td style="padding:28px 32px 8px;text-align:center;">
  <span style="font-size:13px;font-weight:700;letter-spacing:0.2em;color:#a855f7;">PHONARA</span>
</td></tr>
<tr><td style="padding:8px 32px 32px;color:#e8e8f0;">
  <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;color:#ffffff;">${headline}</h1>
  <div style="font-size:15px;line-height:1.65;color:#b8b8cc;">${bodyHtml}</div>
  ${cta}
  <p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#6b6b80;">${footer}</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:#4a4a5c;">© PHONARA · Provably fair gaming</p>
</td></tr>
</table>
</body>
</html>`;
}
