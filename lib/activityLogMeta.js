// Shared metadata helper for activity log event renderers.
// Consumed by both the player-feed (ActivityLogEvent) and alliance-feed (AllianceLogEvent) renderers.

export function getMeta(event, ...keys) {
  if (!event?.metadata) return null;
  for (const k of keys) {
    const v = event.metadata[k];
    if (v !== undefined && v !== null) return v;
  }
  return null;
}
