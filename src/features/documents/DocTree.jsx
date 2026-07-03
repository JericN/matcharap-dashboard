"use client";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import FolderRow from "./FolderRow";
import DocRow from "./DocRow";

// Owns the single DndContext. Renders folders (each a sortable header + droppable
// body) then the root docs (a droppable container). onDragEnd resolves a drop into
// either a folder reorder or a doc move (targetFolderId + beforeId anchor).
export default function DocTree({
  index,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
  onRenameDoc,
  onDeleteDoc,
  onRenameFolder,
  onDeleteFolder,
  onNewDocInFolder,
  onMoveDoc,
  onMoveFolder,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // click still selects
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const folderIdSet = new Set(index.folders.map((f) => f.id));
  const docsIn = (fid) => index.docs.filter((d) => d.folderId === fid);
  // Root shows unfiled docs AND any doc whose folder no longer exists (e.g. a
  // concurrent folder-delete raced a move-into-that-folder) — self-healing so a
  // doc is never hidden; also hardens against any legacy/bad folderId on read.
  const rootDocs = index.docs.filter((d) => d.folderId == null || !folderIdSet.has(d.folderId));
  const { setNodeRef: setRootRef, isOver: rootOver } = useDroppable({
    id: "container:__root__",
    data: { type: "container", folderId: null },
  });

  const onDragEnd = ({ active, over }) => {
    if (!over) return;
    const a = active.data.current;
    const o = over.data.current;
    if (!a || !o) return;

    if (a.type === "folder") {
      if (o.type === "folder" && active.id !== over.id) onMoveFolder(a.folderId, o.folderId);
      return;
    }
    if (a.type === "doc") {
      let folderId, beforeId;
      if (o.type === "doc") {
        folderId = o.folderId;
        beforeId = o.docId;
      } else if (o.type === "container") {
        folderId = o.folderId;
        beforeId = null;
      } else if (o.type === "folder") {
        folderId = o.folderId; // dropped onto a (possibly collapsed) folder header → file into it
        beforeId = null;
      } else {
        return;
      }
      if (a.docId === beforeId) return; // dropped onto itself
      onMoveDoc(a.docId, folderId, beforeId);
    }
  };

  const folderIds = index.folders.map((f) => "folder:" + f.id);
  const rootIds = rootDocs.map((d) => "doc:" + d.id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      {/* Folders reorder within THIS context; each folder's docs get their own
          SortableContext inside FolderRow, so the folder header isn't trapped in
          a doc context. */}
      <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1">
          {index.folders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              docs={docsIn(folder.id)}
              collapsed={!!collapsed[folder.id]}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onNewDocInFolder={onNewDocInFolder}
              onRenameDoc={onRenameDoc}
              onDeleteDoc={onDeleteDoc}
            />
          ))}
        </ul>
      </SortableContext>

      {/* root / unfiled docs */}
      <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={setRootRef}
          className={"flex flex-col gap-1 mt-1 min-h-[26px] rounded-cell " + (rootOver ? "bg-matcha-fill/30" : "")}
        >
          {rootDocs.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              active={d.id === selectedId}
              onSelect={onSelect}
              onRename={onRenameDoc}
              onDelete={onDeleteDoc}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
