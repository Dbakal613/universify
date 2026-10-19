begin;

alter table public.grade_components
add column if not exists legacy_key text;

alter table public.grade_components
add column if not exists component_kind text not null default 'individual';

alter table public.grade_components
add column if not exists position integer not null default 0;

update public.grade_components
set legacy_key = id::text
where legacy_key is null;

alter table public.grade_components
alter column legacy_key set not null;

alter table public.grade_components
drop constraint if exists grade_components_component_kind_check;

alter table public.grade_components
add constraint grade_components_component_kind_check
check (component_kind in ('individual', 'grouped'));

create unique index if not exists grade_components_course_legacy_key_idx
on public.grade_components(course_id, legacy_key);

alter table public.grade_entries
add column if not exists client_id uuid not null default gen_random_uuid();

alter table public.grade_entries
add column if not exists evaluation_date date;

alter table public.grade_entries
add column if not exists position integer not null default 0;

create unique index if not exists grade_entries_user_component_client_idx
on public.grade_entries(user_id, grade_component_id, client_id);

drop policy if exists "grades own data" on public.grade_entries;
drop policy if exists "grades through own course and component" on public.grade_entries;

create policy "grades through own course and component"
on public.grade_entries
for all
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = grade_entries.course_id
      and semesters.user_id = (select auth.uid())
  )
  and (
    grade_component_id is null
    or exists (
      select 1
      from public.grade_components
      where grade_components.id = grade_entries.grade_component_id
        and grade_components.course_id = grade_entries.course_id
    )
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.courses
    join public.semesters on semesters.id = courses.semester_id
    where courses.id = grade_entries.course_id
      and semesters.user_id = (select auth.uid())
  )
  and (
    grade_component_id is null
    or exists (
      select 1
      from public.grade_components
      where grade_components.id = grade_entries.grade_component_id
        and grade_components.course_id = grade_entries.course_id
    )
  )
);

grant select, insert, update, delete
on table public.grade_components, public.grade_entries
to authenticated;

commit;
