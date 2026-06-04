# Plinko Renderer + Board 생성 계획 (v5.1 — 확정)

## 강제 규칙
- LOVABLE_WORK_RULES.md 모든 규칙 준수
- PlinkoEngine.ts import (MULTIPLIERS 사용)
- persistedGameState.ts 수정 금지
- GameShell/useGameRound 미구현 → 임시 useState 구조
- useEffect deps: mount용 `[]` + quality/rows/risk 변경용만 허용

## 생성 파일 (2개)
- `src/shared/games/plinko/PlinkoRenderer.ts`
- `src/shared/games/plinko/PlinkoBoard.tsx`

작업 직전 확인: `PlinkoEngine.ts`에서 `MULTIPLIERS` 9개 테이블이 실제로 채워져 있는지 grep 1회 (비어있으면 `Math.max(...)`가 `-Infinity` → 색상 정규화 깨짐).

---

## 1. PlinkoRenderer.ts (Canvas 2D)

### Public API
```ts
export type QualityLevel = "low"|"medium"|"high";
export interface PlinkoRendererOptions { quality?: QualityLevel; rows?: 8|12|16; risk?: RiskLevel }
export class PlinkoRenderer {
  constructor(canvas: HTMLCanvasElement, opts?: PlinkoRendererOptions);
  setQuality(q: QualityLevel): void;   // 진행 중이면 pendingQuality에 defer
  setRows(rows: 8|12|16): void;
  setRisk(risk: RiskLevel): void;
  resize(width: number, height: number, dpr: number): void;
  playDrop(result: PlinkoDropResult, engine: PlinkoEngine,
           onLand?: (slot:number, multiplier:number)=>void): void;
  stop(): void;
  destroy(): void;
}
```

### 핵심 구현
- **3-Layer**: static (peg/slot), dynamic (ball/trail), fx (particle/pop) — 모두 offscreen canvas
- **Dirty Rendering**: `isAnimating()` = `sampleCursor < end || popAnim.active || particles.some(alive)`. false면 `rafId=null` 후 return → idle CPU 0
- **Quality 단계**
  - low: 평면 도형, particle pool size 0
  - medium: trail 8샘플, bounce flash, pool 24
  - high: trail 24샘플, radial gradient, shadow, glow, pool 96
- **pendingQuality defer**: `setQuality()` 호출 시 `isAnimating()`이면 `pendingQuality = q`, rAF 루프 종료 직전 apply
- **MAX_MULT_TABLE 자동 derive**:
  ```ts
  import { MULTIPLIERS } from "./PlinkoEngine";
  // 9개 (risk × rows) 조합에 대해 Math.max(...MULTIPLIERS[risk][rows])
  ```
  슬롯 색상은 `mult / MAX[risk][rows]` 정규화
- **Sample**: `{x, y, vy, progress, pegRow?}`. progress가 `(pegRow+1)/(rows+1)` cross 시 pegRow 마킹
- **재생**: `performance.now()` 기반 1200ms 고정, lerp 보간. progress=1.0 자연 도달 보장
- **DPR**: `resize(w, h, dpr)` 안에서 canvas backing store = w*dpr × h*dpr, ctx.setTransform로 dpr 스케일
- **헤더 주석**: 역할 / React·DOM 이벤트 0 / WebGL 이식성 / `// TODO: Real money — WebGL2 교체 시 인터페이스 유지`

---

## 2. PlinkoBoard.tsx (임시 인라인)

### Props
```ts
// TODO: Round G Part 1 완료 후 GameShell + useGameRound + plinkoStore로 마이그레이션
// 현재는 임시 useState. persistedGameState.ts 수정 금지.
// mode는 부모 라우트(useMode())에서 prop으로 주입. 내부 useState 금지.
export interface PlinkoBoardProps { mode: "demo" | "real" }
export function PlinkoBoard({ mode }: PlinkoBoardProps) { ... }
```

