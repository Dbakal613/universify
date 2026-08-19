begin;

create table if not exists public.course_class_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  session_date date not null,
  start_time time,
  end_time time,
  room text,
  topics text,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'cancelled')
  ),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time is null or end_time is null or start_time < end_time)
);

alter table public.course_class_sessions
add column if not exists topics text;

create unique index if not exists course_class_sessions_timed_identity_idx
on public.course_class_sessions(course_id, session_date, start_time)
where start_time is not null;

create unique index if not exists course_class_sessions_untimed_identity_idx
on public.course_class_sessions(course_id, session_date)
where start_time is null;

create index if not exists course_class_sessions_course_date_idx
on public.course_class_sessions(course_id, session_date);

alter table public.attendance_records
add column if not exists course_class_session_id uuid;

alter table public.attendance_records
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attendance_records_course_class_session_id_fkey'
      and conrelid = 'public.attendance_records'::regclass
  ) then
    alter table public.attendance_records
    add constraint attendance_records_course_class_session_id_fkey
    foreign key (course_class_session_id)
    references public.course_class_sessions(id)
    on delete restrict;
  end if;
end
$$;

alter table public.attendance_records
drop constraint if exists attendance_records_status_check;

alter table public.attendance_records
add constraint attendance_records_status_check
check (status in ('present', 'attended', 'absent', 'justified', 'cancelled'));

alter table public.attendance_records
drop constraint if exists attendance_records_course_id_user_id_class_date_key;

create unique index if not exists attendance_records_legacy_identity_idx
on public.attendance_records(course_id, user_id, class_date)
where course_class_session_id is null;

create unique index if not exists attendance_records_session_identity_idx
on public.attendance_records(user_id, course_class_session_id)
where course_class_session_id is not null;

create index if not exists attendance_records_session_id_idx
on public.attendance_records(course_class_session_id);

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

alter table public.course_class_sessions enable row level security;

drop policy if exists "course class sessions through own course"
on public.course_class_sessions;

create policy "course class sessions through own course"
on public.course_class_sessions
for all
to authenticated
using (
  exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = course_class_sessions.course_id
      and semesters.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = course_class_sessions.course_id
      and semesters.user_id = auth.uid()
  )
);

drop policy if exists "attendance own data"
on public.attendance_records;

drop policy if exists "attendance through own course and session"
on public.attendance_records;

create policy "attendance through own course and session"
on public.attendance_records
for all
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = attendance_records.course_id
      and semesters.user_id = auth.uid()
  )
  and (
    course_class_session_id is null
    or exists (
      select 1
      from public.course_class_sessions
      where course_class_sessions.id = attendance_records.course_class_session_id
        and course_class_sessions.course_id = attendance_records.course_id
    )
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = attendance_records.course_id
      and semesters.user_id = auth.uid()
  )
  and (
    course_class_session_id is null
    or exists (
      select 1
      from public.course_class_sessions
      where course_class_sessions.id = attendance_records.course_class_session_id
        and course_class_sessions.course_id = attendance_records.course_id
    )
  )
);

commit;
