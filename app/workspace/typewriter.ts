// 按"非空白字符+紧跟空白"切片，调用方逐片累加喂给 markdown 渲染器，
// 制造打字机效果；纯函数只负责切片，定时/累加逻辑留给组件。
export function typewriterChunks(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

const MIN_DELAY_MS = 35;
const DELAY_RANGE_MS = 40;

export function typewriterDelayMs(random: () => number = Math.random): number {
  return MIN_DELAY_MS + Math.floor(random() * DELAY_RANGE_MS);
}
