"use client";
import { useState, useRef, useEffect } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import RowMenu from "./RowMenu";
import DocRow from "./DocRow";

// A collapsible folder: a draggable header (reorders folders) + a droppable body
// that holds its DocRows and an end drop-zone. Dropping a doc on the header files
// it into this folder (handled by DocTree via the header's sortable data).
export default function FolderRow({
  folder,
  docs,
  collapsed,
  selectedId,
  onToggle,
  onSelect,
  onRenameFolder,
  onDeleteFolder,
  onNewDocInFolder,
  onRenameDoc,
  onDeleteDoc,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: "folder:" + folder.id,
    data: { type: "folder", folderId: folder.id },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: "container:" + folder.id,
    data: { type: "container", folderId: folder.id },
  });
  const [menu, setMenu] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  const startRename = () => {
    setDraft(folder.name || "");
    setEditing(true);
  };
  const commit = () => {
    const v = draft.trim();
    if (v && v !== folder.name) onRenameFolder(folder.id, v);
    setEditing(false);
  };

  const headerStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li>
      <div ref={setNodeRef} style={headerStyle} {...attributes} {...listeners}>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") setEditing(false);
            }}
            aria-label={"Rename folder " + (folder.name || "Untitled")}
            className="field-box w-full py-[6px] px-[8px] text-[.72rem]"
          />
        ) : (
          <div
            className="flex items-center gap-1 rounded-cell px-2 py-1.5 hover:bg-cream-light transition"
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()} // let the chevron click through the drag listeners
              onClick={() => onToggle(folder.id)}
              aria-label={collapsed ? "Expand folder" : "Collapse folder"}
              className="shrink-0 w-4 text-brown-soft"
            >
              {collapsed ? "▸" : "▾"}
            </button>
            <span className="flex-1 min-w-0 truncate font-doodle font-bold text-[.98rem] text-forest">
              📁 {folder.name || "Untitled folder"}
            </span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onNewDocInFolder(folder.id)}
              aria-label={"New document in " + (folder.name || "folder")}
              title="New document here"
              className="shrink-0 px-1 text-brown-soft hover:text-forest transition"
            >
              ＋
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <SortableContext
          items={docs.map((d) => "doc:" + d.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul
            ref={setDropRef}
            className={"flex flex-col gap-1 py-1 rounded-cell " + (isOver ? "bg-matcha-fill/30" : "")}
          >
            {docs.map((d) => (
              <DocRow
                key={d.id}
                doc={d}
                indent
                active={d.id === selectedId}
                onSelect={onSelect}
                onRename={onRenameDoc}
                onDelete={onDeleteDoc}
              />
            ))}
            {docs.length === 0 && (
              <li className="pl-[22px] py-1 font-mono text-[.58rem] text-brown-soft/70 italic">
                drop a doc here
              </li>
            )}
          </ul>
        </SortableContext>
      )}

      {menu && (
        <RowMenu
          pos={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: "✎ Rename", onClick: startRename },
            { label: "🗑 Delete folder", danger: true, onClick: () => onDeleteFolder(folder.id) },
          ]}
        />
      )}
    </li>
  );
}
