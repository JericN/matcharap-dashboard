'use server';
import { revalidatePath } from 'next/cache';
import { getState, writeState } from '@/config/state';

// Mutations to the one shared state record. Read-modify-write, then revalidate
// the affected route so the next render reflects the centralized value.

export async function setSrp(name, price) {
  const s = await getState();
  await writeState({ ...s, srp: { ...s.srp, [name]: price } });
  revalidatePath('/calculator');
}

export async function resetSrp() {
  const s = await getState();
  await writeState({ ...s, srp: {} });
  revalidatePath('/calculator');
}

export async function toggleSaved(name) {
  const s = await getState();
  const saved = s.saved.includes(name) ? s.saved.filter((n) => n !== name) : [...s.saved, name];
  await writeState({ ...s, saved });
  revalidatePath('/powders');
}
