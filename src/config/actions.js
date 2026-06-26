"use server";
import { revalidatePath } from "next/cache";
import { repo } from "@/config/repo";

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

export async function addExpense(row) {
  await repo.addExpense(row);
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
