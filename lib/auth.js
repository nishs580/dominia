import { supabase } from './supabase';

export async function ensurePlayer(clerkUserId, email) {
  if (!clerkUserId) return { player: null, needsUsername: false };

  const { data: existing } = await supabase
    .from('players')
    .select('id, username')
    .eq('clerk_id', clerkUserId)
    .single();

  if (existing) return { player: existing, needsUsername: false };

  const tempUsername = email ? email.split('@')[0] : 'commander';
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
