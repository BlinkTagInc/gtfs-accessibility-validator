export const formatPercent = (ratio) => {
  if (ratio === undefined || isNaN(ratio)) {
    return '';
  }

  return `${Math.round(ratio * 100 * 10) / 10}%`;
};
