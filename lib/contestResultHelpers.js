function mobileStateFromOutcome(outcome, role) {
  if (role === 'attacker') {
    return outcome === 'attacker_won' ? 'attack_won' : 'attack_lost';
  }
  return outcome === 'defender_won' ? 'defend_won' : 'defend_lost';
}

module.exports = { mobileStateFromOutcome };
