import { z } from "zod";
import { redis } from "./redis";
import { normalizeIndex, placeDoc, moveBefore, removeFolder } from "./docIndex.mjs";

// ============================================================================
// DOCUMENTS — shared notes, stored OUTSIDE the global `state` record.
//
// The sidebar tree lives in ONE key, `docs:index`, as { folders, docs } (one-level
// folders; each doc has a nullable folderId; array position = order). Each document
// BODY still lives under its own `doc:<id>` key, so listing/opening stay O(1) and
// large bodies never bloat the index. Pure migration/reorder logic is in
// docIndex.mjs (shared with the client + tested by scripts/check-docs.mjs).
//
// No fallback, no silent errors: if Redis isn't configured we throw loudly.
// ============================================================================

const FolderSchema = z.object({ id: z.string(), name: z.string().default("") });
const DocMetaSchema = z.object({
  id: z.string(),
  title: z.string().default("Untitled"),
  updatedAt: z.number().default(0),
  folderId: z.string().nullable().default(null), // null = root / unfiled
});
// Legacy `docs:index` was a bare meta array; normalizeIndex migrates it on read.
const IndexSchema = z.preprocess(normalizeIndex, z.object({
  folders: z.array(FolderSchema).default([]),
  docs: z.array(DocMetaSchema).default([]),
}));
// The `doc:<id>` body value — placement lives only in the index, not here.
const DocBodySchema = z.object({
  id: z.string(),
  title: z.string().default("Untitled"),
  body: z.string().default(""),
  updatedAt: z.number().default(0),
});

const KEY_INDEX = "docs:index";
const docKey = (id) => "doc:" + id;

function client() {
  if (!redis) {
    throw new Error(
      "Redis is not configured. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN " +
        "(or the KV_REST_API_* pair) in .env.local (dev) and the Vercel project env (prod). " +
        "Shared documents require it — there is no local fallback.",
    );
  }
  return redis;
}

async function readIndex() {
  return IndexSchema.parse((await client().get(KEY_INDEX)) ?? {});
}
async function writeIndex(next) {
  const value = IndexSchema.parse(next);
  await client().set(KEY_INDEX, value);
  return value;
}

export async function listIndex() {
  return readIndex();
}

export async function getDoc(id) {
  const v = await client().get(docKey(id));
  return v == null ? null : DocBodySchema.parse(v);
}

export async function createDoc(id, title, folderId = null) {
  const now = Date.now();
  const doc = DocBodySchema.parse({ id, title: title || "Untitled", body: "", updatedAt: now });
  await client().set(docKey(id), doc);
  const index = await readIndex();
  if (!index.docs.some((d) => d.id === id)) {
    await writeIndex({
      ...index,
      docs: [{ id, title: doc.title, updatedAt: now, folderId }, ...index.docs], // newest first
    });
  }
  return doc;
}

export async function updateDoc(id, patch) {
  const now = Date.now();
  const existing = (await getDoc(id)) ?? { id, title: "Untitled", body: "", updatedAt: now };
  const doc = DocBodySchema.parse({ ...existing, ...patch, id, updatedAt: now });
  await client().set(docKey(id), doc);
  const index = await readIndex();
  await writeIndex({
    ...index,
    docs: index.docs.map((d) => (d.id === id ? { ...d, title: doc.title, updatedAt: now } : d)),
  });
  return doc;
}

export async function deleteDoc(id) {
  await client().del(docKey(id));
  const index = await readIndex();
  await writeIndex({ ...index, docs: index.docs.filter((d) => d.id !== id) });
}

export async function createFolder(id, name) {
  const index = await readIndex();
  if (index.folders.some((f) => f.id === id)) return index;
  return writeIndex({ ...index, folders: [{ id, name: name || "" }, ...index.folders] });
}

export async function renameFolder(id, name) {
  const index = await readIndex();
  return writeIndex({
    ...index,
    folders: index.folders.map((f) => (f.id === id ? { ...f, name } : f)),
  });
}

export async function deleteFolder(id) {
  const index = await readIndex();
  return writeIndex(removeFolder(index, id)); // promotes its docs to root
}

export async function moveDoc(docId, folderId, beforeId) {
  const index = await readIndex();
  return writeIndex({ ...index, docs: placeDoc(index.docs, docId, folderId, beforeId) });
}

export async function moveFolder(folderId, beforeId) {
  const index = await readIndex();
  return writeIndex({ ...index, folders: moveBefore(index.folders, folderId, beforeId) });
}
