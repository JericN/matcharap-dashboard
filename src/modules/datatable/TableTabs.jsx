"use client";
import { useId, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// One sortable sheet tab. Click selects, right-click opens the menu, drag (past
// the 5px sensor threshold) reorders; while renaming it swaps to a text input.
function SortableTab({ tab, isActive, isRenaming, draft, setDraft, inputRef, onSelect, onMenu, onCommitRename, onCancelRename }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });

  if (isRenaming) {
    return (
      <input
        ref={inputRef}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommitRename(tab.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommitRename(tab.id);
          else if (e.key === "Escape") onCancelRename();
        }}
        aria-label={"Rename sheet " + tab.name}
        className="field-box w-[130px] py-[6px] px-[11px] text-[.64rem]"
      />
    );
  }

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      onClick={() => onSelect(tab.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e, tab.id);
      }}
      aria-pressed={isActive}
      title="Drag to reorder · right-click to rename / delete"
      className={`chip cursor-grab active:cursor-grabbing${isActive ? " chip--active" : ""}`}
    >
      {tab.name}
    </button>
  );
}

// Horizontal row of "sheet" tabs for the expense planner. Click selects; drag to
// reorder (persisted via onReorder); the trailing ＋ adds; right-click a tab opens
// a cursor-anchored context menu (rename / delete) portaled to document.body.
// Inline rename swaps the pill for a text input. Persistence is up to the parent.
export default function TableTabs({ tabs, activeTabId, onSelect, onAdd, onRename, onDelete, onReorder }) {
  const dndId = useId();
  const [menu, setMenu] = useState(null); // right-click context menu {id, x, y} or null
  const [renameId, setRenameId] = useState(null); // tab id being inline-renamed, or null
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  const canDelete = tabs.length > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // click still selects
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Close the context menu on Escape (outside-click is handled by the backdrop).
  useEffect(() => {
    if (!menu) return;
    const onKey = (e) => e.key === "Escape" && setMenu(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  // Focus + select-all when an inline rename begins.
  useEffect(() => {
    if (renameId && inputRef.current) inputRef.current.select();
  }, [renameId]);

  const startRename = (tab) => {
    setMenu(null);
    setDraft(tab.name);
    setRenameId(tab.id);
  };
  const commitRename = (id) => {
    const v = draft.trim();
    if (v) onRename(id, v);
    setRenameId(null);
  };

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const ids = tabs.map((t) => t.id);
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };

  return (
    <div className="flex flex-wrap items-center gap-[7px]">
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab) => (
            <SortableTab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              isRenaming={renameId === tab.id}
              draft={draft}
              setDraft={setDraft}
              inputRef={inputRef}
              onSelect={onSelect}
              onMenu={(e, id) => setMenu({ id, x: e.clientX, y: e.clientY })}
              onCommitRename={commitRename}
              onCancelRename={() => setRenameId(null)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button type="button" onClick={onAdd} aria-label="Add sheet" className="chip px-[12px]">
        ＋
      </button>

      {menu &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[55]"
              onClick={() => setMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu(null);
              }}
              aria-hidden="true"
            />
            <div
              className="fixed z-[56] min-w-[150px] bg-cream-card border-2 border-forest rounded-[10px] shadow-hard-sm p-1"
              style={{ top: menu.y, left: menu.x }}
            >
              <button
                type="button"
                onClick={() => startRename(tabs.find((t) => t.id === menu.id))}
                className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-forest hover:bg-cream-light transition"
              >
                ✎ Rename
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    const id = menu.id;
                    setMenu(null);
                    onDelete(id);
                  }}
                  className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-clay hover:bg-cream-light transition"
                >
                  🗑 Delete
                </button>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
