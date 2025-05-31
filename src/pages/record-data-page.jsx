import React, { useState, useRef, useCallback, useEffect } from 'react';
import useOptionStore from '../store/option-store';
import { availableOptions, RISK_FREE_INTEREST } from '../utils/constant';
import { updateGoogleSheet } from '../services/google-sheet-service';
import { calculateParityDeviation } from '../utils/optionPricingUtils';
import { formatIndianNumber, formatNumber } from '../utils/common.utils';
import { chartData } from '../data/chart-data';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Legend,
  Tooltip,
} from 'chart.js';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Legend,
  Tooltip
);

const RECORD_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

const BSE_EXPIRY_DATES = [
  // {
  //     label: "27-05-2025",
  //     value: "1748340000"
  // },
  // {
  //   label: '03-06-2025',
  //   value: '1748944800',
  // },
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

const NSE_EXPIRY_DATES = [
  {
    label: '05-06-2025',
    value: '1749117600',
  },
  {
    label: '12-06-2025',
    value: '1749722400',
  },
  {
    label: '26-06-2025',
    value: '1750932000',
  },
  {
    label: '03-07-2025',
    value: '1751536800',
  },
  {
    label: '31-07-2025',
    value: '1753956000',
  },
  {
    label: '25-09-2025',
    value: '1758794400',
  },
  {
    label: '24-12-2025',
    value: '1766570400',
  },
  {
    label: '26-03-2026',
    value: '1774519200',
  },
  {
    label: '25-06-2026',
    value: '1782381600',
  },
  {
    label: '31-12-2026',
    value: '1798711200',
  },
  {
    label: '24-06-2027',
    value: '1813831200',
  },
  {
    label: '30-12-2027',
    value: '1830160800',
  },
  {
    label: '29-06-2028',
    value: '1845885600',
  },
  {
    label: '28-12-2028',
    value: '1861610400',
  },
  {
    label: '28-06-2029',
    value: '1877335200',
  },
  {
    label: '27-12-2029',
    value: '1893060000',
  },
];
const expiryDates = {
  SENSEX: {
    label: '03-06-2025',
    value: '1748944800',
  },
  BANKEX: {
    label: '24-06-2025',
    value: '1750759200',
  },
  NIFTY: {
    label: '05-06-2025',
    value: '1749117600',
  },
  BankNIFTY: {
    label: '26-06-2025',
    value: '1750932000',
  },
  FinNIFTY: {
    label: '26-06-2025',
    value: '1750932000',
  },
};

const RecordDataPage = () => {
  const { fetchOptionChain, oiData } = useOptionStore();
  console.log('🚀 ~ RecordDataPage ~ oiData:', oiData);
  const [isRecording, setIsRecording] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef(null);

  // Sequentially fetch and update for each option, one at a time, every 5 minutes
  useEffect(() => {
    let cancelled = false;
    async function processNextOption(index) {
      const option = availableOptions[index];
      const expiryDate = expiryDates[option.label] ?? {
        label: '05-06-2025',
        value: '1749117600',
      };
      await fetchOptionChain(option.value, expiryDate);
      const {
        underlying,
        selectedExpiry,
        volatilityData,
        enhancedOptions,
        atmIndex,
      } = useOptionStore.getState();

      const indices = [
        atmIndex - 2,
        atmIndex - 1,
        atmIndex,
        atmIndex + 1,
        atmIndex + 2,
      ];

      const dataArrays = indices
        .filter((i) => i >= 0 && i < enhancedOptions.length)
        .map((i) => {
          const opt = enhancedOptions[i];
          const { call, put, strikePrice } = opt;
          const { parityDeviation, deviationPercentage } =
            calculateParityDeviation(
              call.ltp,
              put.ltp,
              underlying?.ltp,
              strikePrice,
              selectedExpiry.value,
              RISK_FREE_INTEREST
            );
          return [
            strikePrice,
            call.underlyingPrice,
            call.oichp,
            formatIndianNumber(call.oi),
            formatIndianNumber(call.oi - put.oi),
            formatIndianNumber(put.oi),
            put.oichp,
            formatNumber(call.volatilityAnalysis.impliedVolatility),
            formatNumber(call.volatilityAnalysis.skewDifference),
            formatNumber(call.volatilityAnalysis.skewPercentage),
            formatNumber(call.volatilityAnalysis.skewRatio),
            call.ltp,
            formatNumber(call.theoreticalPrice),
            `${
              ((call.ltp - call.theoreticalPrice) * 100) / call.theoreticalPrice
            }%`,
            strikePrice,
            formatNumber(parityDeviation),
            formatNumber(deviationPercentage),
            strikePrice,
            `${
              ((put.ltp - put.theoreticalPrice) * 100) / put.theoreticalPrice
            }%`,
            formatNumber(put.theoreticalPrice),
            put.ltp,
            formatNumber(put.volatilityAnalysis.skewRatio),
            formatNumber(put.volatilityAnalysis.skewPercentage),
            formatNumber(put.volatilityAnalysis.skewDifference),
            formatNumber(put.volatilityAnalysis.impliedVolatility),
            formatNumber(volatilityData.impliedVolatility * 100),
            formatNumber(volatilityData.historicalVolatility * 100),
            formatNumber(volatilityData.volatilitySkew.skewRatio * 100),
            selectedExpiry.label,
          ];
        });

      // dataArrays is now an array of arrays: [atmIndex-2, atmIndex-1, atmIndex, atmIndex+1, atmIndex+2]
      await updateGoogleSheet(option, dataArrays);
      if (!cancelled && isRecording) {
        timerRef.current = setTimeout(() => {
          setCurrentIndex((prev) =>
            prev === availableOptions.length - 1 ? 0 : prev + 1
          );
        }, 20 * 1000);
      }
    }

    if (isRecording && currentIndex < availableOptions.length) {
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

  // Helper to get strike prices around atmIndex using atmIndex from store
  const getStrikeCharts = () => {
    const symbolOiData = oiData['NSE:NIFTY50-INDEX'] || {};
    // Find all available strikes and sort numerically
    const strikes = Object.keys(symbolOiData).map(Number).sort((a, b) => a - b);
    const { atmIndex, enhancedOptions } = useOptionStore.getState();
    if (atmIndex == null || !enhancedOptions || !enhancedOptions.length) return null;
    // Get the atm strike from enhancedOptions
    const atmStrike = enhancedOptions[atmIndex]?.strikePrice;
    if (atmStrike == null) return null;
    // Find the indices in the strikes array
    const atmIdxInStrikes = strikes.indexOf(Number(atmStrike));
    const indices = [atmIdxInStrikes - 2, atmIdxInStrikes - 1, atmIdxInStrikes, atmIdxInStrikes + 1, atmIdxInStrikes + 2];
    const charts = indices.map(idx => strikes[idx]).map((strike, i) => strike && symbolOiData[strike] ? { strike, data: symbolOiData[strike], pos: i - 2 } : null);
    // charts: [atm-2, atm-1, atm, atm+1, atm+2] with pos: -2, -1, 0, 1, 2
    return charts;
  };

  const strikeCharts = getStrikeCharts();

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
      <div style={{ marginTop: 24 }}>
        {strikeCharts && strikeCharts[2] && (
          <div style={{ width: '100%', marginBottom: 24 }}>
            <ChartComponent
              strike={strikeCharts[2].strike}
              dataForStrike={strikeCharts[2].data}
              fullWidth
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {strikeCharts && strikeCharts[1] && (
            <div style={{ width: '50%' }}>
              <ChartComponent
                strike={strikeCharts[1].strike}
                dataForStrike={strikeCharts[1].data}
              />
            </div>
          )}
          {strikeCharts && strikeCharts[3] && (
            <div style={{ width: '50%' }}>
              <ChartComponent
                strike={strikeCharts[3].strike}
                dataForStrike={strikeCharts[3].data}
              />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {strikeCharts && strikeCharts[0] && (
            <div style={{ width: '50%' }}>
              <ChartComponent
                strike={strikeCharts[0].strike}
                dataForStrike={strikeCharts[0].data}
              />
            </div>
          )}
          {strikeCharts && strikeCharts[4] && (
            <div style={{ width: '50%' }}>
              <ChartComponent
                strike={strikeCharts[4].strike}
                dataForStrike={strikeCharts[4].data}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChartComponent = ({ strike = 24800, dataForStrike, fullWidth }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!dataForStrike) return;
    const ctx = canvasRef.current.getContext('2d');
    const labels = Object.keys(dataForStrike);
    const callOiData = labels.map((time) => dataForStrike[time].callOi);
    const putOiData = labels.map((time) => dataForStrike[time].putOi);
    const chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Call OI',
            data: callOiData,
            borderColor: 'rgba(75,192,192,1)',
            backgroundColor: 'rgba(75,192,192,0.2)',
            yAxisID: 'y',
            tension: 0.2,
          },
          {
            label: 'Put OI',
            data: putOiData,
            borderColor: 'rgba(255,99,132,1)',
            backgroundColor: 'rgba(255,99,132,0.2)',
            yAxisID: 'y',
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: true },
        stacked: false,
        plugins: {
          title: {
            display: true,
            text: `Chart for Strike ${strike}`,
          },
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'OI' },
          },
        },
      },
    });
    return () => chartInstance.destroy();
  }, [dataForStrike, strike]);
  return (
    <div style={{ width: fullWidth ? '100%' : '100%', margin: '0 auto' }}>
      <canvas ref={canvasRef} height={300} />
    </div>
  );
};

export default RecordDataPage;
