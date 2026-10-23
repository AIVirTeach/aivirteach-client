import type { ApiLearningSnapshot, ApiLearningSnapshotPage, ApiLearningSnapshotSummary } from "../lib/api";

type Transport = {
  learningSnapshots(courseId: string, cursor?: string): Promise<ApiLearningSnapshotPage>;
  learningSnapshot(courseId: string, snapshotId: string): Promise<ApiLearningSnapshot>;
};
export type SnapshotHistoryState = {
  page: ApiLearningSnapshotPage | null;
  loading: boolean;
  error: string;
  selected: ApiLearningSnapshotSummary | null;
  detail: ApiLearningSnapshot | null;
  detailLoading: boolean;
  detailError: string;
};
const initial: SnapshotHistoryState = { page: null, loading: false, error: "", selected: null, detail: null, detailLoading: false, detailError: "" };

export function createSnapshotHistoryController(courseId: string, transport: Transport, publish: (state: SnapshotHistoryState) => void) {
  let state = initial;
  let disposed = false;
  let listOwner = 0;
  let detailOwner = 0;
  const update = (next: SnapshotHistoryState) => {
    if (disposed) return;
    state = next;
    publish(state);
  };
  async function load(cursor?: string) {
    if (disposed) return;
    const owner = ++listOwner;
    update({ ...state, loading: true, error: "" });
    try {
      const page = await transport.learningSnapshots(courseId, cursor);
      if (disposed || owner !== listOwner) return;
      update({ ...state, page: cursor && state.page ? { items: [...state.page.items, ...page.items], nextCursor: page.nextCursor } : page, loading: false, error: "" });
    } catch (caught) {
      if (disposed || owner !== listOwner) return;
      update({ ...state, loading: false, error: caught instanceof Error ? caught.message : "Could not load snapshot history." });
    }
  }
  async function open(item: ApiLearningSnapshotSummary) {
    if (disposed) return;
    const owner = ++detailOwner;
    update({ ...state, selected: item, detail: null, detailLoading: true, detailError: "" });
    try {
      const detail = await transport.learningSnapshot(courseId, item.id);
      if (disposed || owner !== detailOwner) return;
      update({ ...state, detail, detailLoading: false });
    } catch (caught) {
      if (disposed || owner !== detailOwner) return;
      update({ ...state, detailLoading: false, detailError: caught instanceof Error ? caught.message : "Could not load this snapshot." });
    }
  }
  return {
    load,
    loadNext() { return state.page?.nextCursor ? load(state.page.nextCursor) : Promise.resolve(); },
    open,
    back() { detailOwner++; update({ ...state, selected: null, detail: null, detailLoading: false, detailError: "" }); },
    close() { detailOwner++; update({ ...state, selected: null, detail: null, detailLoading: false, detailError: "" }); },
    refresh() { return load(); },
    getState: () => state,
    dispose() { disposed = true; listOwner++; detailOwner++; },
  };
}
