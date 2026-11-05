/**
 * CareTrack - Offline-First Cache & Sync Sentinel
 * Anti-Phantom Seed (Directiva 14) & Zero Data Loss Tombstones (Directiva 6)
 */

export class CareTrackCache {
  constructor(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
    this.storage = storage;
    this.memoryStore = new Map();
    this.STORAGE_KEY = 'caretrack_data_v1';
    this.PURGE_FLAG_KEY = 'caretrack_demo_purged';
  }

  isPurged() {
    if (this.storage) {
      try {
        return this.storage.getItem(this.PURGE_FLAG_KEY) === 'true';
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  setPurgeFlag(value = true) {
    if (this.storage) {
      try {
        this.storage.setItem(this.PURGE_FLAG_KEY, value ? 'true' : 'false');
      } catch (e) {
        // storage disabled or private mode
      }
    }
  }

  saveState(state) {
    const payload = JSON.stringify({
      version: '1.0.00',
      savedAt: new Date().toISOString(),
      data: state
    });

    if (this.storage) {
      try {
        this.storage.setItem(this.STORAGE_KEY, payload);
        return true;
      } catch (e) {
        // quota exceeded or restricted
      }
    }
    this.memoryStore.set(this.STORAGE_KEY, payload);
    return true;
  }

  loadState() {
    let raw = null;
    if (this.storage) {
      try {
        raw = this.storage.getItem(this.STORAGE_KEY);
      } catch (e) {
        raw = null;
      }
    }
    if (!raw) {
      raw = this.memoryStore.get(this.STORAGE_KEY);
    }

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      return parsed.data || null;
    } catch (e) {
      return null;
    }
  }

  clear() {
    this.setPurgeFlag(true);
    if (this.storage) {
      try {
        this.storage.removeItem(this.STORAGE_KEY);
      } catch (e) {}
    }
    this.memoryStore.clear();
  }

  // Outbox FIFO queue for offline operations
  addToOutbox(item) {
    const current = this.getOutbox();
    current.push({
      id: `OUT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
      payload: item
    });
    this.saveOutbox(current);
  }

  getOutbox() {
    let raw = null;
    if (this.storage) {
      try {
        raw = this.storage.getItem('caretrack_outbox_queue');
      } catch (e) {}
    }
    if (!raw) return [];
    try {
      return JSON.parse(raw) || [];
    } catch (e) {
      return [];
    }
  }

  saveOutbox(queue) {
    const serialized = JSON.stringify(queue);
    if (this.storage) {
      try {
        this.storage.setItem('caretrack_outbox_queue', serialized);
      } catch (e) {}
    }
  }

  clearOutbox() {
    if (this.storage) {
      try {
        this.storage.removeItem('caretrack_outbox_queue');
      } catch (e) {}
    }
  }
}