### State & Refs
```ts
const [phase, setPhase] = useState<"idle"|"rolling"|"settled">("idle");
const [balance, setBalance] = useState(1000);
const [nonce, setNonce] = useState(0);
const [history, setHistory] = useState<{id:string;multiplier:number;slot:number}[]>([]);
const [rows, setRows] = useState<8|12|16>(16);
const [risk, setRisk] = useState<RiskLevel>("medium");
const [pendingAmount, setPendingAmount] = useState(10);
const [lastOutcome, setLastOutcome] = useState<{outcome:"win"|"loss";profit:number;nonce:number}|null>(null);

const canvasRef = useRef<HTMLCanvasElement>(null);
const wrapRef = useRef<HTMLDivElement>(null);
const engineRef = useRef<PlinkoEngine | null>(null);
const rendererRef = useRef<PlinkoRenderer | null>(null);
const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

### Engine lazy init (useRef + useEffect 패턴 — React 19 strict mode 안전)
```ts
// React 19 strict mode 대비: useMemo 대신 useRef + useEffect로 lazy init.
// strict mode에서 effect는 두 번 실행되지만 if-guard로 중복 생성 차단.
useEffect(() => {
  if (!engineRef.current) engineRef.current = new PlinkoEngine();
}, []);
```

### Renderer Mount (deps `[]` 강제)
```ts
// CRITICAL: deps는 []. quality/rows/risk를 절대 추가하지 말 것.
// 위반 시 매 토글마다 Canvas context leak + freeze.
// quality/rows/risk 변경 반영은 아래 별도 useEffect 3개의 set* 호출로만 처리.
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  if (!engineRef.current) engineRef.current = new PlinkoEngine(); // 위 effect보다 먼저 도달할 수 있어 방어
  rendererRef.current = new PlinkoRenderer(canvas, {
    quality: mode === "real" ? "high" : "medium",
    rows, risk,
  });
  return () => {
    if (settleTimerRef.current) { clearTimeout(settleTimerRef.current); settleTimerRef.current = null; }
    rendererRef.current?.destroy();
    rendererRef.current = null;
  };
}, []);
```

### 동기화 useEffect 3개 (주석 명시 필수)
```ts
// mode 변경 시 즉시 renderer.setQuality 호출. 진행 중이면 Renderer 내부에서 pendingQuality로 defer.
useEffect(() => { rendererRef.current?.setQuality(mode === "real" ? "high" : "medium"); }, [mode]);
// rows 변경 시 static layer 재빌드 (slot/peg 좌표 재계산).
useEffect(() => { rendererRef.current?.setRows(rows); }, [rows]);
// risk 변경 시 슬롯 색상 정규화 재계산.
useEffect(() => { rendererRef.current?.setRisk(risk); }, [risk]);
```

### ResizeObserver (rAF coalesce + 0×0 가드)
```ts
useEffect(() => {
  const el = wrapRef.current; if (!el) return;
  let rafId = 0;
  const flush = () => {
    rafId = 0;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    rendererRef.current?.resize(rect.width, rect.height, window.devicePixelRatio || 1);
  };
  const observer = new ResizeObserver(() => { if (!rafId) rafId = requestAnimationFrame(flush); });
  observer.observe(el);
  flush();
  return () => { observer.disconnect(); if (rafId) cancelAnimationFrame(rafId); };
}, []);
```

### Place & Landing
```ts
const handlePlace = (amount: number) => {
  if (phase !== "idle" || amount <= 0 || amount > balance) return;
  setBalance(b => b - amount);
  setPendingAmount(amount);
  setPhase("rolling");
  const seed = `phonara-plinko-${nonce}`;
  // TODO: Real money — engine.dropPath를 Supabase Edge Function RPC로 위임
  const result = engineRef.current!.dropPath(seed, rows, risk);
  rendererRef.current!.playDrop(result, engineRef.current!, onLand);
};

const onLand = (slot: number, multiplier: number) => {
  const won = multiplier >= 1;
  const profit = won ? pendingAmount * (multiplier - 1) : -pendingAmount;
  if (won) setBalance(b => b + pendingAmount * multiplier);
  setHistory(h => [{id:`n${nonce}`, multiplier, slot}, ...h].slice(0, 30));
  setLastOutcome({ outcome: won ? "win":"loss", profit, nonce });
  setPhase("settled");
  if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  settleTimerRef.current = setTimeout(() => {
    setPhase("idle"); setNonce(n => n + 1); settleTimerRef.current = null;
  }, 800);
};
```

### 레이아웃 (390×844 무스크롤)
- 컨테이너: `h-[100dvh] pb-[env(safe-area-inset-bottom)] flex flex-col`
- Header 36 / History 28 / **Canvas wrap `flex-1 min-h-0 max-h-[420px]`** / Risk·Rows 세그먼트 44 / BetSummary 56 / StakeBetPanel compact 88
- SE 대응: `max-h-[min(420px,calc(100dvh-260px))]`

---

## 변경 범위
- 신규 2개. 외부 파일 수정/삭제/의존성 추가 0.
- 라우트 등록(`/games/plinko`) 및 `useMode()` 연결은 별도 라운드.

## 검증
- TS strict GREEN
- Dice/Crash 회귀 0
- idle CPU 0 확인
- 8/12/16 × low/medium/high risk × low/medium/high quality 동작
- mode 토글 → quality 즉시 반영 (진행 중이면 defer)
- 라우트 전환 직후 검은 화면 없음 (0×0 가드)
- 라운드 중 unmount 시 setState-after-unmount 경고 없음
- React 19 strict mode double-invoke에서 PlinkoEngine 중복 생성 없음

## 완료 보고
> "PlinkoRenderer.ts와 PlinkoBoard.tsx가 Canvas 2D 지존급으로 완료되었습니다. Dirty Rendering + 3단계 성능 모드 + 고품질 시각 효과 + ResizeObserver rAF coalesce 적용."
