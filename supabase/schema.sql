-- ==========================================================================
-- مُخطّطي — مخطط قاعدة بيانات Supabase (جدول records موحّد + RLS + Trigger)
-- ==========================================================================

create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('task', 'need', 'event', 'prayer', 'setting', 'report')),
  id text not null check (char_length(id) between 1 and 120),
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) < 20480),
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  server_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);

create index if not exists idx_records_user_server_at
  on public.records (user_id, server_at);

-- تفعيل Row Level Security (RLS)
alter table public.records enable row level security;

-- منع وصول anon تماماً للجدول
revoke all on table public.records from anon;
grant select, insert, update, delete on table public.records to authenticated;

drop policy if exists "records_select_own" on public.records;
create policy "records_select_own"
  on public.records for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "records_insert_own" on public.records;
create policy "records_insert_own"
  on public.records for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "records_update_own" on public.records;
create policy "records_update_own"
  on public.records for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "records_delete_own" on public.records;
create policy "records_delete_own"
  on public.records for delete
  to authenticated
  using (user_id = auth.uid());

-- دالة و Trigger لحماية السجلات: يتجاهل التحديثات الأقدم ويختم server_at بوقت السيرفر الفعلي
create or replace function public.records_guard_fn()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'UPDATE') then
    if new.updated_at < old.updated_at then
      return old;
    end if;
  end if;
  new.user_id := coalesce(new.user_id, auth.uid());
  new.server_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_guard on public.records;
create trigger records_guard
  before insert or update on public.records
  for each row
  execute function public.records_guard_fn();

-- ==========================================================================
-- اختياري: جدولة إرسال التقرير اليومي عبر pg_cron + pg_net كل 10 دقائق
-- شغّل الأوامر التالية بعد استبدال <PROJECT_REF> و <YOUR_CRON_SECRET>:
-- ==========================================================================
/*
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'mukhattati-daily-report',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<YOUR_CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
*/
