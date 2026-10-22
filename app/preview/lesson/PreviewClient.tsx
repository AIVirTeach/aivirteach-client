"use client";

import { useEffect, useState } from "react";
import { CourseLessonView } from "../../components/CourseLessonView";
import { parsePreviewMessage, type PreviewPayload } from "../../lib/lesson-blocks/preview-message";

export function PreviewClient({ adminOrigin }: { adminOrigin?: string }) {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent) return;
      const payload = parsePreviewMessage(event, adminOrigin);
      if (payload) setPreview(payload);
    };

    window.addEventListener("message", onMessage);
    if (adminOrigin && window.parent !== window) {
      window.parent.postMessage({ type: "lesson-preview-ready" }, adminOrigin);
    }
    return () => window.removeEventListener("message", onMessage);
  }, [adminOrigin]);

  if (!preview) {
    return <main className="preview-page"><p role="status">等待后台发送内容</p></main>;
  }

  return (
    <main className="course-preview-page">
      <CourseLessonView {...preview.lesson} assets={preview.assets} problems={preview.problems} mode="preview" />
    </main>
  );
}
