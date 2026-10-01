"use client";

import { useEffect, useState } from "react";
import { LessonBlocks } from "../../components/LessonBlocks";
import { parsePreviewMessage, type PreviewPayload } from "../../lib/lesson-blocks/preview-message";

export function PreviewClient({ adminOrigin }: { adminOrigin?: string }) {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
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
    <main className="preview-page">
      <header className="preview-header">
        <p>{preview.moduleTitle}</p>
        <h1>{preview.lessonTitle}</h1>
      </header>
      <LessonBlocks blocks={preview.blocks} assets={preview.assets} problems={preview.problems} mode="preview" />
    </main>
  );
}
