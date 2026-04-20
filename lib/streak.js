import { supabase } from './supabase';

export async function updateStreakOnChallengeComplete(playerId, currentXp) {
  const today = new Date().toISOString().split('T')[0];

  const { data: player } = await supabase
    .from('players')
    .select('current_streak, longest_streak, last_active_date')
    .eq('id', playerId)
    .maybeSingle();

  if (!player) return;

  const lastActive = player.last_active_date;

  // Already counted today — do nothing
  if (lastActive === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newStreak = lastActive === yesterdayStr ? (player.current_streak || 0) + 1 : 1;

  const newLongest = Math.max(newStreak, player.longest_streak || 0);

  await supabase
    .from('players')
    .update({
      current_streak: newStreak,
      longest_streak: newLongest,
      last_active_date: today,
    })
    .eq('id', playerId);
}

