"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";
import {
  DndContext,
  DragOverlay,
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
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import Cell from "./cells/Cell";
import ValueView from "./cells/ValueView";
import ColumnMenu from "./ColumnMenu";
import AddColumnPopover from "./AddColumnPopover";
import OptionsEditor from "./OptionsEditor";
import CursorMenu from "./CursorMenu";
import { buildCtx } from "./linkDerive.mjs";

const GUTTER = 40; // row drag-handle gutter

// The lifted "whole column" that follows the cursor during a column drag: the
// field name atop each row's value, styled as a picked-up paper strip.
function ColumnGhost({ column, rows, width }) {
  return (
    <div
      style={{ width }}
      className="rounded-[10px] border-2 border-forest bg-cream-card shadow-hard rotate-[1.5deg] overflow-hidden cursor-grabbing"
    >
      <div className="px-2 py-2 border-b-2 border-dashed border-b-brown-soft bg-cream-card font-mono text-[.52rem] tracking-[.1em] uppercase text-brown-soft truncate">
        {column.name || "Field"}
      </div>
      {rows.map((r) => (
        <div
          key={r.id}
          className="px-2 py-[7px] min-h-[32px] flex items-center border-b border-dashed border-brown-soft/25 last:border-b-0"
        >
          <ValueView column={column} value={r.values[column.id]} />
        </div>
      ))}
    </div>
  );
}

// One sortable column header: a draggable label (drag to reorder, double-click to
// rename, RIGHT-CLICK for the field menu) and a right-edge resize strip. Drag
// listeners live only on the label; the resize strip stops propagation.
function HeaderCell({ header, renaming, renameDraft, setRenameDraft, onCommitRename, onCancelRename, onStartRename, onOpenMenu }) {
  const col = header.column.columnDef.meta.col;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
    data: { type: "column" },
  });
  // While THIS column is being dragged, the DragOverlay ghost shows the movement,
  // so the header stays put as a dimmed placeholder slot (other columns still
  // translate to animate the gap).
  const style = {
    width: header.getSize(),
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 30 : undefined,
  };
  return (
    <th
      ref={setNodeRef}
      style={style}
      role="columnheader"
      onContextMenu={(e) => {
        if (renaming) return; // let the input's native menu work while editing
        e.preventDefault();
        onOpenMenu(e, col.id);
      }}
      className="relative border-dashed border-b-2 border-l border-r border-b-brown-soft border-l-brown-soft/30 border-r-brown-soft/30 bg-cream-card p-0 text-left align-middle"
    >
      {renaming ? (
        <input
          autoFocus
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onFocus={(e) => e.target.select()}
          onBlur={onCommitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitRename();
            else if (e.key === "Escape") onCancelRename();
          }}
          aria-label="Rename field"
          className="field-box w-[calc(100%-8px)] m-1 py-[4px] px-[8px] text-[.62rem]"
        />
      ) : (
        <div className="flex items-center pl-2 pr-3 py-2">
          <span
            {...attributes}
            {...listeners}
            onDoubleClick={onStartRename}
            title={`${col.name || "Field"} — right-click for options · double-click to rename`}
            className="flex-1 truncate cursor-grab active:cursor-grabbing select-none font-mono text-[.52rem] tracking-[.1em] uppercase text-brown-soft"
          >
            {col.name || "Field"}
          </span>
        </div>
      )}
      {/* resize strip — eats the pointerdown so dnd never starts a drag here */}
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          header.getResizeHandler()(e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          header.getResizeHandler()(e);
        }}
        onDoubleClick={() => header.column.resetSize()}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize column"
        className={
          "absolute right-0 top-0 h-full w-[6px] cursor-col-resize touch-none select-none hover:bg-forest/20 " +
          (header.column.getIsResizing() ? "bg-forest/40" : "")
        }
      />
    </th>
  );
}

