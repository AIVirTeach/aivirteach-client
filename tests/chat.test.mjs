import assert from "node:assert/strict";
import test from "node:test";
import { courseChatThreadId, createChatMessageInput, mergeChatMessages, toChatViewMessage } from "../app/lib/chat.ts";

const savedStudentMessage = {
  id: "message_student",
  userId: "learner_advanced",
  threadId: "thread",
  role: "student",
  text: "Why did this command fail?",
  createdAt: "2026-08-20T08:00:00.000Z",
};

const savedTutorMessage = {
  ...savedStudentMessage,
  id: "message_tutor",
  role: "tutor",
  text: "Start with the final line of the error.",
  createdAt: "2026-08-20T08:00:01.000Z",
};

test("builds a stable tutor thread per learner and course", () => {
  assert.equal(
    courseChatThreadId("learner_advanced", "course_python"),
    courseChatThreadId("learner_advanced", "course_python"),
  );
  assert.notEqual(
    courseChatThreadId("learner_advanced", "course_python"),
    courseChatThreadId("learner_beginner", "course_python"),
  );
  assert.notEqual(
    courseChatThreadId("learner_advanced", "course_python"),
    courseChatThreadId("learner_advanced", "course_n8n"),
  );
  assert.notEqual(
    courseChatThreadId("learner:a", "course"),
    courseChatThreadId("learner", "a:course"),
  );
});

test("requires both learner and course identifiers", () => {
  assert.throws(() => courseChatThreadId("", "course_python"));
  assert.throws(() => courseChatThreadId("learner_advanced", "  "));
});

test("builds the tutor POST body with the current course and lesson", () => {
  assert.deepEqual(
    createChatMessageInput("  Why did this fail?  ", "course_python", "lesson_filters"),
    { text: "Why did this fail?", courseId: "course_python", lessonId: "lesson_filters" },
  );
  assert.throws(() => createChatMessageInput("Question", "course_python", ""));
});

test("keeps only persisted API message fields and de-duplicates saved turns", () => {
  const student = toChatViewMessage(savedStudentMessage);
  const tutor = toChatViewMessage(savedTutorMessage);
  assert.deepEqual(Object.keys(student), ["id", "role", "text", "createdAt"]);
  assert.deepEqual(mergeChatMessages([student], [student, tutor, tutor]), [student, tutor]);
});
