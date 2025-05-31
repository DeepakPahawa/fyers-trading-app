// Format numbers for display
export const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined) return '-';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export function formatIndianNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '';
  const absNum = Math.abs(num);
  if (absNum >= 1e7) {
    return (num / 1e7).toFixed(2).replace(/\.00$/, '') + 'Cr';
  } else if (absNum >= 1e5) {
    return (num / 1e5).toFixed(2).replace(/\.00$/, '') + 'L';
  } else if (absNum >= 1e3) {
    return (num / 1e3).toFixed(2).replace(/\.00$/, '') + 'K';
  }
  return num.toString();
}


export const getUnixTimestampNDaysAgo = (n) => {
  const now = new Date();
  const past = new Date(now);
  past.setDate(now.getDate() - n);
  return Math.floor(past.getTime() / 1000);
}

export const getTodayUnixTimestamp = () => {
  return Math.floor(Date.now() / 1000);
}