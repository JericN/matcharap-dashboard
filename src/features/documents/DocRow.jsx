"use client";
import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import RowMenu from "./RowMenu";

// One draggable document row. Click selects; right-click opens Rename/Delete;
// Rename swaps the label for an inline input (Enter/blur commit, Escape cancel).
// `indent` shifts docs that live inside a folder.
export default function DocRow({ doc, indent, active, onSelect, onRename, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: "doc:" + doc.id,
    data: { type: "doc", docId: doc.id, folderId: doc.folderId },
  });
  const [menu, setMenu] = useState(null); // {x,y} | null
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.select();
  }, [editing]);

  const startRename = () => {
    setDraft(doc.title || "");
    setEditing(true);
  };
  const commit = () => {
    const v = draft.trim();
    if (v && v !== doc.title) onRename(doc.id, v);
    setEditing(false);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    paddingLeft: indent ? 22 : 8,
  };

  if (editing) {
    return (
      <li>
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
          aria-label={"Rename " + (doc.title || "Untitled")}
          className="field-box w-full py-[6px] px-[8px] text-[.7rem]"
          style={{ marginLeft: indent ? 14 : 0 }}
        />
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        type="button"
        onClick={() => onSelect(doc.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation(); // don't also trigger the sidebar's add-menu
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        title={doc.title}
        className={
          "block w-full min-w-0 text-left truncate font-doodle text-[.82rem] rounded-cell px-2 py-1 transition " +
          (active ? "bg-matcha-fill text-forest" : "hover:bg-cream-light")
        }
      >
        {doc.title || "Untitled"}
      </button>
      {menu && (
        <RowMenu
          pos={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: "✎ Rename", onClick: startRename },
            { label: "🗑 Delete", danger: true, onClick: () => onDelete(doc.id) },
          ]}
        />
      )}
    </li>
  );
}
