// 按词切片，调用方逐片累加喂给 markdown 渲染器，制造打字机效果；纯函数只负责
// 切片，定时/累加逻辑留给组件。中文没有词间空格，不能用空白切分——用 Intl.Segmenter
// 按语言学规则分词，中英混排都能正确处理。
export function typewriterChunks(text: string): string[] {
  const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
  return Array.from(segmenter.segment(text), (segment) => segment.segment);
}

const MIN_DELAY_MS = 35;
const DELAY_RANGE_MS = 40;

export function typewriterDelayMs(random: () => number = Math.random): number {
  return MIN_DELAY_MS + Math.floor(random() * DELAY_RANGE_MS);
}
