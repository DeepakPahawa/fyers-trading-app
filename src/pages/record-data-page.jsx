import React, { useState, useRef, useCallback, useEffect } from 'react';
import useOptionStore from '../store/option-store';
import { availableOptions, RISK_FREE_INTEREST } from '../utils/constant';
import { updateGoogleSheet } from '../services/google-sheet-service';
import { calculateParityDeviation } from '../utils/optionPricingUtils';

const RECORD_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

const BSE_EXPIRY_DATES = [
  // {
  //     label: "27-05-2025",
  //     value: "1748340000"
  // },
  {
    label: '03-06-2025',
    value: '1748944800',
  },
  {
    label: '10-06-2025',
    value: '1749549600',
  },
  {
    label: '17-06-2025',
    value: '1750154400',
  },
  {
    label: '24-06-2025',
    value: '1750759200',
  },
  {
    label: '01-07-2025',
    value: '1751364000',
  },
  {
    label: '08-07-2025',
    value: '1751968800',
  },
  {
    label: '29-07-2025',
    value: '1753783200',
  },
  {
    label: '30-09-2025',
    value: '1759226400',
  },
  {
    label: '30-12-2025',
    value: '1767088800',
  },
  {
    label: '31-03-2026',
    value: '1774951200',
  },
  {
    label: '30-06-2026',
    value: '1782813600',
  },
  {
    label: '29-12-2026',
    value: '1798538400',
  },
  {
    label: '29-06-2027',
    value: '1814263200',
  },
  {
    label: '28-12-2027',
    value: '1829988000',
  },
  {
    label: '27-06-2028',
    value: '1845712800',
  },
  {
    label: '26-12-2028',
    value: '1861437600',
  },
  {
    label: '26-06-2029',
    value: '1877162400',
  },
  {
    label: '25-12-2029',
    value: '1892887200',
  },
];
const expiryDates = {
  SENSEX:  {
    label: '03-06-2025',
    value: '1748944800',
  },
  BANKEX: {
    label: '24-06-2025',
    value: '1750759200',
  }
}

const RecordDataPage = () => {
  const { fetchOptionChain } = useOptionStore();
  const [isRecording, setIsRecording] = useState(false);
  console.log('🚀 ~ RecordDataPage ~ isRecording:', isRecording);
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef(null);

  // Sequentially fetch and update for each option, one at a time, every 5 minutes
  useEffect(() => {
    let cancelled = false;
    async function processNextOption(index) {
      const option = availableOptions[index];
      const expiryDate =
      expiryDates[option.label]
      ?? {
          label: '29-05-2025',
          value: '1748512800',
        }
      await fetchOptionChain(
        option.value,
        expiryDate
      );
      const { underlying, selectedExpiry, volatilityData, atmPriceDetails, atmIndex, enhancedOptions } = await
        useOptionStore.getState();
      const { parityDeviation, deviationPercentage } = calculateParityDeviation(
        atmPriceDetails.call.ltp,
        atmPriceDetails.put.ltp,
        underlying?.ltp,
        atmPriceDetails.strikePrice,
        selectedExpiry.value,
        RISK_FREE_INTEREST
      );
      console.log('🚀 ~ processNextOption ~ parityDeviation:', parityDeviation);
      console.log(
        '🚀 ~ processNextOption ~ deviationPercentage:',
        deviationPercentage
      );
      const data = [
        ''+ expiryDate.label,
        volatilityData.impliedVolatility,
        volatilityData.historicalVolatility,
        '' + volatilityData.volatilitySkew.skewRatio,
        '' + atmPriceDetails.call.oi,
        '' + atmPriceDetails.call.oichp,
        '' + atmPriceDetails.call.volatilityAnalysis.impliedVolatility,
        '' + atmPriceDetails.call.volatilityAnalysis.skewDifference,
        '' + atmPriceDetails.call.volatilityAnalysis.skewPercentage,
        '' + atmPriceDetails.call.volatilityAnalysis.skewRatio,
        atmPriceDetails.call.ltp,
        atmPriceDetails.call.theoreticalPrice,
        `${(atmPriceDetails.call.ltp - atmPriceDetails.call.theoreticalPrice)*100/atmPriceDetails.call.theoreticalPrice}%`,
        atmPriceDetails.strikePrice,
        atmPriceDetails.call.underlyingPrice,
        '' + parityDeviation,
        '' + deviationPercentage,
        atmPriceDetails.strikePrice,
        `${(atmPriceDetails.put.ltp - atmPriceDetails.put.theoreticalPrice)*100/atmPriceDetails.put.theoreticalPrice}%`,
        atmPriceDetails.put.theoreticalPrice,
        atmPriceDetails.put.ltp,
        '' + atmPriceDetails.put.volatilityAnalysis.skewRatio,
        '' + atmPriceDetails.put.volatilityAnalysis.skewPercentage,
        '' + atmPriceDetails.put.volatilityAnalysis.skewDifference,
        '' + atmPriceDetails.put.volatilityAnalysis.impliedVolatility,
        '' + atmPriceDetails.put.oichp,
        '' + atmPriceDetails.put.oi,
      ];
      console.log('🚀 ~ processNextOption ~ data:', data);
      await updateGoogleSheet(option, data);
      if (!cancelled && isRecording) {
        timerRef.current = setTimeout(() => {
          setCurrentIndex((prev) =>
            prev === availableOptions.length - 1 ? 0 : prev + 1
          );
        }, 18 * 1000);
      }
    }
    console.log('🚀 ~ useEffect ~ isRecording:', isRecording);
    if (isRecording && currentIndex < availableOptions.length) {
      console.log('🚀 ~ useEffect ~ isRecording:', isRecording);
      processNextOption(currentIndex);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelled = true;
    };
  }, [currentIndex, fetchOptionChain, isRecording]);

  const handlePlay = useCallback(() => {
    if (!isRecording) {
      console.log('🚀 ~ handlePlay ~ isRecording:', isRecording);
      setIsRecording(true);
      setCurrentIndex(0);
    }
  }, [isRecording]);

  const handlePause = useCallback(() => {
    setIsRecording(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Record Data</h2>
      <button
        onClick={handlePlay}
        disabled={isRecording}
        style={{ marginRight: 8 }}
      >
        Play
      </button>
      <button onClick={handlePause} disabled={!isRecording}>
        Pause
      </button>
      <div style={{ marginTop: 16 }}>
        {isRecording ? (
          <span>
            Recording... ({currentIndex}/{availableOptions.length})
          </span>
        ) : (
          <span>Paused</span>
        )}
      </div>
    </div>
  );
};

export default RecordDataPage;
