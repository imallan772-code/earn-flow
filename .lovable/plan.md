## 미반영 작업 적용 계획

이전에 제안만 되고 아직 반영되지 않은 3가지를 마저 적용합니다.

### 1) `src/features/landing/Landing.tsx` — Hero 카피 정리
- 문구 변경:  
  기존: `한국 {LiveNumber 1,012만+ 명}이 매일 출석·미션·게임으로 PHON을 모아 KRW/USDT로 인출합니다. 가입 즉시 {LiveNumber 1,800 PHON}.`
  →  
  신규: `글로벌 매일 출석·미션·게임으로 PHON을 모아 KRW/USDE로 인출합니다. 가입 즉시 5,000 PHON+`
- 본문 안의 두 `LiveNumber` 제거 (밑의 hero stat 카드와 중복). "5,000 PHON+"는 정적 텍스트.
- 158줄 `한국 운영팀 직접 운영` → `글로벌 운영팀 24/7 운영`

### 2) `src/shared/layout/LiveCashoutStrip.tsx` — 라벨 변경
- `실시간 캐시아웃 · {…천 명 접속 중}` →  
  `실시간 캐시아웃 · {LiveNumber 5,290,000원 완료!}`
- `LiveNumber` 파라미터: `base=5_290_000, amplitudeRatio=0.015, bias=0.5, intervalMs=3000`, format은 `{KO.format(round(n))}원 완료!`
- `fomo.ts`에 `MOCK_REALTIME_CASHOUT_KRW = 5_290_000` 추가하고 import.

### 3) `src/mocks/fomo.ts` — 글로벌 + 한국 닉네임 혼용
전 세계 사용자가 쓰는 느낌으로 한국 성과 해외 성을 섞어 배치.

- `MOCK_CASHOUT_FEED` (8개, 한국 4 + 글로벌 4 혼용):
  - `김**` → `Kim***` (한국)
  - `박**수` → `Sato***` (일본)
  - `이**` → `Lee***` (한국)
  - `최**경` → `Müller***` (독일)
  - `정**` → `João***` (브라질)
  - `강**` → `Kang***` (한국)
  - `윤**호` → `Nguyen***` (베트남)
  - `조**` → `Wang***` (중국)
  추가로 한국 성 1개 더 보강: `c4`를 `최**경` → `Choi***`로 유지(한국 성 유지), 위 매핑 중 `Müller***`는 `Choi***`로 대체하여 한국 4 / 글로벌 4 균형.
  최종: Kim***, Sato***, Lee***, Choi***, João***, Kang***, Nguyen***, Wang***.

- `MOCK_MARQUEE_ROWS` 한국 이름 등장 행 혼용 교체:
  - m1 `김**` → `Park***`
  - m3 `박**` → `Tanaka***`
  - m5 `이**` → `Lee***`
  - m8 `최**` → `Ivanov***`
  - m11 `정**` → `Jeong***`
- m6의 `1,012만+ 명` → `1,005만+ 명` (현재 동기화 값과 일치)
- m12 `🇰🇷 한국 사용자 1,012만+ 돌파` → `🌍 전 세계 사용자 1,000만+ 돌파`

### 변경 없음
- LiveNumber/liveOnlineStore 로직, RTP/지갑/게임 로직, 150% 보너스 값, hero stat 3카드 구조, 라우팅.

### 영향 파일
- `src/features/landing/Landing.tsx`
- `src/shared/layout/LiveCashoutStrip.tsx`
- `src/mocks/fomo.ts`
