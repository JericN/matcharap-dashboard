"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { TextField, NumberField } from "@/components/form";
import { lineTotal, grandTotal, sharePct } from "@/features/expenses/calc";

// ₱ with up to 2 decimals (centavos shown only when present).
const peso = (n) => "₱" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const num = (v) => Math.max(0, Number(v) || 0);

// One shared column track so the header and every row line up exactly:
// grip · item · notes · date · price · qty · total · %.
const COLS =
  "26px minmax(130px,1.6fr) minmax(120px,1.4fr) 142px 104px 66px 104px 48px";

// Move `dragId` to sit where `targetId` currently is (used during live drag).
function moveTo(ids, dragId, targetId) {
  const arr = ids.filter((x) => x !== dragId);
  const i = arr.indexOf(targetId);
  if (i < 0) return ids;
  arr.splice(i, 0, dragId);
  return arr;
}

export default function ExpensesTable({
  rows,
  onAddRow,
  onEditField,
  onCommitField,
  onDeleteRow,
  onDuplicateRow,
  onReorder,
}) {
  // Presentational: renders one sheet's rows; parent owns state + persistence.
  const [menu, setMenu] = useState(null); // right-click menu { id, x, y } or null
  const [dragId, setDragId] = useState(null); // row being dragged, or null
  const [orderIds, setOrderIds] = useState(null); // live order during a drag

  const grand = grandTotal(rows);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  // While dragging we show the live order; otherwise the persisted order.
  const display = orderIds ? orderIds.map((id) => byId[id]).filter(Boolean) : rows;

  const startDrag = (e, id) => {
    setDragId(id);
    setOrderIds(rows.map((r) => r.id));
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id); // Firefox needs data to start a drag
  };
  const overRow = (e, id) => {
    if (!dragId || id === dragId) return;
    e.preventDefault();
    setOrderIds((prev) => moveTo(prev ?? rows.map((r) => r.id), dragId, id));
  };
  const endDrag = () => {
    if (dragId && orderIds) {
      const changed =
        orderIds.length !== rows.length ||
        orderIds.some((id, i) => rows[i]?.id !== id);
      if (changed) onReorder(orderIds);
    }
    setDragId(null);
    setOrderIds(null);
  };

  const headCell = "px-2 py-2 font-medium";
  const numHead = `${headCell} text-right`;

  return (
    <div className="bg-cream-card border-[2.2px] border-forest rounded-card shadow-hard-sm px-5 py-[18px] max-md:p-[14px]">
      <div className="overflow-x-auto">
        <div className="min-w-[740px]">
          {/* header */}
          <div
            className="grid items-center border-b-2 border-dashed border-brown-soft text-left font-mono text-[.52rem] tracking-[.1em] uppercase text-brown-soft"
            style={{ gridTemplateColumns: COLS }}
          >
            <span aria-hidden="true" />
            <span className={headCell}>Item</span>
            <span className={headCell}>Notes</span>
            <span className={headCell}>Date</span>
            <span className={numHead}>Price ₱</span>
            <span className={numHead}>Qty</span>
            <span className={numHead}>Total ₱</span>
            <span className={numHead}>%</span>
          </div>

          {/* rows */}
          {display.length === 0 ? (
            <p className="text-[.9rem] text-olive-soft text-center py-6">
              No line items yet. Add your first expense to start the plan →
            </p>
          ) : (
            display.map((r) => (
              <div
                key={r.id}
                className={`grid items-center border-b border-dashed border-brown-soft/30 transition-colors hover:bg-cream-light/40 ${
                  dragId === r.id ? "opacity-40" : ""
                }`}
                style={{ gridTemplateColumns: COLS }}
                onDragOver={(e) => overRow(e, r.id)}
                onDrop={(e) => e.preventDefault()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu({ id: r.id, x: e.clientX, y: e.clientY });
                }}
              >
                <div className="flex justify-center">
                  <span
                    draggable
                    onDragStart={(e) => startDrag(e, r.id)}
                    onDragEnd={endDrag}
                    role="button"
                    aria-label="Drag to reorder"
                    title="Drag to reorder"
                    className="cursor-grab active:cursor-grabbing select-none px-1 text-[.95rem] leading-none text-brown-soft hover:text-forest"
                  >
                    ⠿
                  </span>
                </div>
                <div className="py-0.5">
                  <TextField
                    variant="bare"
                    aria-label="Item name"
                    value={r.item}
                    onChange={(e) => onEditField(r.id, "item", e.target.value)}
                    onBlur={() => onCommitField(r.id, "item")}
                    placeholder="e.g. Matcha powder"
                  />
                </div>
                <div className="py-0.5">
                  <TextField
                    variant="bare"
                    aria-label="Notes"
                    value={r.notes}
                    onChange={(e) => onEditField(r.id, "notes", e.target.value)}
                    onBlur={() => onCommitField(r.id, "notes")}
                    placeholder="optional note"
                  />
                </div>
                <div className="py-0.5">
                  <TextField
                    type="date"
                    variant="bare"
                    aria-label="Date"
                    value={r.date}
                    onChange={(e) => onEditField(r.id, "date", e.target.value)}
                    onBlur={() => onCommitField(r.id, "date")}
                  />
                </div>
                <div className="py-0.5">
                  <NumberField
                    variant="bare"
                    aria-label="Price"
                    inputClassName="text-right"
                    min="0"
                    step="0.5"
                    value={r.price}
                    onChange={(e) => onEditField(r.id, "price", num(e.target.value))}
                    onBlur={() => onCommitField(r.id, "price")}
                  />
                </div>
                <div className="py-0.5">
                  <NumberField
                    variant="bare"
                    aria-label="Quantity"
                    inputClassName="text-right"
                    min="0"
                    step="1"
                    value={r.qty}
                    onChange={(e) => onEditField(r.id, "qty", num(e.target.value))}
                    onBlur={() => onCommitField(r.id, "qty")}
                  />
                </div>
                <span className="px-2 py-1.5 text-right font-mono text-[.92rem] font-medium text-forest whitespace-nowrap">
                  {peso(lineTotal(r))}
                </span>
                <span className="px-2 py-1.5 text-right font-mono text-[.72rem] text-clay whitespace-nowrap">
                  {sharePct(r, grand).toFixed(0)}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* inline ghost row — adding feels like writing the next line */}
      <button
        type="button"
        onClick={onAddRow}
        className="mt-2 w-full flex items-center gap-2 rounded-[9px] border-2 border-dashed border-brown-soft/40 px-2 py-2 font-mono text-[.72rem] tracking-wide text-olive-soft transition-colors hover:border-forest hover:text-forest hover:bg-cream-light"
      >
        <span className="w-[18px] text-center text-[.95rem] leading-none">＋</span>
        Add line item
      </button>

      {/* dedicated grand-total summary — right-aligned, not a line item */}
      {display.length > 0 && (
        <div className="mt-4 flex justify-end">
          <div className="flex items-baseline justify-between gap-8 min-w-[220px] border-t-2 border-forest pt-2.5">
            <span className="font-doodle font-bold text-[1.1rem] text-forest">Grand Total</span>
            <span className="font-mono text-[1.2rem] font-bold text-forest whitespace-nowrap">
              {peso(grand)}
            </span>
          </div>
        </div>
      )}

      {/* right-click row menu — duplicate / delete */}
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
              className="fixed z-[56] min-w-[160px] bg-cream-card border-2 border-forest rounded-[10px] shadow-hard-sm p-1"
              style={{ top: menu.y, left: menu.x }}
            >
              <button
                type="button"
                onClick={() => {
                  const id = menu.id;
                  setMenu(null);
                  onDuplicateRow(id);
                }}
                className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-forest hover:bg-cream-light transition"
              >
                ⧉ Duplicate row
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = menu.id;
                  setMenu(null);
                  onDeleteRow(id);
                }}
                className="block w-full text-left px-2.5 py-1.5 rounded-[7px] font-mono text-[.66rem] text-clay hover:bg-cream-light transition"
              >
                🗑 Delete row
              </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
