create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('bank', 'broker', 'custom')),
  icon_mode text not null check (icon_mode in ('predefined', 'custom')),
  icon_key text,
  icon_url text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint institutions_user_name_unique unique (user_id, name)
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('bank', 'investment')),
  currency text not null default 'EUR' check (currency = 'EUR'),
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounts_user_name_unique unique (user_id, name)
);

create table if not exists public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  snapshot_date date not null,
  value_eur numeric(14, 2) not null check (value_eur >= 0),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint account_snapshots_user_unique unique (user_id, account_id, snapshot_date)
);

create table if not exists public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  symbol text,
  current_value_eur numeric(14, 2) not null check (current_value_eur >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint investment_positions_user_unique unique (user_id, account_id, name)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('total', 'bank', 'investment')),
  target_eur numeric(14, 2) not null check (target_eur >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint goals_user_category_unique unique (user_id, category)
);

create trigger accounts_set_updated_at
before update on public.accounts
for each row
execute procedure public.set_updated_at();

create trigger account_snapshots_set_updated_at
before update on public.account_snapshots
for each row
execute procedure public.set_updated_at();

create trigger investment_positions_set_updated_at
before update on public.investment_positions
for each row
execute procedure public.set_updated_at();

create trigger goals_set_updated_at
before update on public.goals
for each row
execute procedure public.set_updated_at();

alter table public.institutions enable row level security;
alter table public.accounts enable row level security;
alter table public.account_snapshots enable row level security;
alter table public.investment_positions enable row level security;
alter table public.goals enable row level security;

create policy "institutions_select_own"
on public.institutions
for select
using (auth.uid() = user_id);

create policy "institutions_insert_own"
on public.institutions
for insert
with check (auth.uid() = user_id);

create policy "institutions_update_own"
on public.institutions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "institutions_delete_own"
on public.institutions
for delete
using (auth.uid() = user_id);

create policy "accounts_select_own"
on public.accounts
for select
using (auth.uid() = user_id);

create policy "accounts_insert_own"
on public.accounts
for insert
with check (auth.uid() = user_id);

create policy "accounts_update_own"
on public.accounts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "accounts_delete_own"
on public.accounts
for delete
using (auth.uid() = user_id);

create policy "snapshots_select_own"
on public.account_snapshots
for select
using (auth.uid() = user_id);

create policy "snapshots_insert_own"
on public.account_snapshots
for insert
with check (auth.uid() = user_id);

create policy "snapshots_update_own"
on public.account_snapshots
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "snapshots_delete_own"
on public.account_snapshots
for delete
using (auth.uid() = user_id);

create policy "positions_select_own"
on public.investment_positions
for select
using (auth.uid() = user_id);

create policy "positions_insert_own"
on public.investment_positions
for insert
with check (auth.uid() = user_id);

create policy "positions_update_own"
on public.investment_positions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "positions_delete_own"
on public.investment_positions
for delete
using (auth.uid() = user_id);

create policy "goals_select_own"
on public.goals
for select
using (auth.uid() = user_id);

create policy "goals_insert_own"
on public.goals
for insert
with check (auth.uid() = user_id);

create policy "goals_update_own"
on public.goals
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "goals_delete_own"
on public.goals
for delete
using (auth.uid() = user_id);
