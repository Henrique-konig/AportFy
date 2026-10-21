// Firestore falso, em memória, para os testes de ponta a ponta (substitui o SDK do Firebase no
// navegador). Cobre só o que o app usa: coleções, documentos, ouvintes em tempo real, lotes.
// Dados iniciais vêm de window.__E2E.seed ({ "users/u1/transactions/t1": {...} }); o estado fica
// em window.__fs.data (Map: caminho da coleção -> Map id -> documento) para os testes lerem.

const store = (globalThis.__fs ||= (() => {
  const data = new Map();
  for (const [path, value] of Object.entries(globalThis.__E2E?.seed || {})) {
    const parts = path.split("/");
    const id = parts.pop();
    const col = parts.join("/");
    if (!data.has(col)) data.set(col, new Map());
    data.get(col).set(id, structuredClone(value));
  }
  return { data, listeners: new Set(), auto: 0 };
})());

const colOf = (path) => {
  if (!store.data.has(path)) store.data.set(path, new Map());
  return store.data.get(path);
};
const notify = (path) => store.listeners.forEach((l) => l.path === path && l.fire());

export const getFirestore = () => ({ fake: true });
export const initializeFirestore = getFirestore;
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const terminate = async () => {};
export const clearIndexedDbPersistence = async () => {};

export const collection = (_db, ...segments) => ({ kind: "col", path: segments.join("/") });
export const doc = (first, ...segments) =>
  first.kind === "col"
    ? { kind: "doc", path: first.path, id: `auto${++store.auto}` }
    : { kind: "doc", path: segments.slice(0, -1).join("/"), id: segments.at(-1) };
export const orderBy = (field, direction = "asc") => ({ order: [field, direction] });
export const query = (col, constraint) => ({ ...col, order: constraint?.order });

export const serverTimestamp = () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 });
export const arrayUnion = (...items) => ({ __union: items });
export const deleteField = () => ({ __delete: true });

const apply = (existing, data) => {
  const out = { ...existing };
  for (const [key, value] of Object.entries(data)) {
    if (value && value.__delete) delete out[key];
    else if (value && value.__union) out[key] = [...new Set([...(out[key] || []), ...value.__union])];
    else out[key] = structuredClone(value);
  }
  return out;
};

const docSnap = (ref) => {
  const data = colOf(ref.path).get(ref.id);
  return { id: ref.id, ref, exists: () => data !== undefined, data: () => (data ? structuredClone(data) : undefined), get: (f) => data?.[f], metadata: { fromCache: false } };
};
const colSnap = (q) => {
  const entries = [...colOf(q.path)];
  if (q.order) {
    const [field, dir] = q.order;
    entries.sort(([, a], [, b]) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * (dir === "desc" ? -1 : 1));
  }
  const docs = entries.map(([id]) => docSnap({ path: q.path, id }));
  return { docs, size: docs.length, empty: docs.length === 0, metadata: { fromCache: false }, forEach: (fn) => docs.forEach(fn) };
};

export const onSnapshot = (ref, ...args) => {
  const callback = args.find((a) => typeof a === "function");
  const fire = () => callback(ref.kind === "doc" ? docSnap(ref) : colSnap(ref));
  const listener = { path: ref.path, fire };
  store.listeners.add(listener);
  queueMicrotask(fire);
  return () => store.listeners.delete(listener);
};

export const getDoc = async (ref) => docSnap(ref);
export const getDocs = async (q) => colSnap(q);

export const setDoc = async (ref, data, options) => {
  const col = colOf(ref.path);
  col.set(ref.id, options?.merge ? apply(col.get(ref.id) || {}, data) : apply({}, data));
  notify(ref.path);
};
export const addDoc = async (col, data) => {
  const id = `a${++store.auto}`;
  colOf(col.path).set(id, apply({}, data));
  notify(col.path);
  return { id, path: col.path };
};
export const updateDoc = async (ref, data) => {
  const col = colOf(ref.path);
  if (!col.has(ref.id)) throw Object.assign(new Error("not-found"), { code: "not-found" });
  col.set(ref.id, apply(col.get(ref.id), data));
  notify(ref.path);
};
export const deleteDoc = async (ref) => {
  colOf(ref.path).delete(ref.id);
  notify(ref.path);
};
export const writeBatch = () => {
  const ops = [];
  return {
    set: (ref, data, options) => ops.push(() => setDoc(ref, data, options)),
    update: (ref, data) => ops.push(() => updateDoc(ref, data)),
    delete: (ref) => ops.push(() => deleteDoc(ref)),
    commit: async () => {
      for (const op of ops) await op();
    },
  };
};
