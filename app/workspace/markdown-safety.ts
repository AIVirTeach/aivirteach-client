// 助教回答里的链接可能引用不可信 scheme（比如 markdown 里手写 [text](javascript:...)）；
// allowHtml 没开所以原生 <script>/onerror 已经安全，这里单独把渲染出来的 <a> href
// 收紧到几个已知安全的 scheme，不认识的直接丢弃。
const safeHrefPattern = /^(https?:|mailto:|\/|#)/i;

export function isSafeMarkdownHref(href: string | undefined): boolean {
  return href !== undefined && safeHrefPattern.test(href);
}
