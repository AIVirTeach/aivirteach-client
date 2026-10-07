import { PreviewClient } from "./PreviewClient";

export default function LessonPreviewPage() {
  return <PreviewClient adminOrigin={process.env.NEXT_PUBLIC_ADMIN_ORIGIN} />;
}
