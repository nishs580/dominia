import { supabase } from './supabase';

export async function ensurePlayer(clerkUserId, email) {
  // Check if player already exists
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('clerk_id', clerkUserId)
    .single();

  if (existing) return existing;

  // Create new player row
  const username = email.split('@')[0];
  const { data: newPlayer, error } = await supabase
    .from('players')
    .insert({
      username,
      clerk_id: clerkUserId,
      home_city: 'Amsterdam',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating player:', error);
    return null;
  }

  return newPlayer;
}
