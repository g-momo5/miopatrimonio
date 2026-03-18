alter table public.institutions
  add column if not exists logo_scale numeric(6, 3) not null default 1,
  add column if not exists logo_offset_x numeric(7, 3) not null default 0,
  add column if not exists logo_offset_y numeric(7, 3) not null default 0;

with ranked as (
  select
    id,
    user_id,
    icon_key,
    first_value(id) over (
      partition by user_id, icon_key
      order by created_at asc, id asc
    ) as keep_id
  from public.institutions
  where icon_key is not null
),
relinked_accounts as (
  update public.accounts as account
  set institution_id = ranked.keep_id
  from ranked
  where account.institution_id = ranked.id
    and ranked.id <> ranked.keep_id
  returning account.id
)
delete from public.institutions as institution
using ranked
where institution.id = ranked.id
  and ranked.id <> ranked.keep_id;

create unique index if not exists institutions_user_icon_key_unique
on public.institutions (user_id, icon_key)
where icon_key is not null;
