"use client";
import { useState } from "react";
import { useLocalState } from "@/lib/useLocalState";
import DocTree from "./DocTree";
import RowMenu from "./RowMenu";

// Sidebar card: the DnD tree. Add a document/folder by RIGHT-CLICKING empty space
// in the sidebar (no header buttons). Owns only per-browser view state (which
// folders are collapsed) + the add-menu position; all data ops are callbacks up to
// DocumentsApp. Per-row menus are RIGHT-CLICK only (no ⋯ / 🗑 buttons).
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
  const [menu, setMenu] = useState(null); // add-menu {x,y} | null (right-click empty space)
  const toggle = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const empty = index.folders.length === 0 && index.docs.length === 0;

  return (
    <div
      className="bg-cream-card border-2 border-forest rounded-card p-2 min-h-[140px]"
      onContextMenu={(e) => {
        // right-click on empty sidebar space → add menu (rows stopPropagation their own)
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {empty ? (
        <p className="px-2 py-8 text-center font-mono text-[.62rem] text-brown-soft leading-relaxed">
          No documents yet —<br />
          right-click here to add
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
      {menu && (
        <RowMenu
          pos={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: "＋ New document", onClick: () => onNewDoc(null) },
            { label: "＋ New folder", onClick: onNewFolder },
          ]}
        />
      )}
    </div>
  );
}
