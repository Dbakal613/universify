alter table public.courses
add column if not exists legacy_id text;

alter table public.courses
add column if not exists course_data jsonb not null default '{}'::jsonb;

update public.courses
set legacy_id = id::text
where legacy_id is null;

alter table public.courses
alter column legacy_id set not null;

create unique index if not exists courses_semester_legacy_id_idx
on public.courses(semester_id, legacy_id);
