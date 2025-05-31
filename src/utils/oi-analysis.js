// Extracts chartData from sortedEnhancedOptions for each strike price

import { formatNumber } from "./common.utils";
import { LACS } from "./constant";

// Returns an object: { [strikePrice]: { [time]: { callOi, putOi, currentPrice } } }
export function extractChartDataFromEnhancedOptions(sortedEnhancedOptions, underlyingLtp, time) {
  const chartData = {};
  sortedEnhancedOptions.forEach(option => {
    if (!chartData[option.strikePrice]) {
      chartData[option.strikePrice] = {};
    }
    chartData[option.strikePrice][time] = {
      callOi: (option.call?.oi ?? null) !== null ? formatNumber(option.call.oi / LACS) : null,
      putOi: (option.put?.oi != null ? formatNumber(option.put.oi / LACS) : null),
      currentPrice: underlyingLtp ?? null
    };
  });
  return chartData;
}
