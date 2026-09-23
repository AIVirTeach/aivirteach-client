import { describe, expect, it } from "vitest";
import { typewriterChunks, typewriterDelayMs } from "./typewriter";

describe("typewriterChunks", () => {
  it("按词切成多个片段，拼接后等于原文", () => {
    const chunks = typewriterChunks("已完成的课程有 3 个，进度 42%。");
    expect(chunks.join("")).toBe("已完成的课程有 3 个，进度 42%。");
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("连续中文（没有任何空格）也要切成多个片段，不能整段一次性甩出来", () => {
    const text = "工作区正在初始化，请稍候片刻，我们正在为你准备诊断结果和后续步骤建议。";
    const chunks = typewriterChunks(text);
    expect(chunks.join("")).toBe(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("空字符串返回空数组", () => {
    expect(typewriterChunks("")).toEqual([]);
  });

  it("单个词返回单元素数组", () => {
    expect(typewriterChunks("你好")).toEqual(["你好"]);
  });
});

describe("typewriterDelayMs", () => {
  it("random() 返回 0 时取下限", () => {
    expect(typewriterDelayMs(() => 0)).toBe(35);
  });

  it("random() 返回接近 1 时取上限附近", () => {
    expect(typewriterDelayMs(() => 0.999)).toBe(74);
  });

  it("不传参数时使用 Math.random，结果落在 [35, 75) 区间", () => {
    const delay = typewriterDelayMs();
    expect(delay).toBeGreaterThanOrEqual(35);
    expect(delay).toBeLessThan(75);
  });
});
