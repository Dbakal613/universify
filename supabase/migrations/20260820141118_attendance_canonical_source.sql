begin;

-- A normal unique index still allows multiple NULL session ids for legacy rows,
-- while giving PostgREST an unambiguous conflict target for atomic upserts.
create unique index if not exists attendance_records_user_session_unique_idx
on public.attendance_records(user_id, course_class_session_id);

commit;
