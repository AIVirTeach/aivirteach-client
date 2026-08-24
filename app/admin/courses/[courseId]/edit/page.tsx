import { CourseBuilder } from "../../CourseBuilder";

export default async function EditCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseBuilder courseId={decodeURIComponent(courseId)} />;
}
