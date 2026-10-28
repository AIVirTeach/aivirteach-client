import { parseSseStream } from "../lib/sse";
import { parseChatStreamFrame } from "./chat-stream-frame";
import { initialTutorReply, reduceTutorReply, type TutorReplyEvent, type TutorReplyState } from "./tutor-reply-state";

type TutorStreamCallbacks = {
  signal: AbortSignal;
  onState: (state: TutorReplyState) => void;
};

export class TutorReplyNotSavedError extends Error {
  constructor() { super("The reply could not be confirmed as saved."); }
}

function errorCode(raw: string): unknown {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && "code" in value ? value.code : undefined;
  } catch { return undefined; }
}

export async function readTutorStream(response: Response, { signal, onState }: TutorStreamCallbacks): Promise<string> {
  if (!response.body) throw new Error("The tutor stream has no body.");
  let state = initialTutorReply;
  const dispatch = (event: TutorReplyEvent) => {
    const next = reduceTutorReply(state, event);
    if (next !== state) { state = next; onState(state); }
  };
  for await (const frame of parseSseStream(response.body, signal)) {
    if (signal.aborted) break;
    if (frame.event === "error") {
      if (errorCode(frame.data) === "REPLY_NOT_SAVED") throw new TutorReplyNotSavedError();
      throw new Error("The tutor stream failed.");
    }
    const parsed = parseChatStreamFrame(frame.data);
    if (!parsed) continue;
    if (parsed.type === "progress" && frame.event !== parsed.event) continue;
    if (parsed.type === "complete" && frame.event !== "complete") continue;
    if (parsed.type === "complete") {
      dispatch({ kind: "completed", text: parsed.tutorMessage.text });
      return parsed.tutorMessage.text;
    }
    switch (parsed.event) {
      case "started": case "reasoning_started": case "context_ready": dispatch({ kind: "activity", activity: "checking" }); break;
      case "tool_started": dispatch({ kind: "activity", activity: "tools" }); break;
      case "tool_finished": case "finalization_started": case "assessment_validating": case "assessment_validated": dispatch({ kind: "activity", activity: "validating" }); break;
      case "answer_started": dispatch({ kind: "answer-started" }); break;
      case "answer_failed": dispatch({ kind: "answer-failed", reason: parsed.data.code === "ASSESSMENT_INVALID" ? "assessment" : "answer" }); break;
      case "answer_finished": dispatch({ kind: "answer-finished" }); break;
      case "reply_persisting": dispatch({ kind: "persisting" }); break;
      case "assistant_delta": if (typeof parsed.data.delta === "string") dispatch({ kind: "delta", text: parsed.data.delta }); break;
    }
  }
  throw new Error("The tutor stream ended before completion.");
}
