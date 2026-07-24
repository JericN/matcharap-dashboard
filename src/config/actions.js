"use server";
import { revalidatePath } from "next/cache";
import { repo } from "@/config/repo";
import * as docs from "@/config/documents";
import * as voting from "@/config/voting";

// Client-callable boundary: write through the DAL, then revalidate the routes
// whose server reads depend on the changed state.

export async function toggleEvent(name) {
  await repo.toggleEvent(name);
  revalidatePath("/events");
}

export async function togglePowder(name) {
  await repo.togglePowder(name);
  revalidatePath("/powders");
  revalidatePath("/calculator"); // matcha options derive from saved powders
}

export async function toggleMilk(name) {
  await repo.toggleMilk(name);
  revalidatePath("/milks");
  revalidatePath("/calculator");
}

export async function savePowder(name, patch) {
  await repo.savePowder(name, patch);
  revalidatePath("/powders");
  revalidatePath("/calculator"); // matcha ₱/g derives from price/grams
}

export async function saveMilk(name, patch) {
  await repo.saveMilk(name, patch);
  revalidatePath("/milks");
  revalidatePath("/calculator");
}

export async function toggleDrink(name) {
  await repo.toggleDrink(name);
  revalidatePath("/drinks");
  revalidatePath("/calculator");
}

export async function toggleCompetitor(name) {
  await repo.toggleCompetitor(name);
  revalidatePath("/competitors");
}

export async function setSrp(drink, price) {
  await repo.setSrp(drink, price);
  revalidatePath("/calculator");
}

export async function setPriceOverride(key, price) {
  await repo.setPriceOverride(key, price);
  revalidatePath("/calculator");
}

export async function resetPriceOverride(key) {
  await repo.resetPriceOverride(key);
  revalidatePath("/calculator");
}

export async function attachIngredient(drink, ingredient) {
  await repo.attachIngredient(drink, ingredient);
  revalidatePath("/drinks");
  revalidatePath("/calculator");
}

export async function detachIngredient(drink, ingredient) {
  await repo.detachIngredient(drink, ingredient);
  revalidatePath("/drinks");
  revalidatePath("/calculator");
}

export async function toggleBase(drink, base) {
  await repo.toggleBase(drink, base);
  revalidatePath("/drinks");
  revalidatePath("/calculator");
}

export async function addIngredient(ingredient) {
  await repo.addIngredient(ingredient);
  revalidatePath("/drinks");
  revalidatePath("/calculator");
}

export async function editIngredient(name, patch) {
  await repo.editIngredient(name, patch);
  revalidatePath("/drinks");
  revalidatePath("/calculator");
}

export async function deleteIngredient(name) {
  await repo.deleteIngredient(name);
  revalidatePath("/drinks");
  revalidatePath("/calculator");
}

export async function saveDrink(drink, isNew) {
  await repo.saveDrink(drink, isNew);
  revalidatePath("/drinks");
  revalidatePath("/calculator");
}

export async function deleteDrink(name) {
  await repo.deleteDrink(name);
  revalidatePath("/drinks");
  revalidatePath("/calculator");
}

export async function setCosts(patch) {
  await repo.setCosts(patch);
  revalidatePath("/calculator");
}

export async function addExpense(row, afterId) {
  await repo.addExpense(row, afterId);
  revalidatePath("/expenses");
}

export async function setExpenseCell(rowId, colId, value) {
  await repo.setExpenseCell(rowId, colId, value);
  revalidatePath("/expenses");
}

export async function duplicateExpense(rowId, newId, afterId) {
  await repo.duplicateExpense(rowId, newId, afterId);
  revalidatePath("/expenses");
}

export async function removeExpense(id) {
  await repo.removeExpense(id);
  revalidatePath("/expenses");
}

export async function reorderExpenses(tabId, orderedIds) {
  await repo.reorderExpenses(tabId, orderedIds);
  revalidatePath("/expenses");
}

export async function addColumn(tabId, column) {
  await repo.addColumn(tabId, column);
  revalidatePath("/expenses");
}

export async function updateColumn(tabId, colId, patch) {
  await repo.updateColumn(tabId, colId, patch);
  revalidatePath("/expenses");
}

export async function reorderColumns(tabId, orderedIds) {
  await repo.reorderColumns(tabId, orderedIds);
  revalidatePath("/expenses");
}

export async function deleteColumn(tabId, colId) {
  await repo.deleteColumn(tabId, colId);
  revalidatePath("/expenses");
}

