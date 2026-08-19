create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  university text,
  degree text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  year integer not null,
  term text not null,
  start_date date,
  end_date date,
  timezone text not null default 'America/Santiago',
  location_name text not null default 'Santiago, Chile',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  legacy_id text not null,
  name text not null,
  code text,
  professor_name text,
  professor_email text,
  autonomous_hours numeric,
  total_classes integer,
  attendance_required_percentage numeric,
  attendance_grading_weight numeric,
  attendance_rules text,
  color_key text,
  course_data jsonb not null default '{}'::jsonb,
  source_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamptz not null default now()
);

create table public.course_class_sessions (
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

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  evaluation_type text not null check (
    evaluation_type in (
      'control',
      'prueba',
      'entrega',
      'presentacion',
      'examen',
      'actividad'
    )
  ),
  evaluation_date date,
  start_time time,
  weight numeric,
  topics text,
  source_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.grade_components (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  weight numeric,
  component_type text,
  is_expandable boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.autonomous_work (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  week_start date,
  title text not null,
  estimated_minutes integer,
  related_evaluation_id uuid references public.evaluations(id) on delete set null,
  source_text text,
  created_at timestamptz not null default now()
);

create table public.course_documents (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  document_type text,
  processing_status text not null default 'pending',
  processing_error text,
  extracted_json jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  course_class_session_id uuid references public.course_class_sessions(id) on delete restrict,
  class_date date not null,
  status text not null check (
    status in ('present', 'attended', 'absent', 'justified', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.validate_attendance_session_link()
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

create trigger attendance_records_validate_session
before insert or update of course_id, class_date, course_class_session_id
on public.attendance_records
for each row
execute function public.validate_attendance_session_link();

create table public.grade_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  evaluation_id uuid references public.evaluations(id) on delete cascade,
  grade_component_id uuid references public.grade_components(id) on delete cascade,
  label text not null,
  grade numeric check (grade between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  evaluation_id uuid references public.evaluations(id) on delete set null,
  scheduled_date date not null,
  start_time time,
  end_time time,
  title text not null,
  estimated_minutes integer,
  status text not null default 'pending' check (
    status in ('pending', 'done_early', 'done_on_time', 'unfinished')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.semesters enable row level security;
alter table public.courses enable row level security;
alter table public.course_classes enable row level security;
alter table public.course_class_sessions enable row level security;
alter table public.evaluations enable row level security;
alter table public.grade_components enable row level security;
alter table public.autonomous_work enable row level security;
alter table public.course_documents enable row level security;
alter table public.attendance_records enable row level security;
alter table public.grade_entries enable row level security;
alter table public.study_sessions enable row level security;

create policy "profiles own data"
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "semesters own data"
on public.semesters
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "courses through own semester"
on public.courses
for all
to authenticated
using (
  exists (
    select 1
    from public.semesters
    where semesters.id = courses.semester_id
      and semesters.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.semesters
    where semesters.id = courses.semester_id
      and semesters.user_id = auth.uid()
  )
);

create policy "course classes through own course"
on public.course_classes
for all
to authenticated
using (
  exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = course_classes.course_id
      and semesters.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = course_classes.course_id
      and semesters.user_id = auth.uid()
  )
);

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

create policy "evaluations through own course"
on public.evaluations
for all
to authenticated
using (
  exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = evaluations.course_id
      and semesters.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = evaluations.course_id
      and semesters.user_id = auth.uid()
  )
);

create policy "grade components through own course"
on public.grade_components
for all
to authenticated
using (
  exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = grade_components.course_id
      and semesters.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = grade_components.course_id
      and semesters.user_id = auth.uid()
  )
);

create policy "autonomous work through own course"
on public.autonomous_work
for all
to authenticated
using (
  exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = autonomous_work.course_id
      and semesters.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = autonomous_work.course_id
      and semesters.user_id = auth.uid()
  )
);

create policy "documents through own semester"
on public.course_documents
for all
to authenticated
using (
  exists (
    select 1
    from public.semesters
    where semesters.id = course_documents.semester_id
      and semesters.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.semesters
    where semesters.id = course_documents.semester_id
      and semesters.user_id = auth.uid()
  )
);

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

create policy "grades own data"
on public.grade_entries
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "study sessions own data"
on public.study_sessions
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index semesters_user_id_idx
on public.semesters(user_id);

create index courses_semester_id_idx
on public.courses(semester_id);

create unique index courses_semester_legacy_id_idx
on public.courses(semester_id, legacy_id);

create unique index course_class_sessions_timed_identity_idx
on public.course_class_sessions(course_id, session_date, start_time)
where start_time is not null;

create unique index course_class_sessions_untimed_identity_idx
on public.course_class_sessions(course_id, session_date)
where start_time is null;

create index course_class_sessions_course_date_idx
on public.course_class_sessions(course_id, session_date);

create index evaluations_course_id_date_idx
on public.evaluations(course_id, evaluation_date);

create index autonomous_work_course_id_week_idx
on public.autonomous_work(course_id, week_start);

create index course_documents_semester_id_idx
on public.course_documents(semester_id);

create index attendance_records_user_course_idx
on public.attendance_records(user_id, course_id);

create unique index attendance_records_legacy_identity_idx
on public.attendance_records(course_id, user_id, class_date)
where course_class_session_id is null;

create unique index attendance_records_session_identity_idx
on public.attendance_records(user_id, course_class_session_id)
where course_class_session_id is not null;

create index attendance_records_session_id_idx
on public.attendance_records(course_class_session_id);

create index grade_entries_user_course_idx
on public.grade_entries(user_id, course_id);

create index study_sessions_user_date_idx
on public.study_sessions(user_id, scheduled_date);
