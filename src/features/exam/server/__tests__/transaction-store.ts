import type { Firestore } from "firebase-admin/firestore";

// Optimistic transaction harness: callbacks overlap, conflicting reads retry.
// Writes are staged, never applied until all read versions still match.
export function createTransactionStore(seed: Record<string, Record<string, unknown>>) {
  const docs = new Map(Object.entries(structuredClone(seed)));
  const versions = new Map<string, number>();
  let conflicts = 0;
  let writes = 0;
  const ref = (path: string) => ({ path, id: path.split("/").at(-1) });
  const db = {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      for (let retry = 0; retry < 100; retry++) {
        const reads = new Map<string, number>();
        const pending: Array<{ path: string; data: Record<string, unknown>; merge: boolean }> = [];
        const tx = {
          get: async ({ path }: { path: string }) => {
            if (pending.length) throw new Error("read after write");
            reads.set(path, versions.get(path) ?? 0);
            const data = structuredClone(docs.get(path));
            await Promise.resolve();
            return { exists: data !== undefined, data: () => data };
          },
          set: ({ path }: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => {
            pending.push({ path, data: structuredClone(data), merge: Boolean(options?.merge) });
          },
          update: ({ path }: { path: string }, data: Record<string, unknown>) => {
            pending.push({ path, data: structuredClone(data), merge: true });
          },
        };
        const value = await callback(tx);
        if ([...reads].some(([path, version]) => (versions.get(path) ?? 0) !== version)) {
          conflicts++;
          continue;
        }
        for (const item of pending) {
          docs.set(item.path, item.merge ? { ...docs.get(item.path), ...item.data } : item.data);
          versions.set(item.path, (versions.get(item.path) ?? 0) + 1);
          writes++;
        }
        return value;
      }
      throw new Error("transaction retries exhausted");
    },
  };
  return { db: db as unknown as Firestore, docs, get conflicts() { return conflicts; }, get writes() { return writes; } };
}
