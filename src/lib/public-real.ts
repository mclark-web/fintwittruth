import { gradeRealPosts, realCallsForHandle, type RealCallView } from "./real-book";
import { getIntakeStore, isOperatorStorageMessage, UNCONFIGURED_PUBLIC, type StoreKind } from "./intake-store";

export async function loadRealCalls(): Promise<{
  calls: RealCallView[];
  kind: StoreKind;
  detail: string;
  error: string | null;
}> {
  const store = getIntakeStore();
  if (store.kind === "unconfigured") {
    console.error(store.detail);
  }
  const detail = store.kind === "unconfigured" ? UNCONFIGURED_PUBLIC : store.detail;
  try {
    const book = await store.read();
    return {
      calls: gradeRealPosts(book.posts),
      kind: store.kind,
      detail,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The intake store could not be read.";
    if (isOperatorStorageMessage(message)) {
      console.error(message);
      return { calls: [], kind: store.kind, detail, error: null };
    }
    return {
      calls: [],
      kind: store.kind,
      detail,
      error: message,
    };
  }
}

export async function loadRealCallsForHandle(handle: string): Promise<RealCallView[]> {
  const loaded = await loadRealCalls();
  return realCallsForHandle(loaded.calls, handle);
}
