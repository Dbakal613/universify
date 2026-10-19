begin;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'course_class_sessions'
      and column_name = 'class_date'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'course_class_sessions'
      and column_name = 'session_date'
  ) then
    alter table public.course_class_sessions
    rename column class_date to session_date;
  end if;
end
$$;

alter table public.course_class_sessions
add column if not exists updated_at timestamptz not null default now();

alter table public.attendance_records
add column if not exists course_class_session_id uuid
references public.course_class_sessions(id) on delete restrict;

alter table public.attendance_records
add column if not exists updated_at timestamptz not null default now();

alter table public.attendance_records
drop constraint if exists attendance_records_status_check;

alter table public.attendance_records
add constraint attendance_records_status_check
check (status in ('present', 'attended', 'absent', 'justified', 'cancelled'));

create or replace function public.validate_attendance_session_link()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  linked_session public.course_class_sessions%rowtype;
begin
  if new.course_class_session_id is null then
    return new;
  end if;

  select * into linked_session
  from public.course_class_sessions
  where id = new.course_class_session_id;

  if not found
    or linked_session.course_id <> new.course_id
    or linked_session.session_date <> new.class_date then
    raise exception 'Attendance session must match course and class date';
  end if;

  if linked_session.status = 'cancelled' then
    raise exception 'Attendance cannot be recorded for a cancelled session';
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_records_validate_session
on public.attendance_records;

create trigger attendance_records_validate_session
before insert or update of course_id, class_date, course_class_session_id
on public.attendance_records
for each row
execute function public.validate_attendance_session_link();

-- A normal unique index still allows multiple NULL session ids for legacy rows,
-- while giving PostgREST an unambiguous conflict target for atomic upserts.
create unique index if not exists attendance_records_user_session_unique_idx
on public.attendance_records(user_id, course_class_session_id);

create index if not exists attendance_records_session_id_idx
on public.attendance_records(course_class_session_id);

grant select, insert, update, delete
on table public.course_class_sessions, public.attendance_records
to authenticated;

commit;
