export const OFFICIAL_AVAILABILITY_OVERRIDES = {
  'Manuel Ugarte': {
    statusType: 'out',
    statusLabel: '术后康复中',
    availabilityScore: 10,
    excludeFromPrediction: true,
    source: 'Manchester United',
    sourceUrl: 'https://www.manutd.com/en/news/an-official-update-on-manuel-ugarte',
    sourceDate: '2026-07-15',
    reason: '膝韧带伤术后康复；俱乐部尚未公布复出日期'
  }
};

export function applyAvailabilityOverrides(roster) {
  return roster.map(player => {
    const override = OFFICIAL_AVAILABILITY_OVERRIDES[player.name];
    return override ? { ...player, ...override } : player;
  });
}

export function isPredictionEligible(player) {
  return player.statusType !== 'out' && !player.excludeFromPrediction;
}
