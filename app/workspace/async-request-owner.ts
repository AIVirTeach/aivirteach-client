export function createAsyncRequestOwner() {
  let current = 0;
  const isCurrent = (owner: number) => current === owner;
  return {
    begin() { current++; return current; },
    invalidate() { current++; },
    isCurrent,
    async run<T>(owner: number, request: () => Promise<T>, onSuccess: (value: T) => void, onError: (error: unknown) => void) {
      try {
        const value = await request();
        if (!isCurrent(owner)) return;
        onSuccess(value);
      } catch (error) {
        if (!isCurrent(owner)) return;
        onError(error);
      }
    },
  };
}
