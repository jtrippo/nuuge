/**
 * Client-side usage tracking via IndexedDB + Supabase.
 * Captures every API call with model, cost estimate, and context.
 * Events are stored locally (IndexedDB) and sent to Supabase for
 * persistent, cross-user analytics.
 */

import { supabase } from "./supabase";

const DB_NAME = "nuuge_usage";
const STORE_NAME = "events";
const DB_VERSION = 1;

export interface UsageEvent {
  id: string;
  timestamp: string;
  endpoint: string;
  model: string;
  callType: "image_generate" | "image_edit" | "chat_completion";
  estimatedCost: number;
  cardId?: string;
  recipientId?: string;
  userName?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

function getDeviceId(): string {
  const key = "nuuge_device_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function getUserName(): string {
  try {
    const raw = localStorage.getItem("nuuge_user_profile");
    if (raw) {
      const p = JSON.parse(raw);
      return p.display_name || p.first_name || "";
    }
  } catch { /* ignore */ }
  return "";
}

async function sendToSupabase(event: UsageEvent): Promise<void> {
  try {
    await supabase.from("usage_events").insert({
      id: event.id,
      created_at: event.timestamp,
      device_id: getDeviceId(),
      user_name: event.userName || getUserName(),
      endpoint: event.endpoint,
      model: event.model,
      call_type: event.callType,
      estimated_cost: event.estimatedCost,
      card_id: event.cardId || null,
      recipient_id: event.recipientId || null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch {
    // Supabase send is fire-and-forget — don't block the app
  }
}

/**
 * Estimated costs per operation (USD) based on OpenAI published pricing.
 * These are rough averages — actual cost depends on token count / image size.
 */
export const COST_ESTIMATES: Record<string, number> = {
  // Image generation / editing (gpt-image-1, 1024x1536)
  "image_generate": 0.08,
  "image_edit": 0.08,

  // Chat completions — estimated per call based on typical prompt sizes
  "gpt-4o": 0.025,
  "gpt-4o-mini": 0.005,
};

export function estimateCost(callType: string, model: string): number {
  if (callType === "image_generate" || callType === "image_edit") {
    return COST_ESTIMATES[callType] ?? 0.08;
  }
  return COST_ESTIMATES[model] ?? 0.02;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function logUsage(event: Omit<UsageEvent, "id" | "timestamp">): Promise<void> {
  const entry: UsageEvent = {
    ...event,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    estimatedCost: event.estimatedCost ?? estimateCost(event.callType, event.model),
  };
  await putUsageEvent(entry);
  sendToSupabase(entry);
}

/** Write a complete usage event (used during backup restore to preserve original IDs/timestamps). */
export async function putUsageEvent(entry: UsageEvent): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    console.warn("[usage] Failed to log usage event", entry);
  }
}

export async function getAllUsage(): Promise<UsageEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as UsageEvent[]);
    req.onerror = () => reject(req.error);
  });
}

export interface UsageStats {
  totalCalls: number;
  totalCost: number;
  imageGenerations: number;
  imageEdits: number;
  chatCompletions: number;
  costByEndpoint: Record<string, { calls: number; cost: number }>;
  costByCard: Record<string, { calls: number; cost: number }>;
  avgCostPerCard: number;
}

export async function getUsageStats(): Promise<UsageStats> {
  const events = await getAllUsage();

  const stats: UsageStats = {
    totalCalls: events.length,
    totalCost: 0,
    imageGenerations: 0,
    imageEdits: 0,
    chatCompletions: 0,
    costByEndpoint: {},
    costByCard: {},
    avgCostPerCard: 0,
  };

  for (const e of events) {
    stats.totalCost += e.estimatedCost;

    if (e.callType === "image_generate") stats.imageGenerations++;
    else if (e.callType === "image_edit") stats.imageEdits++;
    else stats.chatCompletions++;

    if (!stats.costByEndpoint[e.endpoint]) {
      stats.costByEndpoint[e.endpoint] = { calls: 0, cost: 0 };
    }
    stats.costByEndpoint[e.endpoint].calls++;
    stats.costByEndpoint[e.endpoint].cost += e.estimatedCost;

    if (e.cardId) {
      if (!stats.costByCard[e.cardId]) {
        stats.costByCard[e.cardId] = { calls: 0, cost: 0 };
      }
      stats.costByCard[e.cardId].calls++;
      stats.costByCard[e.cardId].cost += e.estimatedCost;
    }
  }

  const cardCount = Object.keys(stats.costByCard).length;
  stats.avgCostPerCard = cardCount > 0 ? stats.totalCost / cardCount : 0;

  return stats;
}

/**
 * Backfill: push all existing IndexedDB usage events to Supabase.
 * Safe to run multiple times — uses upsert so duplicates are ignored.
 * Returns the count of events sent.
 */
export async function backfillToSupabase(): Promise<number> {
  const events = await getAllUsage();
  if (events.length === 0) return 0;

  const deviceId = getDeviceId();
  const userName = getUserName();

  const rows = events.map((e) => ({
    id: e.id,
    created_at: e.timestamp,
    device_id: deviceId,
    user_name: e.userName || userName,
    endpoint: e.endpoint,
    model: e.model,
    call_type: e.callType,
    estimated_cost: e.estimatedCost,
    card_id: e.cardId || null,
    recipient_id: e.recipientId || null,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  }));

  const batchSize = 100;
  let sent = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("usage_events")
      .upsert(batch, { onConflict: "id" });
    if (!error) sent += batch.length;
  }
  return sent;
}

/**
 * Helper to log usage after a fetch call to an API route.
 * Call this after each successful API response.
 */
export async function logApiCall(
  endpoint: string,
  opts: {
    model: string;
    callType: UsageEvent["callType"];
    cardId?: string;
    recipientId?: string;
  }
): Promise<void> {
  await logUsage({
    endpoint,
    model: opts.model,
    callType: opts.callType,
    estimatedCost: estimateCost(opts.callType, opts.model),
    cardId: opts.cardId,
    recipientId: opts.recipientId,
  });
}
