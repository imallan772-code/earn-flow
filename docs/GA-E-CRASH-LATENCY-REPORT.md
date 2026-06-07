# GA-E Crash Latency Report

Generated: 2026-06-07T16:18:25.211Z

| RPC | Phase | n | p50 (ms) | p95 (ms) | p99 (ms) | min | max |
|-----|-------|---|----------|----------|----------|-----|-----|
| crash_place_v1 | cold | 1 | 202.9 | 202.9 | 202.9 | 202.9 | 202.9 |
| crash_start_running_v1 | cold | 1 | 178.5 | 178.5 | 178.5 | 178.5 | 178.5 |
| crash_sync_v1 | warm | 100 | 174.7 | 437.1 | 689.5 | 148.0 | 724.8 |
| crash_sync_v1 | cold | 1 | 173.2 | 173.2 | 173.2 | 173.2 | 173.2 |
| crash_cashout_v1 | cold | 1 | 261.4 | 261.4 | 261.4 | 261.4 | 261.4 |
| resolve_user_mode_v1 | cold | 1 | 294.5 | 294.5 | 294.5 | 294.5 | 294.5 |

## Targets (plan v3)
- Warm p95 < 150ms
- Cold p95 < 250ms
- Cold p99 < 400ms

**Result:** REVIEW
