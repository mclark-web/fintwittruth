import { gradeRealPosts, realCallsForHandle, type RealCallView } from "./real-book";
import { getIntakeStore, type StoreKind } from "./intake-store";

export async function loadRealCalls(): Promise<{
  calls: RealCallView[];
  kind: StoreKind;
  detail: string;
  error: string | null;
}> {
  const store = getIntakeStore();
  try {
    const book = await store.read();
    return {
      calls: gradeRealPosts(book.posts),
      kind: store.kind,
      detail: store.detail,
      error: null,
    };
  } catch (error) {
    return {
      calls: [],
      kind: store.kind,
      detail: store.detail,
      error: error instanceof Error ? error.message : "The intake store could not be read.",
    };
  }
}

export async function loadRealCallsForHandle(handle: string): Promise<RealCallView[]> {
  const loaded = await loadRealCalls();
  return realCallsForHandle(loaded.calls, handle);
}
