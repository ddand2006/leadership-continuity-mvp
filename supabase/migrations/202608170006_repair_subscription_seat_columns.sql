-- Repair production environments where the original subscription-seat migration
-- was recorded but the organization columns were not created.
alter table public.organizations
add column if not exists included_seats integer not null default 10,
add column if not exists additional_seat_packs integer not null default 0,
add column if not exists billing_provider text not null default 'manual',
add column if not exists stripe_customer_id text,
add column if not exists stripe_subscription_id text,
add column if not exists stripe_price_id text,
add column if not exists hide_billing_controls boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organizations_included_seats_check'
  ) then
    alter table public.organizations
      add constraint organizations_included_seats_check check (included_seats >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'organizations_additional_seat_packs_check'
  ) then
    alter table public.organizations
      add constraint organizations_additional_seat_packs_check check (additional_seat_packs >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'organizations_billing_provider_check'
  ) then
    alter table public.organizations
      add constraint organizations_billing_provider_check
        check (billing_provider in ('manual', 'stripe'));
  end if;
end
$$;

create unique index if not exists organizations_stripe_customer_id_idx
on public.organizations (stripe_customer_id)
where stripe_customer_id is not null;

create unique index if not exists organizations_stripe_subscription_id_idx
on public.organizations (stripe_subscription_id)
where stripe_subscription_id is not null;

update public.organizations
set hide_billing_controls = true
where lower(trim(name)) = 'fairchild medical center';
