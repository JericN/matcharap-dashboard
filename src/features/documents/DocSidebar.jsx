"use client";
import { useLocalState } from "@/lib/useLocalState";
import DocTree from "./DocTree";

// Sidebar card: header buttons (＋ New document / ＋ New folder) + the DnD tree.
// Owns only per-browser view state (which folders are collapsed); all data ops
// are callbacks up to DocumentsApp. The per-row 🗑 is gone — delete is right-click.
export default function DocSidebar({
  index,
  selectedId,
  onSelect,
  onNewDoc,
  onNewFolder,
  onRenameDoc,
  onDeleteDoc,
  onRenameFolder,
  onDeleteFolder,
  onNewDocInFolder,
  onMoveDoc,
  onMoveFolder,
}) {
  const [collapsed, setCollapsed] = useLocalState("docs:collapsed", {}); // { [folderId]: true }
  const toggle = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const empty = index.folders.length === 0 && index.docs.length === 0;

  return (
    <div className="bg-cream-card border-2 border-forest rounded-card p-2">
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => onNewDoc(null)}
          className="chip chip--active normal-case tracking-normal flex-1"
        >
          ＋ Document
        </button>
        <button
          type="button"
          onClick={onNewFolder}
          className="chip normal-case tracking-normal flex-1"
        >
          ＋ Folder
        </button>
      </div>

      {empty ? (
        <p className="px-2 py-3 text-center font-mono text-[.66rem] text-brown-soft">
          No documents yet
        </p>
      ) : (
        <DocTree
          index={index}
          selectedId={selectedId}
          collapsed={collapsed}
          onToggle={toggle}
          onSelect={onSelect}
          onRenameDoc={onRenameDoc}
          onDeleteDoc={onDeleteDoc}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onNewDocInFolder={onNewDocInFolder}
          onMoveDoc={onMoveDoc}
          onMoveFolder={onMoveFolder}
        />
      )}
    </div>
  );
}
