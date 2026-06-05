# 라운드 G-Part2 — Limbo + Wheel (single-step on GameShell)

## 1. 목적

P1에서 추출한 `GameShell` + `useGameRound` + `createGameStore`가 **single-step 경로**에서도 1:1 재사용 가능함을 신규 2게임으로 검증한다. Mines(multi-step) 검증과 합쳐 셸의 양쪽 분기가 모두 GREEN.

## 2. 선정 근거

- **Limbo**: Crash와 동일한 PF 스택(`bytesGenerator`)을 1바이트 stream으로 재사용. `99/(1-u)` 단일 공식 → 엔진 ≈ 30줄, 결정성/경계 테스트 직관적.
- **Wheel**: 가중 세그먼트 lookup 패턴. RTP 99% 테이블이 9 조합으로 닫혀 있어 평균 ±0.5% 검증이 단순. SVG 회전 1회만 있는 single-step에 적합.
- HiLo/Roulette/Keno는 multi-step·다중 추첨·테이블 UX로 비대칭 → P3~P5로 분리.

## 3. 패턴 (MinesScreen single-step 채택)

- `useGameRound({ rollingMs, settledMs })` — single-step 분기
- `GameShell` 슬롯 주입(header/rulesCard/historyStrip/displayArea/controls/summaryPanel/banner/betPanel)
- `liveBetsStore.push/update`, Provably Fair 모달, `liveBetsFeed` GameShell 바깥
- 영속 데이터만 store, 임시 phase는 훅 내부
- 정산 = `houseEdge.profitOf(bet, mult, mode)` 이중 RTP (엔진 99% × 모드 0.97)

## 4. Cursor 이관

- `LimboEngine.computeCrashPoint` / `WheelEngine.spin` → Edge Function 위임 가능. 본 엔진은 검증용으로 재사용.
- Supabase·walletStore·types.ts 미수정.

## 5. 검증

- baseline 57 GREEN → 57 + 12 (limbo 6 + wheel 6) = **69 GREEN**
- `bun run lint:strict && bun run check`
- 수동: Dice/Crash/Mines/Plinko 회귀 0, Limbo/Wheel 베팅 → 새로고침 복원, 390×844 무스크롤
