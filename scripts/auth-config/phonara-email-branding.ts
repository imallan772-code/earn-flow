/**
 * PHONARA branded Supabase Auth email templates — Management API patch SSOT.
 * Requires Custom SMTP (Free plan OK). Push via bun run supabase:auth:smtp
 */
import { phonaraEmailLayout } from "./phonara-email-layout";
import { AUTH_PART5_EMAIL_SUBJECTS } from "./part5-security";

export const PHONARA_EMAIL_TEMPLATES = {
  mailer_templates_confirmation_content: phonaraEmailLayout({
    headline: "이메일을 확인해 주세요",
    bodyHtml:
      "<p>PHONARA 가입을 완료하려면 아래 버튼을 눌러 이메일 주소를 확인해 주세요.</p>",
    ctaHref: "{{ .ConfirmationURL }}",
    ctaLabel: "이메일 확인하기",
    footerNote: "가입을 요청하지 않았다면 이 메일을 무시해도 됩니다.",
  }),

  mailer_templates_recovery_content: phonaraEmailLayout({
    headline: "비밀번호 재설정",
    bodyHtml:
      "<p>비밀번호 재설정 요청을 받았습니다. 아래 버튼으로 새 비밀번호를 설정해 주세요. 링크는 곧 만료됩니다.</p>",
    ctaHref: "{{ .ConfirmationURL }}",
    ctaLabel: "비밀번호 재설정",
    footerNote: "요청하지 않았다면 이 메일을 무시해도 됩니다.",
  }),

  mailer_templates_magic_link_content: phonaraEmailLayout({
    headline: "로그인 링크",
    bodyHtml:
      "<p>아래 버튼을 눌러 PHONARA에 로그인하세요. 이 링크는 한 번만 사용할 수 있으며 곧 만료됩니다.</p>",
    ctaHref: "{{ .ConfirmationURL }}",
    ctaLabel: "로그인하기",
  }),

  mailer_templates_email_change_content: phonaraEmailLayout({
    headline: "새 이메일 확인",
    bodyHtml:
      "<p><strong>{{ .NewEmail }}</strong>(으)로 변경하려면 아래 버튼을 눌러 확인해 주세요.</p>",
    ctaHref: "{{ .ConfirmationURL }}",
    ctaLabel: "새 이메일 확인",
  }),

  mailer_templates_reauthentication_content: phonaraEmailLayout({
    headline: "본인 확인 코드",
    bodyHtml:
      "<p>민감한 작업을 진행하려면 아래 인증 코드를 입력해 주세요. 코드는 곧 만료됩니다.</p>" +
      '<p style="margin:20px 0;font-size:28px;font-weight:700;letter-spacing:0.15em;text-align:center;color:#ffffff;">{{ .Token }}</p>',
    footerNote: "본인이 요청하지 않았다면 즉시 비밀번호를 변경하고 지원팀에 문의해 주세요.",
  }),

  mailer_templates_invite_content: phonaraEmailLayout({
    headline: "PHONARA 초대",
    bodyHtml: "<p>PHONARA 계정 생성 초대를 받았습니다. 아래 버튼으로 가입을 완료해 주세요.</p>",
    ctaHref: "{{ .ConfirmationURL }}",
    ctaLabel: "초대 수락하기",
  }),

  mailer_templates_password_changed_notification_content: phonaraEmailLayout({
    headline: "비밀번호가 변경되었습니다",
    bodyHtml:
      "<p>계정 <strong>{{ .Email }}</strong>의 비밀번호가 방금 변경되었습니다.</p>" +
      "<p>본인이 변경한 것이 아니라면 즉시 비밀번호를 재설정하고 지원팀에 연락해 주세요.</p>",
    footerNote: "보안 알림 메일입니다.",
  }),

  mailer_templates_email_changed_notification_content: phonaraEmailLayout({
    headline: "이메일 주소가 변경되었습니다",
    bodyHtml:
      "<p>계정 이메일이 <strong>{{ .OldEmail }}</strong>에서 <strong>{{ .Email }}</strong>(으)로 변경되었습니다.</p>" +
      "<p>본인이 변경한 것이 아니라면 즉시 지원팀에 문의해 주세요.</p>",
  }),

  mailer_templates_phone_changed_notification_content: phonaraEmailLayout({
    headline: "전화번호가 변경되었습니다",
    bodyHtml:
      "<p>계정 <strong>{{ .Email }}</strong>의 전화번호가 변경되었습니다.</p>" +
      "<p>본인이 변경한 것이 아니라면 즉시 지원팀에 문의해 주세요.</p>",
  }),

  mailer_templates_identity_linked_notification_content: phonaraEmailLayout({
    headline: "새 로그인 수단 연결",
    bodyHtml:
      "<p><strong>{{ .Provider }}</strong> 계정이 <strong>{{ .Email }}</strong>에 연결되었습니다.</p>" +
      "<p>본인이 연결한 것이 아니라면 즉시 해당 연결을 해제하고 비밀번호를 변경해 주세요.</p>",
  }),

  mailer_templates_identity_unlinked_notification_content: phonaraEmailLayout({
    headline: "로그인 수단 연결 해제",
    bodyHtml:
      "<p><strong>{{ .Provider }}</strong> 로그인 수단이 <strong>{{ .Email }}</strong> 계정에서 해제되었습니다.</p>",
  }),

  mailer_templates_mfa_factor_enrolled_notification_content: phonaraEmailLayout({
    headline: "MFA가 추가되었습니다",
    bodyHtml:
      "<p><strong>{{ .FactorType }}</strong> 인증 수단이 <strong>{{ .Email }}</strong> 계정에 추가되었습니다.</p>",
  }),

  mailer_templates_mfa_factor_unenrolled_notification_content: phonaraEmailLayout({
    headline: "MFA가 제거되었습니다",
    bodyHtml:
      "<p><strong>{{ .FactorType }}</strong> 인증 수단이 <strong>{{ .Email }}</strong> 계정에서 제거되었습니다.</p>" +
      "<p>본인이 제거한 것이 아니라면 즉시 계정을 보호해 주세요.</p>",
  }),
} as const;

/** Full branding patch: subjects + HTML bodies (SMTP must be configured separately first). */
export function phonaraEmailBrandingPatch(): Record<string, string> {
  return {
    ...AUTH_PART5_EMAIL_SUBJECTS,
    ...PHONARA_EMAIL_TEMPLATES,
  };
}
