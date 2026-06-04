# PlinkoEngine.ts 생성 계획

## 목표
`src/shared/games/plinko/PlinkoEngine.ts` 단 1개 파일을 생성한다. Provably Fair 결정론 + 순수 물리 시뮬레이션을 모두 포함하는 클래스 기반 엔진. 다른 파일은 일절 수정/생성하지 않는다.

## 핵심 설계

### 1) Provably Fair 결정론 (zero-import)
- `hashSeed(input)` → FNV-1a 32bit (프로젝트 `hashStringToSeed`와 동일 알고리즘, 본 파일에 인라인)
- Mulberry32 PRNG → rows번 draw, `< 0.5` ? left(0) : right(1)
- 같은 (seed, rows, risk) → 항상 동일 결과

### 2) 좌/우 확률
- low/medium/high 모두 50:50. **위험도는 배수 테이블이 결정** (Stake 방식, Pascal 분포)

### 3) 배수 테이블 (Stake.com 1:1, 좌우 대칭, length = rows+1)
- 8/12/16 rows × low/medium/high = 9개 상수
- 16 rows high: 양끝 1000x, 중앙 0.2x

### 4) `dropPath(seed, rows, risk?='medium')`
- rows ∉ {8,12,16} → throw
- 반환: `{ path, finalSlot, multiplier, totalRows, risk, seed }`
- finalSlot = path 내 1의 개수

### 5) `simulatePhysics(result, onUpdate)`
- 정규화 좌표 0..1, 순수 산술 루프 (setTimeout/rAF 금지)
- gravity, bounce, friction, peg nudge 적용
- 각 row 도달 시 `result.path[row]`에 따라 좌/우 보정 → 결과 보장
- `onUpdate(x, y, vy)` 콜백으로 step 샘플 emit, 호출자가 rAF로 소비
- MAX_STEPS 안전 가드

### 6) 파일 헤더
- 역할 / 순수성 규약 / Web Worker 이식 가능
- Real money TODO: dropPath → Supabase Edge Function 권위 이관, 서버 배수 테이블 검증, 감사 레코드

## 변경 범위
- 신규: `src/shared/games/plinko/PlinkoEngine.ts` (1개)
- 수정/삭제/의존성: 없음

## 검증
- TS strict 빌드 통과
- 동일 입력 → 동일 출력 (결정론)
- path.length === rows, finalSlot ∈ [0, rows], multiplier > 0
- rows ∉ {8,12,16} → throw

## 완료 보고
> "PlinkoEngine.ts 생성이 완료되었습니다. Provably Fair + 순수 물리 엔진 구현."
