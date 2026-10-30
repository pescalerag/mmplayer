import { rename } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

/** A Windows scanner can briefly deny replacing a file. Keep the old file intact. */
export async function replaceFile(from: string, to: string, move: typeof rename = rename) {
  const delays = [25, 50, 100, 200, 400];
  for (let attempt = 0; ; attempt++) {
    try { await move(from, to); return; }
    catch (error) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '') || attempt >= delays.length) throw error;
      await setTimeout(delays[attempt]);
    }
  }
}
