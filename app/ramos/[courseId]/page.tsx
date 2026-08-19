import CourseDetail from "../../../components/CourseDetail";

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ courseId }, query] = await Promise.all([params, searchParams]);
  const tab = typeof query.tab === "string" ? query.tab : "resumen";

  return <CourseDetail courseId={courseId} requestedTab={tab} />;
}
