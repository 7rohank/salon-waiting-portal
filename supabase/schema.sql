create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'queue_status') then
    create type public.queue_status as enum (
      'waiting',
      'in_service',
      'completed',
      'cancelled'
    );
  end if;
end $$;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  price_label text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_name_unique'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services add constraint services_name_unique unique (name);
  end if;
end $$;

create table if not exists public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text,
  service_id uuid references public.services(id) on delete set null,
  service_name text,
  stylist_name text default 'Any stylist',
  party_size integer not null default 1 check (party_size > 0),
  status public.queue_status not null default 'waiting',
  notes text,
  quoted_wait_minutes integer default 0 check (quoted_wait_minutes >= 0),
  position integer,
  checked_in_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists queue_entries_status_created_idx
  on public.queue_entries (status, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_queue_entries_updated_at on public.queue_entries;
create trigger set_queue_entries_updated_at
before update on public.queue_entries
for each row
execute function public.set_updated_at();

alter table public.services enable row level security;
alter table public.queue_entries enable row level security;

drop policy if exists "Services are readable" on public.services;
create policy "Services are readable"
on public.services for select
to anon, authenticated
using (true);

drop policy if exists "Queue is readable" on public.queue_entries;
create policy "Queue is readable"
on public.queue_entries for select
to anon, authenticated
using (true);

drop policy if exists "Guests can join queue" on public.queue_entries;
create policy "Guests can join queue"
on public.queue_entries for insert
to anon, authenticated
with check (status = 'waiting');

drop policy if exists "Staff can update queue" on public.queue_entries;
create policy "Staff can update queue"
on public.queue_entries for update
to anon, authenticated
using (true)
with check (status in ('waiting', 'in_service', 'completed', 'cancelled'));

insert into public.services (name, duration_minutes, price_label, sort_order)
values
  ('Haircut', 35, 'from $35', 1),
  ('Blow dry', 30, 'from $30', 2),
  ('Beard trim', 20, 'from $20', 3),
  ('Color consult', 50, 'from $85', 4),
  ('Hair spa', 45, 'from $60', 5)
on conflict (name) do update set
  duration_minutes = excluded.duration_minutes,
  price_label = excluded.price_label,
  sort_order = excluded.sort_order,
  active = true;
