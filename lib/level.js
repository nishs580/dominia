export const LEVELS = [
  { level: 1, title: 'Scout', xpRequired: 0 },
  { level: 2, title: 'Pathfinder', xpRequired: 150 },
  { level: 3, title: 'Claimer', xpRequired: 400 },
  { level: 4, title: 'Defender', xpRequired: 1000 },
  { level: 5, title: 'Commander', xpRequired: 3000 },
  { level: 6, title: 'Warlord', xpRequired: 7500 },
  { level: 7, title: 'Strategist', xpRequired: 28000 },
  { level: 8, title: 'Conqueror', xpRequired: 50000 },
  { level: 9, title: 'Sovereign', xpRequired: 90000 },
  { level: 10, title: 'Dominator', xpRequired: 150000 },
];

export function getLevelForXp(xp) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xpRequired) current = l;
    else break;
  }
  return current;
}

export function getNextLevel(currentLevel) {
  return LEVELS.find((l) => l.level === currentLevel + 1) ?? null;
}

export function getXpProgress(xp) {
  const current = getLevelForXp(xp);
  const next = getNextLevel(current.level);
  if (!next) return { current, next: null, progress: 1, xpIntoLevel: 0, xpNeeded: 0 };
  const xpIntoLevel = xp - current.xpRequired;
  const xpNeeded = next.xpRequired - current.xpRequired;
  const progress = xpIntoLevel / xpNeeded;
  return { current, next, progress, xpIntoLevel, xpNeeded };
}

