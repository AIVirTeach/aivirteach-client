import { parseSseStream } from "../lib/sse";
import { parseChatStreamFrame } from "./chat-stream-frame";

type TutorStreamCallbacks = {
  signal: AbortSignal;
  onDraft: (text: string) => void;
  onPhase?: (phase: "diagnosis" | "answer") => void;
};

export async function readTutorStream(response: Response, { signal, onDraft, onPhase }: TutorStreamCallbacks): Promise<string> {
  if (!response.body) throw new Error("The tutor stream has no body.");
  let draft = "";
  let acceptingDeltas = true;
  for await (const frame of parseSseStream(response.body, signal)) {
    if (signal.aborted) break;
    if (frame.event === "error") throw new Error("The tutor stream failed.");
    const parsed = parseChatStreamFrame(frame.data);
    if (!parsed) continue;
    if (parsed.type === "progress" && frame.event !== parsed.event) continue;
    if (parsed.type === "complete" && frame.event !== "complete") continue;
    if (parsed.type === "complete") return parsed.tutorMessage.text;
    if (parsed.event === "started" || parsed.event === "reasoning_started" || parsed.event === "tool_started") onPhase?.("diagnosis");
    if (parsed.event === "answer_started") {
      onPhase?.("answer");
      acceptingDeltas = true;
      draft = "";
      onDraft(draft);
    } else if (parsed.event === "answer_failed") {
      acceptingDeltas = false;
      draft = "";
      onDraft(draft);
    } else if (parsed.event === "assistant_delta" && acceptingDeltas && typeof parsed.data.delta === "string") {
      draft += parsed.data.delta;
      onDraft(draft);
    }
  }
  throw new Error("The tutor stream ended before completion.");
}