// One sortable body row: a drag-handle gutter then a typed cell per column.
// RIGHT-CLICK anywhere on the row opens its menu (duplicate / delete).
function BodyRow({ row, draggingColId, sortActive, ctx, link, onSetCell, onCreateOption, onRowMenu }) {
  const id = row.original.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "row" },
    disabled: sortActive, // a sorted view fixes the order — manual drag is off
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <tr
      ref={setNodeRef}
      style={style}
      role="row"
      className={"border-b border-dashed border-brown-soft/25 hover:bg-cream-light/40 " + (isDragging ? "bg-cream-light" : "")}
      onContextMenu={(e) => {
        e.preventDefault();
        onRowMenu(e, id);
      }}
    >
      <td
        style={{ width: GUTTER }}
        className="bg-cream-card align-middle border-r border-dashed border-r-brown-soft/30"
      >
        <div className="flex items-center justify-center">
          {sortActive ? (
            <span
              aria-hidden="true"
              title="Sorted — clear the sort to reorder rows"
              className="select-none text-brown-soft/30 px-0.5 text-[.92rem] leading-none cursor-default"
            >
              ⠿
            </span>
          ) : (
            <span
              {...attributes}
              {...listeners}
              role="button"
              aria-label="Drag to reorder row"
              title="Drag to reorder · right-click the row for options"
              className="cursor-grab active:cursor-grabbing select-none text-brown-soft hover:text-forest px-0.5 text-[.92rem] leading-none"
            >
              ⠿
            </span>
          )}
        </div>
      </td>
      {row.getVisibleCells().map((cell) => {
        const col = cell.column.columnDef.meta.col;
        const lifted = draggingColId === col.id; // this column is being dragged → dim it in place
        return (
          <td
            key={cell.id}
            role="gridcell"
            className={
              "align-middle px-0.5 border-l border-r border-dashed border-l-brown-soft/20 border-r-brown-soft/20 " +
              (lifted ? "opacity-30" : "")
            }
          >
            <Cell
              column={col}
              value={cell.getValue()}
              row={row.original}
              ctx={ctx}
              link={link}
              onCommit={(v) => onSetCell(id, col.id, v)}
              onCreateOption={(name) => onCreateOption(col.id, name)}
            />
          </td>
        );
      })}
    </tr>
  );
}

