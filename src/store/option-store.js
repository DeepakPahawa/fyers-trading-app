import { create } from 'zustand';
import {
  fetchHistoricalCloses,
  formatOptionChainData,
  getOptionChainData,
} from '../services/fyers-option-chain-service';
import { availableOptions, PERIOD_DAYS } from '../utils/constant';
import {
  calculateSupportResistance,
  estimateImpliedVolatility,
  identifyTradingOpportunities,
} from '../utils/options-analysis';
import {
  analyzeOptionVolatility,
  calculateHistoricalVolatility,
} from '../utils/volatility-analysis';
import { calibrateHestonModel } from '../utils/optionPricingModels/heston';
import { calculateVolatilityMetrics } from '../utils/advancedOptionsAnalysis';
import { calculateOptionCallPutPrice } from '../services/pricingService';
import { expiryDateTransformer } from '../utils/api.util';
import { extractChartDataFromEnhancedOptions } from '../utils/oi-analysis';

const initialOiData = {
  NIFTY: {},
  BankNIFTY: {},
  FinNIFTY: {},
};

// Define the store using Zustand's create function
const useOptionStore = create((set, get) => ({
  // Core state properties
  optionChainData: {
    formattedData: null,
    data: null,
  },
  options: [],
  underlying: null,
  expiryDates: [],
  volatilityData: {
    impliedVolatility: 0.3,
    historicalVolatility: 0.25,
    volatilitySkew: null,
  },
  supportResistance: {
    support: [],
    resistance: [],
  },
  enhancedOptions: [],
  atmPriceDetails: null, // Details of the ATM option
  atmIndex: null,
  tradingOpportunities: {
    callOpportunities: [],
    putOpportunities: [],
  },
  selectedOptionType: null,
  selectedRowStrikePrice: null,
  selectedOptionDetail: null,
  selectedSymbol: availableOptions[1].value, // Default to the first symbol in the list
  selectedExpiry: {
    label: null,
    value: null,
  },
  strikeCount: 5,
  isLoading: false,
  error: null,
  oiData: initialOiData,
  marketConditions: {
    // Required in case of heston and NN model
    volatilityIndex: 18.5, // FIXME: Approximate VIX value for India
    putCallRatio: 0.95, // FIXME: Will be calculated from option chain
    marketTrend: 'bullish', // FIXME: determine bullish or bearing from chain data
    liquidity: 'high', // FIXME: determine liquidity from chain data
  },
  hestonParams: calibrateHestonModel([]), // This will return default parameters

  // Set selected symbol
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

  // Set selected expiry date
  setSelectedExpiry: (date) => set({ selectedExpiry: date }),

  // Set strike count
  setStrikeCount: (count) => set({ strikeCount: count }),

  // New setter methods
  setOptions: (options) => set({ options }),

  setUnderlying: (underlying) => set({ underlying }),

  setExpiryDates: (dates) => set({ expiryDates: dates }),

  setVolatilityData: (volatilityData) => set({ volatilityData }),

  setSupportResistance: (supportResistance) => set({ supportResistance }),

  setEnhancedOptions: (enhancedOptions) => set({ enhancedOptions }),

  setTradingOpportunities: (opportunities) =>
    set({ tradingOpportunities: opportunities }),

  setSelectedOptionType: (optionType) =>
    set({ selectedOptionType: optionType }),

  setSelectedRowStrikePrice: (strikePrice) =>
    set({ selectedRowStrikePrice: strikePrice }),

  setSelectedOptionDetail: (optionDetail) =>
    set({ selectedOptionDetail: optionDetail }),

  // Update option chain data
  setOptionChainData: (data, formattedData) =>
    set({
      optionChainData: {
        data: data,
        formattedData: formattedData,
      },
    }),

  // Update loading state
  setLoading: (isLoading) => set({ isLoading }),

  // Update error state
  setError: (error) => set({ error }),

  // Fetch option chain data for a symbol
  fetchOptionChain: async (symbol, expiryDateLabelAndValue) => {
    try {
      let expiry = expiryDateLabelAndValue || get().selectedExpiry || '';

      set({ isLoading: false, error: null });

      const optionChainResponse = await getOptionChainData(
        symbol,
        8,
        expiry.value
      );

      if (optionChainResponse.s !== 'ok') {
        set({
          error:
            optionChainResponse.message || 'Failed to fetch option chain data',
          isLoading: false,
          expiryDates: expiryDateTransformer(
            optionChainResponse?.data?.expiryData
          ),
        });

        return;
      }

      const formattedData = formatOptionChainData(optionChainResponse.data);
      const closes = await fetchHistoricalCloses(symbol, PERIOD_DAYS);
      const now = new Date();
      const time = now.toTimeString().slice(0, 5); // "HH:MM" 

      // if (!expiry) expiry = formattedData.expiryDates[0];
      if (formattedData && optionChainResponse) {
        // Sort options by strike price in ascending order
        const sortedOptions = [...formattedData.options].sort(
          (a, b) => a.strikePrice - b.strikePrice
        );
        set({
          underlying: formattedData.underlying,
          options: sortedOptions,
          expiryDates: formattedData.expiryDates,
          selectedExpiry: expiry
        });

        // Calculate support and resistance levels
        if (formattedData.underlying && formattedData.underlying.ltp) {
          const spotPrice = formattedData.underlying.ltp;

          const volatilityMetrics = calculateVolatilityMetrics(sortedOptions);

          // Estimate implied volatility from market data
          const estimatedIV = estimateImpliedVolatility(
            sortedOptions,
            spotPrice,
            expiry.value
          );
          const closesDataForHV = await closes;

          const estimatedHV = calculateHistoricalVolatility(closesDataForHV);

          // Calculate volatility skew
          const skewAnalysis = {
            skewRatio: estimatedIV / estimatedHV,
            skewDifference: estimatedIV - estimatedHV,
            skewPercentage: ((estimatedIV - estimatedHV) / estimatedHV) * 100,
          };

          // Calculate support/resistance levels
          const levels = calculateSupportResistance(
            spotPrice,
            sortedOptions,
            estimatedIV
          );

          set({
            volatilityData: {
              ...get().volatilityData,
              impliedVolatility: estimatedIV,
              historicalVolatility: estimatedHV,
              volatilitySkew: skewAnalysis,
            },
            supportResistance: levels,
            // FIXME: marketConditions should be updated from API in case of useOnlyBS is false
            marketConditions: {
              ...get().marketConditions,
              putCallRatio: volatilityMetrics.putCallOIRatio,
            },
          });

          const optionsWithTheoreticalPrices = sortedOptions.map((option) =>
            calculateOptionCallPutPrice(
              option,
              formattedData.underlying,
              {
                ...get().marketConditions,
                putCallRatio: volatilityMetrics.putCallOIRatio,
              },
              expiry.value,
              estimatedIV
            )
          );

          // Add volatility analysis to each option
          const optionsWithVolatilityAnalysis =
            optionsWithTheoreticalPrices.map((option) => {
              const enhancedOption = { ...option };

              if (option.call) {
                const volatilityAnalysis = analyzeOptionVolatility(
                  {
                    ...option.call,
                    impliedVolatility: option.call.impliedVolatility,
                    theoreticalPrice: option.call.hybridPrice,
                    greeks: option.call.greeks,
                  },
                  formattedData.underlying,
                  estimatedHV
                );

                enhancedOption.call = {
                  ...option.call,
                  theoreticalPrice: option.call.hybridPrice,
                  priceDifference:
                    ((option.call.ltp - option.call.hybridPrice) /
                      option.call.hybridPrice) *
                    100,
                  volatilityAnalysis,
                };
              }

              if (option.put) {
                const volatilityAnalysis = analyzeOptionVolatility(
                  {
                    ...option.put,
                    impliedVolatility: option.put.impliedVolatility,
                    theoreticalPrice: option.put.hybridPrice,
                    greeks: option.put.greeks,
                  },
                  formattedData.underlying,
                  estimatedHV
                );

                enhancedOption.put = {
                  ...option.put,
                  theoreticalPrice: option.put.hybridPrice,
                  priceDifference:
                    ((option.put.ltp - option.put.hybridPrice) /
                      option.put.hybridPrice) *
                    100,
                  volatilityAnalysis,
                };
              }

              return enhancedOption;
            });

          // Ensure final enhanced options are sorted by strike price
          const sortedEnhancedOptions = [...optionsWithVolatilityAnalysis].sort(
            (a, b) => a.strikePrice - b.strikePrice
          );

          const atmPriceDetails = sortedEnhancedOptions.reduce((prev, curr) =>
            Math.abs(curr?.strikePrice - formattedData.underlying.ltp) < Math.abs(prev?.strikePrice - formattedData.underlying.ltp) ? curr : prev
          );
          // console.log(
          //   '🚀 ~ fetchOptionChain: ~ sortedEnhancedOptions:',
          //   sortedEnhancedOptions
          // );
          // Identify trading opportunities

          const atmIndex = sortedEnhancedOptions.findIndex(
            (option) => option.strikePrice === atmPriceDetails.strikePrice
          );

          const opportunities = identifyTradingOpportunities(
            sortedEnhancedOptions
          );

          const OIDataForIndex = extractChartDataFromEnhancedOptions(sortedEnhancedOptions, formattedData.underlying.ltp, time);

        const prevOiData = get().oiData[symbol] || {};
        // For each strike in OIDataForIndex, merge time entries
        const mergedOiData = { ...prevOiData };
        Object.entries(OIDataForIndex).forEach(([strike, timeObj]) => {
          mergedOiData[strike] = {
            ...(prevOiData[strike] || {}),
            ...timeObj,
          };
        });

          set({
            enhancedOptions: sortedEnhancedOptions,
            tradingOpportunities: opportunities,
            atmPriceDetails: atmPriceDetails,
            atmIndex,
            oiData: {
              ...get().oiData,
              [symbol]: mergedOiData
            }
          });
        }

        // Reset selection
        set({
          selectedRowStrikePrice: null,
          selectedOptionType: null,
        });

      }

      // Update store with fetched data
      set((state) => ({
        ...state,
        optionChainData: {
          formattedData: formattedData,
          data: optionChainResponse,
        },
        selectedSymbol: symbol,
        isLoading: false,
      }));
    } catch (error) {
      console.log('🚀 ~ fetchOptionChain: ~ expiryDates:', error);
      set({
        error: error.message || 'Failed to fetch option chain data',
        isLoading: false,
      });
    }
  },

  // Clear all data
  clearData: () =>
    set({
      optionChainData: {},
      selectedSymbol: availableOptions[0].value,
      isLoading: false,
      error: null,
    }),
}));

export default useOptionStore;
