"use client";
import { useId, useState, useEffect, useRef } from "react";
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
import CursorMenu from "./CursorMenu";

// One sortable view chip. Click selects, double-click / right-click renames,
// drag (past the 5px sensor threshold) reorders; while renaming it swaps to a
// text input. Mirrors TableTabs' SortableTab.
function SortableView({
  view,
  isActive,
  isRenaming,
  draft,
  setDraft,
  inputRef,
  onSelect,
  onMenu,
  onStartRename,
  onCommitRename,
  onCancelRename,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: view.id });

  if (isRenaming) {
    return (
      <input
        ref={inputRef}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommitRename(view.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommitRename(view.id);
          else if (e.key === "Escape") onCancelRename();
        }}
        aria-label={"Rename view " + view.name}
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
      onClick={() => onSelect(view.id)}
      onDoubleClick={() => onStartRename(view)}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e, view.id);
      }}
      aria-pressed={isActive}
      title="Drag to reorder · double-click or right-click to rename / delete"
      className={`chip cursor-grab active:cursor-grabbing${isActive ? " chip--active" : ""}`}
    >
      {view.name}
    </button>
  );
}

// Horizontal strip of saved views (the Airtable-style view switcher). Click
// selects; drag to reorder (persisted via onReorderViews); the trailing ＋ adds;
// double-click or right-click a view opens a cursor-anchored menu (rename /
// delete, portaled to document.body). Delete is guarded on the last view.
// Mirrors TableTabs — persistence is the parent's job.
export default function ViewBar({
  views,
  activeViewId,
  onSelectView,
  onAddView,
  onRenameView,
  onDeleteView,
  onReorderViews,
}) {
  const dndId = useId();
  const [menu, setMenu] = useState(null); // right-click menu {id, x, y} or null
  const [renameId, setRenameId] = useState(null); // view id being inline-renamed, or null
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  const canDelete = views.length > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // click still selects
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Focus + select-all when an inline rename begins.
  useEffect(() => {
    if (renameId && inputRef.current) inputRef.current.select();
  }, [renameId]);

  const startRename = (view) => {
    setMenu(null);
    setDraft(view.name);
    setRenameId(view.id);
  };
  const commitRename = (id) => {
    const v = draft.trim();
    if (v) onRenameView(id, v);
    setRenameId(null);
  };

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const ids = views.map((v) => v.id);
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    onReorderViews(arrayMove(ids, from, to));
  };

  return (
    <div className="flex flex-wrap items-center gap-[7px]">
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={views.map((v) => v.id)} strategy={horizontalListSortingStrategy}>
          {views.map((view) => (
            <SortableView
              key={view.id}
              view={view}
              isActive={view.id === activeViewId}
              isRenaming={renameId === view.id}
              draft={draft}
              setDraft={setDraft}
              inputRef={inputRef}
              onSelect={onSelectView}
              onMenu={(e, id) => setMenu({ id, x: e.clientX, y: e.clientY })}
              onStartRename={startRename}
              onCommitRename={commitRename}
              onCancelRename={() => setRenameId(null)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button type="button" onClick={onAddView} aria-label="Add view" className="chip px-[12px]">
        ＋
      </button>

      {menu && (
        <CursorMenu pos={{ x: menu.x, y: menu.y }} onClose={() => setMenu(null)}>
          <button
            type="button"
            onClick={() => startRename(views.find((v) => v.id === menu.id))}
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
                onDeleteView(id);
              }}
              className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-clay hover:bg-cream-light transition"
            >
              🗑 Delete
            </button>
          )}
        </CursorMenu>
      )}
    </div>
  );
}
