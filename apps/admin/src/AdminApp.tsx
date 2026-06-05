/** Desktop admin shell — pnpm workspace @phonara/admin */
export function AdminApp() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0d0a1a",
        color: "#f5f3ff",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>PHONARA Admin</h1>
      <p style={{ marginTop: "0.5rem", opacity: 0.7 }}>
        pnpm monorepo · apps/admin — 운영 KPI·이벤트·공지는 web 앱 /admin 라우트와 병행
      </p>
    </div>
  );
}
