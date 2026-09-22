import { noteMatchesEdit, validateOfflineNoteSnapshot, type NoteCachePersistence, type OfflineNoteSnapshot } from './offlineNotes';

/** One-time browser-origin transfer; retain its source until pending edits are acknowledged. */
export class LegacyNoteCacheMigration implements NoteCachePersistence {
  constructor(private readonly durable: NoteCachePersistence, private readonly legacy: Storage = localStorage) {}

  async load(key: string): Promise<OfflineNoteSnapshot | null> {
    const current = await this.durable.load(key);
    const raw = this.legacy.getItem(key);
    if (raw === null) return current;
    let original: OfflineNoteSnapshot;
    try {
      original = JSON.parse(raw) as OfflineNoteSnapshot;
      validateOfflineNoteSnapshot(original);
    } catch { throw new Error('Legacy offline notes are invalid; the browser source was retained.'); }
    if (current?.legacySource === raw) return current;
    if (current && JSON.stringify(current) !== JSON.stringify(original)) {
      throw new Error('Legacy and current offline note caches differ; both were retained for recovery.');
    }
    const copied = { ...original, legacySource: raw };
    await this.durable.save(key, copied);
    if (JSON.stringify(await this.durable.load(key)) !== JSON.stringify(copied)) {
      throw new Error('Offline note cache transfer could not be verified; browser data was retained.');
    }
    this.retireIfAcknowledged(key, copied);
    return copied;
  }

  async save(key: string, snapshot: OfflineNoteSnapshot): Promise<void> {
    await this.durable.save(key, snapshot);
    this.retireIfAcknowledged(key, snapshot);
  }

  private retireIfAcknowledged(key: string, snapshot: OfflineNoteSnapshot): void {
    const raw = snapshot.legacySource;
    if (!raw || this.legacy.getItem(key) !== raw) return;
    const original = JSON.parse(raw) as OfflineNoteSnapshot;
    if (Object.entries(original.pending).every(([id, edit]) => {
      if (snapshot.pending[id]) return false;
      const note = snapshot.notes.find(item => String(item.id) === id);
      return note && noteMatchesEdit(note, edit.body);
    })) this.legacy.removeItem(key);
  }
}

export function legacyOfflineNotesForRecovery(key: string): string | null {
  return localStorage.getItem(key);
}
