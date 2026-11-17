-- Run this in the Supabase SQL Editor to enable shared, real-time submissions.
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  prompt_id text not null check (prompt_id in ('message','sound','portrait','human','future')),
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.contributions enable row level security;

create policy "Anyone can read contributions"
  on public.contributions for select
  to anon, authenticated using (true);

create policy "Anyone can submit a contribution"
  on public.contributions for insert
  to anon, authenticated with check (
    char_length(trim(name)) between 1 and 40 and
    char_length(trim(message)) between 1 and 300 and
    prompt_id in ('message','sound','portrait','human','future')
  );

-- Enable Realtime for the public archive.
alter publication supabase_realtime add table public.contributions;
