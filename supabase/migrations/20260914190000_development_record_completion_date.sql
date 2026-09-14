alter table public.development_records
  add column if not exists completion_date date;

comment on column public.development_records.completion_date is
  'Actual project completion date entered by the mentor. Historical dates remain unknown until recorded.';
