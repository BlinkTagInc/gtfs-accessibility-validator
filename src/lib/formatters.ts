export const formatPercent = (ratio: number | undefined) => {
  if (ratio === undefined || isNaN(ratio)) {
    return '';
  }

  return `${Math.round(ratio * 100 * 10) / 10}%`;
};
