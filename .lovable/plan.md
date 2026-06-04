## Plinko 끝판왕 — Visual + Audio + Feedback Total Overhaul

**원칙**: Engine(결과 산출)·Board(상태/회계) 비변경. 오직 **렌더러 + 신규 SFX 레이어 + 잭팟 오버레이**만 손댄다. 결정론적 결과·하우스엣지·더블탭 가드 그대로.

---

### 1. PlinkoRenderer.ts — 시각 폴리시 풀스택

**1-1. 보드 배경 (정적 레이어)**
- 중앙 비네팅 라디얼 글로우 (배율 색에 따라 hue shift)
- 미세 grid 텍스처 (1px stroke, opacity 0.04)
- 보드 외곽 inner shadow → "유리 상자에 박힌" 느낌

**1-2. 핀(peg) 업그레이드**
- 단색 원 → **라디얼 그라데이션 (top-left 하이라이트 + 우하단 그림자)**
- 1px 림 라이트 + 0.5px dark stroke → 유리구슬 입체감
- 공이 근접한 핀(거리 < 24px)은 일시적으로 **밝아짐 + ring pulse** (heat trail)

**1-3. 공(ball) 업그레이드**
- 메탈릭 라디얼 그라데이션 (silver → blue tint)
- 8px 골드 글로우 halo (배율 따라 색 변화)
- 모션 트레일: 기존 dot trail → **그라데이션 streak (속도 비례 길이)**
- 핀 충돌 순간 squash (수직 0.85x · 수평 1.15x) — 2 프레임

**1-4. 슬롯 업그레이드**
- 평면 사각형 → **3D 베벨 (top highlight 1px + bottom shadow 2px)**
- 슬롯 내부 그라데이션 (위 어둡고 아래 슬롯 색)
- 착지 시 슬롯 자체가 0.92x scale로 눌렸다 복원 (300ms cubic out)
- 슬롯 하단에서 위로 올라오는 컬러 wave (배율 색)

**1-5. 핀 충돌 파티클 강화**
- 기존 cyan dot 3-6개 → **mini sparks (별 모양 + 짧은 streak)** 8개
- 큰 충돌(vy > 임계치)에서만 발화 → 시각적 노이즈 제어

**1-6. 착지 임팩트**
- 기존 48 파티클 → **3-layer 폭발**:
  - L1: 큰 슬롯 색 파티클 24개 (느림, 큼)
  - L2: 골드 스파크 16개 (빠름, 작음)
  - L3: 흰색 코어 플래시 (1프레임, radial blur)
- Canvas 자체에 **screen-space shake** (배율 ≥ 5x: 4px, ≥ 10x: 8px, 200ms decay)

**1-7. 잭팟 연출 (배율 ≥ MAX_MULT × 0.5)**
- 화면 전체 0.4초 골드 플래시 (composite operation 'screen')
- 보드 위 슬로우 골드 파티클 fountain (1.5초)
- 슬롯 자체가 흰색으로 풀 페인트 + 강한 글로우 펄스 3회

---

### 2. 신규 파일: `src/shared/games/plinko/PlinkoSFX.ts`

**WebAudio API 기반 (외부 dep 0)** — ElevenLabs 호출 없음, 모든 음 합성.

- `pegHit(velocity)` — 짧은 click (200Hz triangle + 1500Hz sine, 30ms decay)
- `ballRelease()` — woosh (white noise + lowpass sweep, 200ms)
- `landSound(multiplier)` — 배율 따라 톤 변화:
  - 손실(<1x): low thud (80Hz, 150ms)
  - 소형(1-2x): coin chime (E5 + G5, 250ms)
  - 중형(2-5x): triple chime (C5-E5-G5 arpeggio)
  - 대형(5x+): 잭팟 fanfare (5음 골드 글리산도 + bell)
- `setMuted(bool)` — 전역 토글
- AudioContext lazy init (첫 유저 제스처 후)

`PlinkoBoard`에서 mute 버튼 1개 추가 (헤더 우측, 🔊/🔇 아이콘).

---

### 3. PlinkoBoard.tsx — 잭팟 오버레이 & 햅틱

- 배율 ≥ MAX × 0.5 시 **풀스크린 오버레이**:
  - 중앙 거대 "{multiplier}x" 텍스트 (스프링 scale-in)
  - 골드 파티클 컨페티 (1.5초 후 자동 fade)
  - 사용자 클릭/탭하면 즉시 dismiss
- `navigator.vibrate` 호출 — 착지 시 [30] / 잭팟 [50, 30, 80] (모바일만)
- mute 상태 `localStorage` 영속화

---

### 4. 마이크로 인터랙션

- **위험도/행 전환**: 보드가 부드럽게 morph (300ms) — 기존 즉시 교체 대신
- **잔액 변화**: count-up 애니메이션 (이전→신규 400ms)
- **결과 카드**: 기존 작은 pill → 큰 배율 + "베팅 × 배율 = payout" 계산식 한 줄
- **히스토리 칩**: 새 항목 추가 시 좌측에서 slide-in + 우측 페이드 아웃

---

### 5. 품질 시스템 확장 (선택적, 자동)

`PlinkoRenderer.quality`에 자동 감지 추가:
- `requestIdleCallback` + FPS 추적, 50fps 미만 30프레임 연속 → quality 1단계 낮춤
- 모바일 (`window.innerWidth < 768`): 기본 "medium", 잭팟 효과는 유지

---

### 6. 변경 파일 요약

| 파일 | 변경 | 라인 |
|---|---|---|
| `PlinkoRenderer.ts` | 핀/공/슬롯/배경/파티클/잭팟/셰이크 전면 리워크 | ~600 → ~900 |
| `PlinkoSFX.ts` | **신규** WebAudio 합성 사운드 | 신규 ~180 |
| `PlinkoBoard.tsx` | mute 토글, 잭팟 오버레이, 햅틱, 계산식 결과 카드 | +~80 |
| `PlinkoEngine.ts` | **변경 없음** | 0 |
| `PlinkoScreen.tsx` | **변경 없음** | 0 |

### 비변경 보장
- `PlinkoEngine.dropPath` API 동일 → 결정론적 결과 그대로
- `PlinkoRenderer` public API (setQuality/setRows/setRisk/resize/playDrop/stop/destroy) 동일
- 회계 로직 (`amount × multiplier`, `rake 3%`) 그대로
- 더블탭 가드 (`placingRef`) 그대로

### Verification
- 16행 high risk 좌/우 끝 슬롯(잭팟) 강제 시드 → 잭팟 오버레이 + 셰이크 + fanfare 사운드
- 1.0x 슬롯 → 본전, 톤 다운된 thud, 오버레이 없음
- mute on → 사운드 0, 시각 효과 유지
- 자동베팅 30회 연속 → FPS drop 없음, 메모리 누수 없음
- iPhone SE 노스크롤 유지

---

### 한 번에 다 들어갑니다 (1 PR, ~600 line diff).
사운드는 ElevenLabs 합성 SFX 옵션도 있지만 **레이턴시(매 충돌 fetch 불가)·비용** 때문에 WebAudio 절차적 합성이 정답. 잭팟 fanfare 1곡만 ElevenLabs로 미리 생성해서 캐싱하는 옵션은 원하시면 추가 가능 — 일단 100% 로컬 합성으로 진행합니다.

진행해도 될까요?
