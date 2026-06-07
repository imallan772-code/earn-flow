# ADR: No Default Loss / Consecutive-Loss Caps

**Date**: 2026-06-08  
**Status**: Accepted  
**Scope**: GA-J auto-bet, Region-Aware safety profiles, `user_settings`

## Context

v3 FINAL §13 originally specified forced defaults:

- Daily loss cap: 50% of starting bankroll
- Consecutive loss cap: 10 rounds (no unlimited)

Stake/Rollbit-style platforms often use opt-in limits. For PHONARA:

- Korean market messaging favors **user-controlled** responsible gambling
- Forced caps can frustrate power users and create support friction
- Regulatory posture: **opt-in limits** + mandatory consent checkbox is sufficient for launch

## Decision

1. **`daily_loss_limit_phon` and `max_consecutive_losses` default to NULL** (no cap).
2. Users may **opt in** via settings before starting server auto-bet (GA-J).
3. When set, bounds apply: loss pct 1–99% (100% forbidden), consecutive 1–100 (unlimited forbidden).
4. **`daily_round_limit` default 10,000** remains (operational protection, not bankroll cap).
5. Region-Aware profiles (`safety_tier`, `region`) may **recommend** limits in UI but must not silently enforce caps without explicit user consent.

## Consequences

- GA-J worker checks limits only when non-NULL in `user_settings`.
- Marketing: "PHONARA — limits you choose, not limits we impose."
- v3 FINAL §3 GA-J, §13, §14 updated to match this ADR.

## Alternatives Rejected

- **Forced 50%/10 defaults**: rejected — conflicts with product positioning and user trust.
- **Unlimited everything including rounds**: rejected — `daily_round_limit` stays for infra protection.
