-- GA-L fix: extend money_idempotency_ledger operation CHECK for v3 + refund ops.

ALTER TABLE public.money_idempotency_ledger
  DROP CONSTRAINT IF EXISTS money_idempotency_ledger_operation_check;

ALTER TABLE public.money_idempotency_ledger
  ADD CONSTRAINT money_idempotency_ledger_operation_check CHECK (operation IN (
    'debit_phon_for_bet_v2',
    'credit_phon_for_payout_v2',
    'refund_phon_for_bet_v2',
    'debit_phon_for_bet_v3',
    'credit_phon_for_payout_v3',
    'refund_phon_for_bet_v3'
  ));
