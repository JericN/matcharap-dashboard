"use server";
import { revalidatePath } from "next/cache";
import { repo } from "@/config/repo";
import * as docs from "@/config/documents";

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

export async function updateExpense(id, patch) {
  await repo.updateExpense(id, patch);
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
