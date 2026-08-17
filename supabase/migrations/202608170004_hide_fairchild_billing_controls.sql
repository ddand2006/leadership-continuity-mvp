alter table public.organizations
add column if not exists hide_billing_controls boolean not null default false;

update public.organizations
set hide_billing_controls = true
where lower(trim(name)) = 'fairchild medical center';
