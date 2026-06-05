/**
 * GameShell — 게임 화면 공통 레이아웃. **순수 레이아웃 컴포넌트 (비즈 로직 0).**
 *
 * 역할
 *  - Dice/Crash/Mines 등 모든 게임의 외곽 컨테이너·간격·DemoLowBanner 위치를 통일.
 *  - 각 슬롯(`header`/`rulesCard`/`historyStrip`/`displayArea`/`controls`/`summaryPanel`/
 *    `banner`/`betPanel`)을 ReactNode로 주입받음.
 *
 * 결정 이유 (LOVABLE_WORK_RULES §5)
 *  - 셸이 StakeBetPanel·BetSummaryPanel을 직접 import하면 SSOT 위반 + 결합도 폭증.
 *    패널은 ReactNode 주입으로 게임별 props 자유도 확보.
 *  - LiveBetsFeed는 셸 **바깥**에 둠 (무스크롤 보장, DiceScreen 패턴과 일치).
 *  - footer 슬롯 없음 — 본 라운드 비대상.
 */
import type { ReactNode } from "react";

export interface GameShellProps {
  /** 뒤로가기·제목·모드 배지·nonce·PF 버튼 영역 */
  header: ReactNode;
  /** GameRulesCard 등 접이식 룰 패널 */
  rulesCard?: ReactNode;
  /** 최근 결과 가로 스크롤 strip */
  historyStrip?: ReactNode;
  /** 메인 게임 디스플레이 (그리드/슬라이더/캔버스) */
  displayArea: ReactNode;
  /** 추가 컨트롤 (선택) */
  controls?: ReactNode;
  /** 베팅 요약 패널 */
  summaryPanel?: ReactNode;
  /** DemoLowBanner 등 경고 배너 */
  banner?: ReactNode;
  /** StakeBetPanel */
  betPanel: ReactNode;
}

export function GameShell({
  header,
  rulesCard,
  historyStrip,
  displayArea,
  controls,
  summaryPanel,
  banner,
  betPanel,
}: GameShellProps) {
  return (
    <div className="flex flex-col gap-2">
      {header}
      {rulesCard}
      {historyStrip}
      {displayArea}
      {controls}
      {summaryPanel}
      {banner}
      {betPanel}
    </div>
  );
}
