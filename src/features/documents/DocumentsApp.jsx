"use client";
import { useState, useRef, useEffect, useTransition } from "react";
import {
  createDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  createFolder,
  renameFolder,
  deleteFolder,
  moveDoc,
  moveFolder,
} from "@/config/actions";
import { placeDoc, moveBefore, removeFolder } from "@/config/docIndex.mjs";
import DocSidebar from "./DocSidebar";
import DocEditor from "./DocEditor";

const SAVE_DELAY = 600;

export default function DocumentsApp({ initialIndex }) {
  const [index, setIndex] = useState(initialIndex); // { folders, docs }
  const [selectedId, setSelectedId] = useState(initialIndex.docs[0]?.id ?? null);
  const [bodies, setBodies] = useState({}); // { [id]: { title, body } } — lazy cache
  const timer = useRef(null);
  const [, startTransition] = useTransition();

  // LAZY LOAD the selected doc's body the first time it's opened.
  useEffect(() => {
    if (!selectedId || bodies[selectedId] !== undefined) return;
    let cancelled = false;
    getDoc(selectedId).then((doc) => {
      if (cancelled || !doc) return;
      setBodies((b) => ({ ...b, [selectedId]: { title: doc.title, body: doc.body } }));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, bodies]);

  const flushPending = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    const prev = selectedId;
    const cached = prev && bodies[prev];
    if (cached) startTransition(() => updateDoc(prev, { title: cached.title, body: cached.body }));
  };

  const selectDoc = (id) => {
    if (id === selectedId) return;
    flushPending();
    setSelectedId(id);
  };

  // ---- documents ----
  const newDocument = (folderId = null) => {
    flushPending();
    const id = crypto.randomUUID();
    const meta = { id, title: "Untitled", updatedAt: Date.now(), folderId };
    setIndex((ix) => ({ ...ix, docs: [meta, ...ix.docs] }));
    setBodies((b) => ({ ...b, [id]: { title: "Untitled", body: "" } }));
    setSelectedId(id);
    startTransition(() => createDoc(id, "Untitled", folderId));
  };

  const removeDocument = (id) => {
    setIndex((ix) => ({ ...ix, docs: ix.docs.filter((d) => d.id !== id) }));
    setBodies((b) => {
      const next = { ...b };
      delete next[id];
      return next;
    });
    if (id === selectedId) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const remaining = index.docs.filter((d) => d.id !== id);
      setSelectedId(remaining[0]?.id ?? null);
    }
    startTransition(() => deleteDoc(id));
  };

  const renameDocument = (id, title) => {
    setIndex((ix) => ({ ...ix, docs: ix.docs.map((d) => (d.id === id ? { ...d, title } : d)) }));
    setBodies((b) => (b[id] ? { ...b, [id]: { ...b[id], title } } : b));
    startTransition(() => updateDoc(id, { title }));
  };

  const moveDocument = (docId, folderId, beforeId) => {
    setIndex((ix) => ({ ...ix, docs: placeDoc(ix.docs, docId, folderId, beforeId) }));
    startTransition(() => moveDoc(docId, folderId, beforeId));
  };

  // ---- folders ----
  const newFolder = () => {
    const id = crypto.randomUUID();
    setIndex((ix) => ({ ...ix, folders: [{ id, name: "New folder" }, ...ix.folders] }));
    startTransition(() => createFolder(id, "New folder"));
  };

  const renameFolderLocal = (id, name) => {
    setIndex((ix) => ({ ...ix, folders: ix.folders.map((f) => (f.id === id ? { ...f, name } : f)) }));
    startTransition(() => renameFolder(id, name));
  };

  const deleteFolderLocal = (id) => {
    setIndex((ix) => removeFolder(ix, id)); // promotes its docs to root
    startTransition(() => deleteFolder(id));
  };

  const moveFolderLocal = (folderId, beforeId) => {
    setIndex((ix) => ({ ...ix, folders: moveBefore(ix.folders, folderId, beforeId) }));
    startTransition(() => moveFolder(folderId, beforeId));
  };

  // EDIT from the editor — { title } or { body } for the selected doc.
  const onEdit = (patch) => {
    const id = selectedId;
    const merged = { ...bodies[id], ...patch };
    setBodies((b) => ({ ...b, [id]: merged }));
    if (patch.title !== undefined) {
      setIndex((ix) => ({
        ...ix,
        docs: ix.docs.map((d) => (d.id === id ? { ...d, title: patch.title } : d)),
      }));
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      startTransition(() => updateDoc(id, { title: merged.title, body: merged.body }));
    }, SAVE_DELAY);
  };

  return (
    <div className="flex gap-5 max-md:flex-col items-start">
      <div className="w-[240px] max-md:w-full shrink-0 sticky top-[74px] max-md:static">
        <DocSidebar
          index={index}
          selectedId={selectedId}
          onSelect={selectDoc}
          onNewDoc={newDocument}
          onNewFolder={newFolder}
          onRenameDoc={renameDocument}
          onDeleteDoc={removeDocument}
          onRenameFolder={renameFolderLocal}
          onDeleteFolder={deleteFolderLocal}
          onNewDocInFolder={newDocument}
          onMoveDoc={moveDocument}
          onMoveFolder={moveFolderLocal}
        />
      </div>
      <div className="flex-1 min-w-0">
        {selectedId && bodies[selectedId] ? (
          <DocEditor key={selectedId} doc={bodies[selectedId]} onChange={onEdit} />
        ) : (
          <div className="bg-cream-card border-2 border-forest rounded-card min-h-[64vh] grid place-items-center p-8 text-center font-mono text-[.7rem] text-brown-soft">
            {selectedId ? "Loading…" : "No document selected — create one →"}
          </div>
        )}
      </div>
    </div>
  );
}
