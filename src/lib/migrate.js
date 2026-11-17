import { mergeDocuments } from './merge.js';

/**
 * Automatic Guest -> Account migration, with optimistic concurrency retry.
 * This helper NEVER clears the guest store. Caller clears it ONLY after a
 * successful database acknowledgement. An empty/failed commit throws.
 */
export async function migrateGuestToAccount({ userId, guest, initialRemote, pendingAccount = null,
  read, write, isCurrent = () => true, attempts = 5 }) {
  let remote = initialRemote ?? null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (!isCurrent()) return { aborted: true };
    const accountBase = pendingAccount ? mergeDocuments(remote?.data, pendingAccount) : remote?.data;
    const document = mergeDocuments(accountBase, guest);
    const saved = await write(userId, document, remote?.revision ?? null);
    if (!isCurrent()) return { aborted: true };
    if (!saved.conflict) {
      if (!Number.isFinite(saved.revision)) throw new Error('ไม่ได้รับ revision ยืนยันการบันทึกออนไลน์');
      return { aborted: false, document, revision: saved.revision };
    }
    remote = await read(userId);
  }
  throw new Error('ข้อมูลออนไลน์ถูกแก้พร้อมกันหลายครั้ง กรุณาลองใหม่');
}
