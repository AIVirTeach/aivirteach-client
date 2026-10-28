export type TutorActivity = "checking" | "tools" | "validating";

export type TutorReplyState =
  | { kind: "diagnosing"; activity: TutorActivity }
  | { kind: "answering"; draft: string }
  | { kind: "fallback"; reason: "assessment" | "answer" }
  | { kind: "awaiting"; draft: string }
  | { kind: "saving"; draft: string }
  | { kind: "completed"; text: string };

export type TutorReplyEvent =
  | { kind: "activity"; activity: TutorActivity }
  | { kind: "answer-started" }
  | { kind: "delta"; text: string }
  | { kind: "answer-failed"; reason: "assessment" | "answer" }
  | { kind: "answer-finished" }
  | { kind: "persisting" }
  | { kind: "completed"; text: string };

export const initialTutorReply: TutorReplyState = { kind: "diagnosing", activity: "checking" };

export function replyDraft(state: TutorReplyState): string {
  return "draft" in state ? state.draft : "";
}

export function reduceTutorReply(state: TutorReplyState, event: TutorReplyEvent): TutorReplyState {
  if (state.kind === "completed") return state;
  switch (event.kind) {
    case "activity": return state.kind === "diagnosing" ? { kind: "diagnosing", activity: event.activity } : state;
    case "answer-started": return state.kind === "diagnosing" || state.kind === "fallback" ? { kind: "answering", draft: "" } : state;
    case "delta": return state.kind === "diagnosing" || state.kind === "answering" ? { kind: "answering", draft: replyDraft(state) + event.text } : state;
    case "answer-failed": return { kind: "fallback", reason: event.reason };
    case "answer-finished": return { kind: "awaiting", draft: replyDraft(state) };
    case "persisting": return { kind: "saving", draft: replyDraft(state) };
    case "completed": return { kind: "completed", text: event.text };
  }
}
