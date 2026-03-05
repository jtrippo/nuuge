/**
 * Server-side usage tracking for analytics and billing.
 * Stores to a JSON file for MVP. Will migrate to database.
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export interface UsageEvent {
  id: string;
  user_id: string;
  event_type: "image_generation" | "image_edit" | "message_generation" | "design_suggestion";
  timestamp: string;
  metadata: Record<string, unknown>;
}

const USAGE_FILE = join(process.cwd(), "usage-log.json");

function getUsageLog(): UsageEvent[] {
  if (!existsSync(USAGE_FILE)) return [];
  try {
    const raw = readFileSync(USAGE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveUsageLog(events: UsageEvent[]) {
  writeFileSync(USAGE_FILE, JSON.stringify(events, null, 2));
}

export function trackUsage(
  userId: string,
  eventType: UsageEvent["event_type"],
  metadata: Record<string, unknown> = {}
) {
  const events = getUsageLog();
  events.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    metadata,
  });
  saveUsageLog(events);
}

export function getUsageStats(userId?: string) {
  const events = getUsageLog();
  const filtered = userId
    ? events.filter((e) => e.user_id === userId)
    : events;

  const stats = {
    total_events: filtered.length,
    image_generations: filtered.filter((e) => e.event_type === "image_generation").length,
    message_generations: filtered.filter((e) => e.event_type === "message_generation").length,
    design_suggestions: filtered.filter((e) => e.event_type === "design_suggestion").length,
    estimated_cost: 0,
  };

  stats.estimated_cost =
    stats.image_generations * 0.04 +
    stats.message_generations * 0.02 +
    stats.design_suggestions * 0.01;

  return stats;
}
