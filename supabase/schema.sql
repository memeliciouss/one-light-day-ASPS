-- ONE LIGHT-DAY public transmission archive
-- Run this entire script once in Supabase Dashboard > SQL Editor > New query.

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  prompt_id text not null check (prompt_id in ('message','sound','portrait','human','future')),
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.contributions enable row level security;

-- Public visitors can read the archive and submit messages.
-- No public UPDATE or DELETE policy is created.
grant select, insert on public.contributions to anon, authenticated;

drop policy if exists "Anyone can read contributions" on public.contributions;
create policy "Anyone can read contributions"
  on public.contributions for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can submit a contribution" on public.contributions;
create policy "Anyone can submit a contribution"
  on public.contributions for insert
  to anon, authenticated
  with check (
    char_length(trim(name)) between 1 and 40
    and char_length(trim(message)) between 1 and 300
    and prompt_id in ('message','sound','portrait','human','future')
  );

-- Include old row values in DELETE events so the live archive can remove deleted entries.
alter table public.contributions replica identity full;

-- Add the table to Supabase Realtime only if it is not already present.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'contributions'
  ) then
    alter publication supabase_realtime add table public.contributions;
  end if;
end $$;
