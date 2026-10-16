-- Consent, goals, and evidence changes invalidate every cached aggregate scope.
-- An explicit primary-key predicate preserves that behavior under pg_safeupdate,
-- which rejects an unqualified DELETE in hosted Data API transactions.
create or replace function coaching_scale_internal.invalidate_privacy()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 delete from coaching_scale_snapshots where id is not null;
 update coach_quality_metrics set privacy_valid=false
 where metric_type in ('goal_progress_rate','development_milestone_rate');
 return null;
end $$;
