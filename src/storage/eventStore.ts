import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { StoredEvent, StoredEventSummary, TamperedEventRecord } from "../types/evidence.js";

class EventStore {
  private events: Map<string, StoredEvent> = new Map();
  private tamperedRecords: Map<string, TamperedEventRecord> = new Map();
  private initialized = false;

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    if (this.initialized) return;

    try {
      if (!fs.existsSync(config.dataDir)) {
        fs.mkdirSync(config.dataDir, { recursive: true });
      }

      if (fs.existsSync(config.eventsFilePath)) {
        const raw = fs.readFileSync(config.eventsFilePath, "utf-8");
        if (raw.trim()) {
          const list: StoredEvent[] = JSON.parse(raw);
          for (const ev of list) {
            this.events.set(ev.eventId, ev);
          }
        }
      } else {
        fs.writeFileSync(config.eventsFilePath, JSON.stringify([], null, 2), "utf-8");
      }
    } catch (err) {
      console.error("Failed to initialize event store from disk:", err);
    }

    this.initialized = true;
  }

  private persistToDisk(): void {
    try {
      const list = Array.from(this.events.values());
      const tempPath = `${config.eventsFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(list, null, 2), "utf-8");
      fs.renameSync(tempPath, config.eventsFilePath);
    } catch (err) {
      console.error("Failed to persist events to disk:", err);
    }
  }

  public generateNextEventId(): string {
    const count = this.events.size + 1;
    const padded = String(count).padStart(3, "0");
    let candidate = `EVT-${padded}`;
    let counter = count;
    while (this.events.has(candidate)) {
      counter++;
      candidate = `EVT-${String(counter).padStart(3, "0")}`;
    }
    return candidate;
  }

  public async saveEvent(event: StoredEvent): Promise<StoredEvent> {
    this.ensureInitialized();
    this.events.set(event.eventId, event);
    this.persistToDisk();
    return event;
  }

  public async getEvent(eventId: string): Promise<StoredEvent | null> {
    this.ensureInitialized();
    return this.events.get(eventId) || null;
  }

  public async listEvents(): Promise<StoredEventSummary[]> {
    this.ensureInitialized();
    const list = Array.from(this.events.values()).map((ev) => ({
      eventId: ev.eventId,
      agent: ev.agent,
      decision: ev.decision,
      amount: ev.amount,
      reason: ev.reason,
      timestamp: ev.timestamp,
      recordId: ev.recordId,
      executionId: ev.executionId,
      status: ev.status,
      digest: ev.digest,
    }));

    // Return most recent first
    return list.reverse();
  }

  public async updateEventStatus(
    eventId: string,
    status: StoredEvent["status"]
  ): Promise<void> {
    this.ensureInitialized();
    const ev = this.events.get(eventId);
    if (ev) {
      ev.status = status;
      this.persistToDisk();
    }
  }

  public saveTamperedRecord(record: TamperedEventRecord): void {
    this.tamperedRecords.set(record.tamperId, record);
  }

  public getTamperedRecord(tamperId: string): TamperedEventRecord | null {
    return this.tamperedRecords.get(tamperId) || null;
  }

  public clear(): void {
    this.events.clear();
    this.tamperedRecords.clear();
    this.persistToDisk();
  }
}

export const eventStore = new EventStore();

