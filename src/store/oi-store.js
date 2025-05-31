import { create } from 'zustand';

// Initial structure for OI data, similar to chartData.js
const initialOiData = {
  NIFTY: {},
  BankNIFTY: {},
  FinNIFTY: {},
};

const useOiStore = create((set, get) => ({
  oiData: initialOiData,

  // Set OI data for a specific option (e.g., NIFTY, BankNIFTY, FinNIFTY)
  setOiData: (option, data) =>
    set((state) => ({
      oiData: {
        ...state.oiData,
        [option]: data,
      },
    })),

  // Add or update a single time entry for a specific strike and option
  updateOiEntry: (option, strike, time, entry) =>
    set((state) => ({
      oiData: {
        ...state.oiData,
        [option]: {
          ...state.oiData[option],
          [strike]: {
            ...((state.oiData[option] && state.oiData[option][strike]) || {}),
            [time]: entry,
          },
        },
      },
    })),

  // Clear all OI data
  clearOiData: () => set({ oiData: initialOiData }),
}));

export default useOiStore;
