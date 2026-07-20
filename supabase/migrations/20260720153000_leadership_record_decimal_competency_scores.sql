alter table public.development_record_competencies
  alter column baseline_score type numeric(4,2)
    using baseline_score::numeric(4,2),
  alter column target_score type numeric(4,2)
    using target_score::numeric(4,2),
  alter column current_score type numeric(4,2)
    using current_score::numeric(4,2),
  alter column improvement type numeric(4,2)
    using improvement::numeric(4,2),
  alter column gap_remaining type numeric(4,2)
    using gap_remaining::numeric(4,2);

alter table public.development_record_competencies
  drop constraint if exists development_record_competencies_baseline_score_check,
  drop constraint if exists development_record_competencies_target_score_check,
  drop constraint if exists development_record_competencies_current_score_check;

alter table public.development_record_competencies
  add constraint development_record_competencies_baseline_score_check
    check (baseline_score >= 1 and baseline_score <= 5),
  add constraint development_record_competencies_target_score_check
    check (target_score >= 1 and target_score <= 5),
  add constraint development_record_competencies_current_score_check
    check (current_score is null or (current_score >= 1 and current_score <= 5));
