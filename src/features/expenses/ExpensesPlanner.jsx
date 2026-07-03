"use client";
import { useState, useTransition } from "react";
import {
  addExpense,
  updateExpense,
  removeExpense,
  reorderExpenses,
  addExpenseTab,
  renameExpenseTab,
  removeExpenseTab,
} from "@/config/actions";
import TabBar from "@/features/expenses/TabBar";
import ExpensesTable from "@/features/expenses/ExpensesTable";

// Reorder one tab's rows within the global list to match `orderedIds`, leaving
// other tabs' rows in their slots (mirrors repo.reorderExpenses on the client).
function reorderRows(rows, tabId, orderedIds) {
  const byId = new Map(rows.filter((r) => r.tabId === tabId).map((r) => [r.id, r]));
  const seq = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  const seen = new Set(seq.map((r) => r.id));
  for (const r of byId.values()) if (!seen.has(r.id)) seq.push(r);
  let k = 0;
  return rows.map((r) => (r.tabId === tabId ? seq[k++] : r));
}

// Top-level planner: owns optimistic tab + row state; persists each change
// to the shared store. Local state mirrors the store; edits commit on blur,
// add/delete persist immediately via useTransition.
export default function ExpensesPlanner({ initialTabs, initialExpenses }) {
  const [tabs, setTabs] = useState(initialTabs);
  const [rows, setRows] = useState(initialExpenses);
  const [activeTabId, setActiveTabId] = useState(initialTabs[0]?.id);
  const [, startTransition] = useTransition();

  // Guard against the active tab having been deleted.
  const activeId = tabs.some((t) => t.id === activeTabId) ? activeTabId : tabs[0]?.id;
  const activeRows = rows.filter((r) => r.tabId === activeId);

  // --- row handlers (scoped to the active tab) ---
  const onAddRow = () => {
    const row = {
      id: crypto.randomUUID(),
      tabId: activeId,
      item: "",
      notes: "",
      date: "",
      price: 0,
      qty: 1,
    };
    setRows((rs) => [...rs, row]);
    startTransition(() => addExpense(row));
  };
  const onEditField = (id, key, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  const onCommitField = (id, key) => {
    const r = rows.find((x) => x.id === id);
    if (r) startTransition(() => updateExpense(id, { [key]: r[key] }));
  };
  const onDeleteRow = (id) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    startTransition(() => removeExpense(id));
  };
  // Duplicate a row: clone it (fresh id) and drop the copy directly below.
  const onDuplicateRow = (id) => {
    const src = rows.find((r) => r.id === id);
    if (!src) return;
    const copy = { ...src, id: crypto.randomUUID() };
    setRows((rs) => {
      const i = rs.findIndex((r) => r.id === id);
      const next = rs.slice();
      next.splice(i + 1, 0, copy);
      return next;
    });
    startTransition(() => addExpense(copy, id));
  };
  // Reorder the active tab to `orderedIds` (ids of that tab's rows, new order).
  const onReorder = (orderedIds) => {
    setRows((rs) => reorderRows(rs, activeId, orderedIds));
    startTransition(() => reorderExpenses(activeId, orderedIds));
  };

  // --- tab handlers ---
  const addTab = () => {
    const id = crypto.randomUUID();
    const name = `Sheet ${tabs.length + 1}`;
    setTabs((ts) => [...ts, { id, name }]);
    setActiveTabId(id);
    startTransition(() => addExpenseTab({ id, name }));
  };
  const renameTab = (id, name) => {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
    startTransition(() => renameExpenseTab(id, name));
  };
  const deleteTab = (id) => {
    if (tabs.length <= 1) return;
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    setRows((rs) => rs.filter((r) => r.tabId !== id));
    if (activeId === id) setActiveTabId(remaining[0].id);
    startTransition(() => removeExpenseTab(id));
  };

  return (
    <div>
      <div className="mb-3">
        <TabBar
          tabs={tabs}
          activeTabId={activeId}
          onSelect={setActiveTabId}
          onAdd={addTab}
          onRename={renameTab}
          onDelete={deleteTab}
        />
      </div>
      <ExpensesTable
        rows={activeRows}
        onAddRow={onAddRow}
        onEditField={onEditField}
        onCommitField={onCommitField}
        onDeleteRow={onDeleteRow}
        onDuplicateRow={onDuplicateRow}
        onReorder={onReorder}
      />
    </div>
  );
}