// ---- linked-record columns (two-way symmetric) ----
export async function addLinkPair(tabAId, colA, tabBId, colB) {
  await repo.addLinkPair(tabAId, colA, tabBId, colB);
  revalidatePath("/expenses");
}
export async function addRef(rowId, colId, targetId) {
  await repo.addRef(rowId, colId, targetId);
  revalidatePath("/expenses");
}
export async function removeRef(rowId, colId, targetId) {
  await repo.removeRef(rowId, colId, targetId);
  revalidatePath("/expenses");
}
export async function deleteLinkColumn(tabId, colId) {
  await repo.deleteLinkColumn(tabId, colId);
  revalidatePath("/expenses");
}
export async function restoreLinkColumn(removed) {
  await repo.restoreLinkColumn(removed);
  revalidatePath("/expenses");
}

export async function addOption(tabId, colId, option) {
  await repo.addOption(tabId, colId, option);
  revalidatePath("/expenses");
}

export async function updateOption(tabId, colId, optionId, patch) {
  await repo.updateOption(tabId, colId, optionId, patch);
  revalidatePath("/expenses");
}

export async function deleteOption(tabId, colId, optionId) {
  await repo.deleteOption(tabId, colId, optionId);
  revalidatePath("/expenses");
}

// undo/redo restores (viewRefs re-applies the deleted column/option's filter/sort/
// hidden footprint across the table's views)
export async function restoreColumn(tabId, column, index, cells, viewRefs) {
  await repo.restoreColumn(tabId, column, index, cells, viewRefs);
  revalidatePath("/expenses");
}

export async function restoreOption(tabId, colId, option, index, cells, viewRefs) {
  await repo.restoreOption(tabId, colId, option, index, cells, viewRefs);
  revalidatePath("/expenses");
}

export async function restoreTab(tab, index, tabRows) {
  await repo.restoreTab(tab, index, tabRows);
  revalidatePath("/expenses");
}

export async function addExpenseTab(tab) {
  await repo.addExpenseTab(tab);
  revalidatePath("/expenses");
}

export async function renameExpenseTab(id, name) {
  await repo.renameExpenseTab(id, name);
  revalidatePath("/expenses");
}

export async function removeExpenseTab(id) {
  await repo.removeExpenseTab(id);
  revalidatePath("/expenses");
}

export async function reorderExpenseTabs(orderedIds) {
  await repo.reorderExpenseTabs(orderedIds);
  revalidatePath("/expenses");
}

// ---- views (per-table saved lenses) ----
export async function addView(tabId, view) {
  await repo.addView(tabId, view);
  revalidatePath("/expenses");
}

export async function updateView(tabId, viewId, patch) {
  await repo.updateView(tabId, viewId, patch);
  revalidatePath("/expenses");
}

export async function removeView(tabId, viewId) {
  await repo.removeView(tabId, viewId);
  revalidatePath("/expenses");
}

export async function reorderViews(tabId, orderedIds) {
  await repo.reorderViews(tabId, orderedIds);
  revalidatePath("/expenses");
}

export async function restoreView(tabId, view, index) {
  await repo.restoreView(tabId, view, index);
  revalidatePath("/expenses");
}

export async function createDoc(id, title, folderId = null) {
  const d = await docs.createDoc(id, title, folderId);
  revalidatePath("/documents");
  return d;
}

export async function updateDoc(id, patch) {
  await docs.updateDoc(id, patch);
  revalidatePath("/documents");
}

export async function deleteDoc(id) {
  await docs.deleteDoc(id);
  revalidatePath("/documents");
}

export async function getDoc(id) {
  return docs.getDoc(id);
}

export async function createFolder(id, name) {
  await docs.createFolder(id, name);
  revalidatePath("/documents");
}

export async function renameFolder(id, name) {
  await docs.renameFolder(id, name);
  revalidatePath("/documents");
}

export async function deleteFolder(id) {
  await docs.deleteFolder(id);
  revalidatePath("/documents");
}

export async function moveDoc(docId, folderId, beforeId) {
  await docs.moveDoc(docId, folderId, beforeId);
  revalidatePath("/documents");
}

export async function moveFolder(folderId, beforeId) {
  await docs.moveFolder(folderId, beforeId);
  revalidatePath("/documents");
}

// Brand-name vote: record one ballot, then refresh the live tally page.
export async function castVote(name, candidate) {
  await voting.castVote(name, candidate);
  revalidatePath("/vote/results");
}
