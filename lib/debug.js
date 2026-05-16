import { supabase } from './supabase';

const DEBUG_ENABLED = true;

export async function logDebug(playerId, eventType, payload = {}) {
  if (!DEBUG_ENABLED) return;
  try {
    await supabase.from('debug_events').insert({
      player_id: playerId,
      event_type: eventType,
      payload,
    });
  } catch (e) {
    console.warn('[logDebug] failed:', e?.message);
  }
}
