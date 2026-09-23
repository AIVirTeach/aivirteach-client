import { describe, expect, it } from "vitest";
import { parseChatStreamFrame } from "./chat-stream-frame";

describe("parseChatStreamFrame", () => {
  it("解析合法的 progress 帧", () => {
    expect(parseChatStreamFrame('{"type":"progress","event":"tool_started","data":{"tool":"check_disk"}}')).toEqual({
      type: "progress",
      event: "tool_started",
      data: { tool: "check_disk" },
    });
  });

  it("解析合法的 complete 帧", () => {
    expect(
      parseChatStreamFrame('{"type":"complete","studentMessage":{"text":"你好"},"tutorMessage":{"text":"你好，有什么可以帮你的？"}}'),
    ).toEqual({
      type: "complete",
      studentMessage: { text: "你好" },
      tutorMessage: { text: "你好，有什么可以帮你的？" },
    });
  });

  it("不是合法 JSON 时返回 null，不抛出 SyntaxError", () => {
    expect(parseChatStreamFrame("{not json")).toBeNull();
  });

  it("complete 帧缺 tutorMessage 时返回 null，不抛出 TypeError", () => {
    expect(parseChatStreamFrame('{"type":"complete","studentMessage":{"text":"你好"}}')).toBeNull();
  });

  it("type 字段是未知值时返回 null", () => {
    expect(parseChatStreamFrame('{"type":"unknown"}')).toBeNull();
  });

  it("JSON 是数组或原始值而不是对象时返回 null", () => {
    expect(parseChatStreamFrame("[1,2,3]")).toBeNull();
    expect(parseChatStreamFrame("42")).toBeNull();
  });
});
