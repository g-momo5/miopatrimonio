create table if not exists public.monthly_cashflow_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  entry_type text not null check (entry_type in ('income', 'invested')),
  amount_eur numeric(14, 2) not null check (amount_eur >= 0),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger monthly_cashflow_entries_set_updated_at
before update on public.monthly_cashflow_entries
for each row
execute procedure public.set_updated_at();

alter table public.monthly_cashflow_entries enable row level security;

create policy "cashflow_entries_select_own"
on public.monthly_cashflow_entries
for select
using (auth.uid() = user_id);

create policy "cashflow_entries_insert_own"
on public.monthly_cashflow_entries
for insert
with check (auth.uid() = user_id);

create policy "cashflow_entries_update_own"
on public.monthly_cashflow_entries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "cashflow_entries_delete_own"
on public.monthly_cashflow_entries
for delete
using (auth.uid() = user_id);
