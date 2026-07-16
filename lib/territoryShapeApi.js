// lib/territoryShapeApi.js
// Fetch a territory's silhouette inputs when navigation didn't carry them —
// the defender-accept and notification-opened result paths. territories.geojson
// is populated for every row and anon-readable (map data is public game state).

import { supabase } from './supabase';

export async function fetchTerritoryShape(territoryId) {
  if (!territoryId) return null;
  const { data, error } = await supabase
    .from('territories')
    .select('territory_name, geojson')
    .eq('id', territoryId)
    .maybeSingle();
  if (error || !data) return null;
  return { name: data.territory_name ?? null, geojson: data.geojson ?? null };
}
