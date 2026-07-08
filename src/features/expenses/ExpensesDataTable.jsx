"use client";
// Consumer shim: builds the expense adapter (a closure-object of server actions —
// which can't cross the server→client boundary, so it must be constructed in a
// client component) and mounts the use-agnostic <DataTable>. The server page.js
// renders THIS and passes only data.
import { DataTable } from "@/modules/datatable";
import { defaultColumns } from "@/config/expenseModel.mjs";
import {
  setExpenseCell,
  addExpense,
  removeExpense,
  duplicateExpense,
  reorderExpenses,
  addColumn,
  updateColumn,
  reorderColumns,
  deleteColumn,
  restoreColumn,
  addOption,
  updateOption,
  deleteOption,
  restoreOption,
  addExpenseTab,
  renameExpenseTab,
  removeExpenseTab,
  reorderExpenseTabs,
  restoreTab,
  addView,
  updateView,
  removeView,
  reorderViews,
  restoreView,
} from "@/config/actions";

// Map the module's granular adapter callbacks → the expense server actions. Every
// method is a single-item / atomic delta off FRESH server state (concurrency-safe);
// the module mints ids and hands over pre-built objects — the adapter only persists.
// Names are kept identical to today's actions to avoid contract drift.
const expenseAdapter = {
  // rows
  setCell: setExpenseCell,
  addRow: addExpense,
  removeRow: removeExpense,
  duplicateRow: duplicateExpense,
  reorderRows: reorderExpenses,
  // columns
  addColumn,
  updateColumn,
  reorderColumns,
  deleteColumn,
  restoreColumn,
  // options
  addOption,
  updateOption,
  deleteOption,
  restoreOption,
  // tables (stored as "tabs")
  addTable: addExpenseTab,
  renameTable: renameExpenseTab,
  removeTable: removeExpenseTab,
  reorderTables: reorderExpenseTabs,
  restoreTable: restoreTab,
  // views
  addView,
  updateView,
  removeView,
  reorderViews,
  restoreView,
};

export default function ExpensesDataTable({ initialTabs, initialExpenses }) {
  return (
    <DataTable
      initialTables={initialTabs}
      initialRows={initialExpenses}
      adapter={expenseAdapter}
      storageKey="expenses"
      makeDefaultColumns={defaultColumns}
    />
  );
}
