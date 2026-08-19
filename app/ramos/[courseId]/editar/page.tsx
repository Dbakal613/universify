import CourseEdit from "../../../../components/CourseEdit";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  return <CourseEdit courseId={courseId} />;
}
