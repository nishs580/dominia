/**
 * Alliance Weekly Task display helpers, shared by the Alliance-tab card and
 * the Command Post pick panel. Unit keys mirror the backend task definitions
 * ('m' | 'steps' | 'kcal' | 'days' | 'claims').
 */

export function formatInt(n) {
  if (n == null || Number.isNaN(n)) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatTaskValue(t, unit, value) {
  switch (unit) {
    case 'm':
      return t('weeklyTask.valueKm', { km: Math.round((value / 1000) * 10) / 10 });
    case 'steps':
      return t('weeklyTask.valueSteps', { n: formatInt(value) });
    case 'kcal':
      return t('weeklyTask.valueKcal', { n: formatInt(value) });
    case 'days':
      return t('weeklyTask.valueDays', { count: value });
    case 'claims':
      return t('weeklyTask.valueClaims', { count: value });
    default:
      return String(value);
  }
}

export function rewardLine(t, payout) {
  const parts = [];
  if (payout.stone > 0) parts.push(t('weeklyTask.rewardStone', { n: payout.stone }));
  if (payout.iron > 0) parts.push(t('weeklyTask.rewardIron', { n: payout.iron }));
  if (payout.gold > 0) parts.push(t('weeklyTask.rewardGold', { n: payout.gold }));
  if (payout.morale > 0) parts.push(t('weeklyTask.rewardMorale', { n: payout.morale }));
  if (payout.xp > 0) parts.push(t('weeklyTask.rewardXp', { n: payout.xp }));
  return parts.join(' · ');
}
