import { supabase } from './supabase';

export async function ensurePlayer(clerkUserId, email) {
  const { data: existing } = await supabase
    .from('players')
    .select('id, username')
    .eq('clerk_id', clerkUserId)
    .single();

  if (existing) return { player: existing, needsUsername: !existing.username };

  const tempUsername = email.split('@')[0];
  const { data: newPlayer, error } = await supabase
    .from('players')
    .insert({
      username: tempUsername,
      clerk_id: clerkUserId,
      home_city: 'Amsterdam',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating player:', error);
    return { player: null, needsUsername: false };
  }

  return { player: newPlayer, needsUsername: true };
}
