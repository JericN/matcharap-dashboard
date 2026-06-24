'use server';
import { revalidatePath } from 'next/cache';
import { repo } from '@/config/repo';

// Client-callable boundary: write through the DAL, then revalidate the route so
// the next render reflects the shared value.

export async function toggleSaved(name) {
  await repo.selection.toggle(name);
  revalidatePath('/powders');
}

export async function setSrp(name, price) {
  await repo.prices.set(name, price);
  revalidatePath('/calculator');
}

export async function resetSrp() {
  await repo.prices.reset();
  revalidatePath('/calculator');
}
