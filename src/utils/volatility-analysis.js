/**
 * Utility functions for volatility analysis
 * This module provides functions to calculate and analyze historical and implied volatility
 */

import { PERIOD_DAYS } from "./constant";

/**
 * Calculate historical volatility based on provided price history
 * @param {Array} priceHistory - Array of historical prices (most recent first)
 * @param {number} period - Number of periods to consider (default 20)
 * @returns {number} Historical volatility as a decimal (e.g., 0.25 for 25%)
 */
export const calculateHistoricalVolatility = (priceHistory, period = PERIOD_DAYS) => {
    if (!priceHistory || priceHistory.length < 2) {
    return 0.3; // Not even one return possible
  }

  const usablePeriod = Math.min(period, priceHistory.length - 1);
  const slicedPrices = priceHistory.slice(-1 * (usablePeriod + 1));

  const returns = [];
  for (let i = 1; i < slicedPrices.length; i++) {
    const currentPrice = slicedPrices[i];
    const previousPrice = slicedPrices[i - 1];

    if (currentPrice > 0 && previousPrice > 0) {
      returns.push(Math.log(currentPrice / previousPrice));
    }
  }

  if (returns.length < 2) return 0.3;

  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1);

  return Math.sqrt(variance * 252); // Annualized volatility
};


/**
 * Estimate historical volatility when true price history is not available
 * Uses a mock price history based on current price and rough volatility estimate
 * 
 * @param {number} currentPrice - Current price of the underlying
 * @param {number} roughVolatility - Rough estimate of volatility 
 * @returns {number} Estimated historical volatility
 */
export const estimateHistoricalVolatility = (currentPrice, roughVolatility = 0.2) => {
  if (!currentPrice) return roughVolatility;
  
  // Generate a synthetic price history based on the current price and rough volatility
  const syntheticPriceHistory = [];
  let price = currentPrice;
  
  // Generate 30 days of synthetic price data
  for (let i = 0; i < 30; i++) {
    syntheticPriceHistory.push(price);
    
    // Random daily change based on volatility
    const dailyVol = roughVolatility / Math.sqrt(252);
    const randomChange = (Math.random() * 2 - 1) * dailyVol;
    
    // Calculate new price with random movement
    price = price * (1 + randomChange);
  }
  
  return calculateHistoricalVolatility(syntheticPriceHistory);
};

/**
 * Compare implied volatility and historical volatility to analyze pricing skew
 * @param {number} impliedVolatility - Current implied volatility from options
 * @param {number} historicalVolatility - Historical volatility calculated from price data
 * @returns {object} Analysis of IV-HV relationship
 */
export const analyzeVolatilitySkew = (impliedVolatility, historicalVolatility) => {
  if (!impliedVolatility || !historicalVolatility) {
    return {
      skewRatio: 1,
      skewDifference: 0,
      skewPercentage: 0,
      interpretation: "Insufficient data to analyze volatility skew"
    };
  }
  
  const skewRatio = impliedVolatility / historicalVolatility;
  const skewDifference = impliedVolatility - historicalVolatility;
  const skewPercentage = (skewDifference / historicalVolatility) * 100;
  
  let interpretation;
  let tradingSignal;
  
  // Interpret the skew
  if (skewRatio > 1.3) {
    interpretation = "Implied volatility is significantly higher than historical volatility, suggesting options may be overpriced";
    tradingSignal = "SELL";
  } else if (skewRatio < 0.7) {
    interpretation = "Implied volatility is significantly lower than historical volatility, suggesting options may be underpriced";
    tradingSignal = "BUY";
  } else if (skewRatio > 1.1) {
    interpretation = "Implied volatility is higher than historical volatility, suggesting options may be slightly overpriced";
    tradingSignal = "NEUTRAL_SELL";
  } else if (skewRatio < 0.9) {
    interpretation = "Implied volatility is lower than historical volatility, suggesting options may be slightly underpriced";
    tradingSignal = "NEUTRAL_BUY";
  } else {
    interpretation = "Implied volatility is in line with historical volatility, suggesting options are fairly priced";
    tradingSignal = "NEUTRAL";
  }
  
  return {
    skewRatio,
    skewDifference,
    skewPercentage,
    interpretation,
    tradingSignal
  };
};

/**
 * Analyze an option's entire volatility profile (IV, HV, skew)
 * @param {object} option - Option data
 * @param {object} underlying - Underlying asset data
 * @returns {object} Complete volatility analysis
 */
export const analyzeOptionVolatility = (option, underlying, estimatedHV) => {
  if (!option || !underlying) {
    return null;
  }
  
  // Get implied volatility (either provided or estimate it)
  const impliedVolatility = option.impliedVolatility || (option.greeks?.vega ? (option.theoreticalPrice / (option.greeks.vega * 100)) : 0.3);
  
  // Estimate historical volatility from underlying price
  // const historicalVolatility = estimateHistoricalVolatility(underlying.ltp, impliedVolatility * 0.8); //FIXME: harcoded 0.8 as HV to be replaced
  
  // Analyze the volatility skew
  const skewAnalysis = analyzeVolatilitySkew(impliedVolatility, estimatedHV);
  
  return {
    impliedVolatility,
    ...skewAnalysis
  };
};
