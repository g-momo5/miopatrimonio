create table if not exists public.monthly_cashflow_recurring_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  entry_type text not null check (entry_type in ('income', 'invested')),
  amount_eur numeric(14, 2) not null check (amount_eur >= 0),
  day_of_month int not null check (day_of_month between 1 and 31),
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recurring_templates_user_name_type_unique unique (user_id, name, entry_type)
);

create table if not exists public.monthly_cashflow_recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.monthly_cashflow_recurring_templates(id) on delete cascade,
  month_date date not null,
  due_date date not null,
  status text not null check (status in ('pending', 'confirmed', 'skipped')),
  confirmed_entry_id uuid references public.monthly_cashflow_entries(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recurring_occurrences_month_start_check
    check (month_date = date_trunc('month', month_date)::date),
  constraint recurring_occurrences_unique unique (user_id, template_id, month_date)
);

create trigger monthly_cashflow_recurring_templates_set_updated_at
before update on public.monthly_cashflow_recurring_templates
for each row
execute procedure public.set_updated_at();

create trigger monthly_cashflow_recurring_occurrences_set_updated_at
before update on public.monthly_cashflow_recurring_occurrences
for each row
execute procedure public.set_updated_at();

alter table public.monthly_cashflow_recurring_templates enable row level security;
alter table public.monthly_cashflow_recurring_occurrences enable row level security;

create policy "cashflow_recurring_templates_select_own"
on public.monthly_cashflow_recurring_templates
for select
using (auth.uid() = user_id);

create policy "cashflow_recurring_templates_insert_own"
on public.monthly_cashflow_recurring_templates
for insert
with check (auth.uid() = user_id);

create policy "cashflow_recurring_templates_update_own"
on public.monthly_cashflow_recurring_templates
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "cashflow_recurring_templates_delete_own"
on public.monthly_cashflow_recurring_templates
for delete
using (auth.uid() = user_id);

create policy "cashflow_recurring_occurrences_select_own"
on public.monthly_cashflow_recurring_occurrences
for select
using (auth.uid() = user_id);

create policy "cashflow_recurring_occurrences_insert_own"
on public.monthly_cashflow_recurring_occurrences
for insert
with check (auth.uid() = user_id);

create policy "cashflow_recurring_occurrences_update_own"
on public.monthly_cashflow_recurring_occurrences
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "cashflow_recurring_occurrences_delete_own"
on public.monthly_cashflow_recurring_occurrences
for delete
using (auth.uid() = user_id);