export default function Grid({
  columns,
  rows,
  sortActive = false,
  totalCount,
  filteredCount,
  onClearFilter,
  onSetCell,
  onAddRow,
  onDeleteRow,
  onDuplicateRow,
  onReorderRows,
  onAddColumn,
  onAddLinkColumn,
  onRenameColumn,
  onResizeColumn,
  onSetColumnFormat,
  onReorderColumns,
  onDeleteColumn,
  onToggleLinkSingle,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  link,
}) {
  const dndId = useId(); // stable DndContext id → no SSR/client aria-describedby mismatch
  const ctx = useMemo(() => buildCtx(link?.tables ?? [], link?.allRows ?? []), [link?.tables, link?.allRows]);
  const [sizing, setSizing] = useState({}); // live column-resize overrides (id → px)
  const [dragType, setDragType] = useState(null); // "column" | "row" | null (axis lock)
  const [activeColId, setActiveColId] = useState(null); // the column being dragged → ghost + dim source
  const [colMenu, setColMenu] = useState(null); // { colId, rect, pos } — rect anchors the options editor, pos is the cursor
  const [optionsEditor, setOptionsEditor] = useState(null); // { colId, rect }
  const [addColRect, setAddColRect] = useState(null);
  const [rowMenu, setRowMenu] = useState(null); // { rowId, pos:{x,y} }
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [mounted, setMounted] = useState(false); // gate the body-portaled DragOverlay until after hydration
  useEffect(() => setMounted(true), []);

  const columnDefs = useMemo(
    () =>
      columns.map((col) => ({
        id: col.id,
        accessorFn: (row) => row.values[col.id],
        size: col.width,
        meta: { col },
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    columnResizeMode: "onChange",
    defaultColumn: { minSize: 64, maxSize: 800 },
    state: { columnSizing: sizing },
    onColumnSizingChange: setSizing,
    getCoreRowModel: getCoreRowModel(),
  });

  // Persist a column's width once its resize gesture ends.
  const isResizing = table.getState().columnSizingInfo.isResizingColumn;
  const prevResizing = useRef(null);
  useEffect(() => {
    if (prevResizing.current && !isResizing) {
      const colId = prevResizing.current;
      const w = table.getColumn(colId)?.getSize();
      if (w) onResizeColumn(colId, Math.round(w));
    }
    prevResizing.current = isResizing;
  }, [isResizing]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = ({ active }) => {
    const type = active.data.current?.type ?? null;
    setDragType(type);
    setActiveColId(type === "column" ? active.id : null);
  };
  const onDragEnd = ({ active, over }) => {
    setDragType(null);
    setActiveColId(null);
    if (!over || active.id === over.id) return;
    const type = active.data.current?.type;
    if (type === "column") {
      const ids = columns.map((c) => c.id);
      const from = ids.indexOf(active.id);
      const to = ids.indexOf(over.id);
      if (from < 0 || to < 0) return;
      onReorderColumns(arrayMove(ids, from, to));
    } else if (type === "row") {
      const ids = rows.map((r) => r.id);
      const from = ids.indexOf(active.id);
      const to = ids.indexOf(over.id);
      if (from < 0 || to < 0) return;
      onReorderRows(arrayMove(ids, from, to));
    }
  };
  // Lock a column drag to the horizontal axis and a row drag to the vertical.
  const modifiers =
    dragType === "column" ? [restrictToHorizontalAxis] : dragType === "row" ? [restrictToVerticalAxis] : [];

  const startRename = (colId) => {
    const col = columns.find((c) => c.id === colId);
    if (!col) return;
    setColMenu(null);
    setRenameDraft(col.name);
    setRenamingId(colId);
  };
  const commitRename = () => {
    const v = renameDraft.trim();
    const col = columns.find((c) => c.id === renamingId);
    if (v && col && v !== col.name) onRenameColumn(renamingId, v);
    setRenamingId(null);
  };

  const colMenuCol = colMenu ? columns.find((c) => c.id === colMenu.colId) : null;
  const optionsCol = optionsEditor ? columns.find((c) => c.id === optionsEditor.colId) : null;
  const columnIds = columns.map((c) => c.id);
  const rowIds = rows.map((r) => r.id);
  const tableWidth = GUTTER + table.getTotalSize();
  const draggingColId = dragType === "column" ? activeColId : null;
  const ghostCol = draggingColId ? columns.find((c) => c.id === draggingColId) : null;
  const ghostWidth = draggingColId ? (table.getColumn(draggingColId)?.getSize() ?? ghostCol?.width ?? 160) : 160;

  return (
    <div className="bg-cream-card border-[2.2px] border-forest rounded-card shadow-hard-sm px-4 py-4 max-md:p-3">
      {columns.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[.9rem] text-olive-soft mb-3">This sheet has no columns yet.</p>
          <button
            type="button"
            onClick={(e) => setAddColRect(e.currentTarget.getBoundingClientRect())}
            className="chip chip--active px-4"
          >
            ＋ Add column
          </button>
        </div>
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={modifiers}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDragType(null);
            setActiveColId(null);
          }}
        >
          <div className="overflow-x-auto">
            <table
              role="grid"
              className="border-separate"
              style={{ tableLayout: "fixed", borderSpacing: 0, width: tableWidth, minWidth: tableWidth }}
            >
              {/* Authoritative column widths — <col> is immune to content-based sizing. */}
              <colgroup>
                <col style={{ width: GUTTER }} />
                {table.getVisibleLeafColumns().map((col) => (
                  <col key={col.id} style={{ width: col.getSize() }} />
                ))}
              </colgroup>
              <thead>
                <tr role="row">
                  <th
                    style={{ width: GUTTER }}
                    className="bg-cream-card border-dashed border-b-2 border-r border-b-brown-soft border-r-brown-soft/30"
                    aria-hidden="true"
                  />
                  <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                    {table.getHeaderGroups()[0].headers.map((header) => (
                      <HeaderCell
                        key={header.id}
                        header={header}
                        renaming={renamingId === header.column.id}
                        renameDraft={renameDraft}
                        setRenameDraft={setRenameDraft}
                        onCommitRename={commitRename}
                        onCancelRename={() => setRenamingId(null)}
                        onStartRename={() => startRename(header.column.id)}
                        onOpenMenu={(e, colId) =>
                          setColMenu({
                            colId,
                            rect: e.currentTarget.getBoundingClientRect(),
                            pos: { x: e.clientX, y: e.clientY },
                          })
                        }
                      />
                    ))}
                  </SortableContext>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="text-center py-6 text-[.85rem] text-olive-soft">
                      {totalCount > 0 ? (
                        <span>
                          No records match this view.{" "}
                          <button
                            type="button"
                            onClick={onClearFilter}
                            className="underline decoration-dashed underline-offset-2 text-forest hover:text-clay"
                          >
                            Clear filter
                          </button>
                        </span>
                      ) : (
                        "No rows yet. Add your first line below →"
                      )}
                    </td>
                  </tr>
                ) : (
                  <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                    {table.getRowModel().rows.map((row) => (
                      <BodyRow
                        key={row.original.id}
                        row={row}
                        draggingColId={draggingColId}
                        sortActive={sortActive}
                        ctx={ctx}
                        link={link}
                        onSetCell={onSetCell}
                        onCreateOption={onAddOption}
                        onRowMenu={(e, rowId) => setRowMenu({ rowId, pos: { x: e.clientX, y: e.clientY } })}
                      />
                    ))}
                  </SortableContext>
                )}
              </tbody>
            </table>
          </div>
          {/* The whole dragged column, lifted, following the cursor (horizontal only).
              Portaled to <body>: the /expenses (and /documents) <section> uses a
              `-translate-x-1/2` transform, which would otherwise become the containing
              block for this overlay's `position:fixed` and offset the ghost from the
              pointer. Kept inside DndContext in the React tree so it still gets context. */}
          {mounted &&
            createPortal(
              <DragOverlay modifiers={[restrictToHorizontalAxis]} dropAnimation={null}>
                {ghostCol ? <ColumnGhost column={ghostCol} rows={rows} width={ghostWidth} /> : null}
              </DragOverlay>,
              document.body,
            )}
        </DndContext>
      )}

      {/* add-row ghost line — always visible below the scroll region */}
      {columns.length > 0 && (
        <button
          type="button"
          onClick={onAddRow}
          className="mt-2 w-full flex items-center gap-2 rounded-[9px] border-2 border-dashed border-brown-soft/40 px-2 py-2 font-mono text-[.72rem] tracking-wide text-olive-soft transition-colors hover:border-forest hover:text-forest hover:bg-cream-light"
        >
          <span className="w-[18px] text-center text-[.95rem] leading-none">＋</span>
          Add row
        </button>
      )}

      {/* column header menu */}
      {colMenuCol && (
        <ColumnMenu
          column={colMenuCol}
          pos={colMenu.pos}
          onClose={() => setColMenu(null)}
          onAddField={() => {
            setAddColRect(colMenu.rect);
            setColMenu(null);
          }}
          onRename={() => startRename(colMenu.colId)}
          onDelete={() => onDeleteColumn(colMenu.colId)}
          onToggleSingle={() => onToggleLinkSingle(colMenu.colId)}
          onSetFormat={(number) => onSetColumnFormat(colMenu.colId, number)}
          onEditOptions={() => {
            setOptionsEditor({ colId: colMenu.colId, rect: colMenu.rect });
            setColMenu(null);
          }}
        />
      )}

      {/* select/multiSelect option editor */}
      {optionsCol && (
        <OptionsEditor
          column={optionsCol}
          rect={optionsEditor.rect}
          onClose={() => setOptionsEditor(null)}
          onAddOption={(name) => onAddOption(optionsEditor.colId, name)}
          onUpdateOption={(optionId, patch) => onUpdateOption(optionsEditor.colId, optionId, patch)}
          onDeleteOption={(optionId) => onDeleteOption(optionsEditor.colId, optionId)}
        />
      )}

      {/* add-column popover */}
      {addColRect && (
        <AddColumnPopover
          rect={addColRect}
          onClose={() => setAddColRect(null)}
          onCreate={(name, type) => onAddColumn(name, type)}
          tables={link?.tables ?? []}
          currentTabId={link?.currentTabId}
          onCreateLink={(name, targetTabId, single) => onAddLinkColumn(name, targetTabId, single)}
        />
      )}

      {/* row context menu */}
      {rowMenu && (
        <CursorMenu pos={rowMenu.pos} onClose={() => setRowMenu(null)}>
          <button
            type="button"
            onClick={() => {
              const id = rowMenu.rowId;
              setRowMenu(null);
              onDuplicateRow(id);
            }}
            className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-forest hover:bg-cream-light transition"
          >
            ⧉ Duplicate row
          </button>
          <button
            type="button"
            onClick={() => {
              const id = rowMenu.rowId;
              setRowMenu(null);
              onDeleteRow(id);
            }}
            className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-clay hover:bg-cream-light transition"
          >
            🗑 Delete row
          </button>
        </CursorMenu>
      )}
    </div>
  );
}
