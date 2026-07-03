// Pure index logic for the Documents feature — migration, ordering, and folder
// moves. NO imports (no zod, no react) so it is Node-testable (scripts/check-docs.mjs)
// and importable by both the server DAL and the client without dragging deps in.
// The one-level tree lives in a single object: { folders:[{id,name}], docs:[{id,
// title,updatedAt,folderId}] }, order = array position, folderId null = root.

function findLastIndex(arr, pred) {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}

// Shape/migrate a raw stored value. Legacy stores held a bare meta array; wrap it.
export function normalizeIndex(raw) {
  const base = Array.isArray(raw) ? { folders: [], docs: raw } : (raw ?? {});
  const folders = (base.folders ?? []).map((f) => ({ id: f.id, name: f.name ?? "" }));
  const docs = (base.docs ?? []).map((d) => ({
    id: d.id,
    title: d.title ?? "Untitled",
    updatedAt: d.updatedAt ?? 0,
    folderId: d.folderId ?? null,
  }));
  return { folders, docs };
}

// Reorder a list of {id,...}: pull `id`, reinsert immediately before `beforeId`
// (append when beforeId is null or not found). Returns a new array.
export function moveBefore(list, id, beforeId) {
  if (id === beforeId) return list; // anchoring before itself is a no-op
  const item = list.find((x) => x.id === id);
  if (!item) return list;
  const rest = list.filter((x) => x.id !== id);
  if (beforeId == null) return [...rest, item];
  const idx = rest.findIndex((x) => x.id === beforeId);
  if (idx === -1) return [...rest, item];
  return [...rest.slice(0, idx), item, ...rest.slice(idx)];
}

// Move a doc into `folderId` (null = root). With `beforeId` set, position it
// before that sibling; with null, land it at the end of the target folder's group.
export function placeDoc(docs, docId, folderId, beforeId) {
  const withFolder = docs.map((d) => (d.id === docId ? { ...d, folderId } : d));
  if (beforeId != null) return moveBefore(withFolder, docId, beforeId);
  const moving = withFolder.find((d) => d.id === docId);
  if (!moving) return docs; // unknown docId — nothing to place (never splice undefined)
  const rest = withFolder.filter((d) => d.id !== docId);
  const last = findLastIndex(rest, (d) => d.folderId === folderId);
  if (last === -1) return [...rest, moving];
  return [...rest.slice(0, last + 1), moving, ...rest.slice(last + 1)];
}

// Delete a folder, promoting its documents to root (never deletes docs).
export function removeFolder(index, folderId) {
  return {
    folders: index.folders.filter((f) => f.id !== folderId),
    docs: index.docs.map((d) => (d.folderId === folderId ? { ...d, folderId: null } : d)),
  };
}
