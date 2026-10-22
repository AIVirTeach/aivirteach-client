import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TutorMessage } from "./tutor-message";

describe("TutorMessage", () => {
  it("renders paragraphs, lists and a copyable command block", () => {
    const html = renderToStaticMarkup(<TutorMessage text={'检查 Docker。\n\n请执行：\n\n1. 查看版本\n2. 确认状态\n\n```bash\ndocker --version\nsudo systemctl is-active docker\n```'} />);
    expect(html).toContain("<p>检查 Docker。</p>");
    expect(html).toContain("<ol>");
    expect(html).toContain("tutor-code-toolbar");
    expect(html).toContain("docker --version\nsudo systemctl is-active docker");
  });

  it("does not activate unsafe links or raw HTML", () => {
    const html = renderToStaticMarkup(<TutorMessage text={'[bad](javascript:alert%281%29)\n\n<img src=x onerror=alert(1)>'} />);
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<img");
  });
});
