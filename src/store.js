import create from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const useStore = create(
  subscribeWithSelector((set, get) => ({
    // Auth state
    user: null,
    isAuthenticated: false,
    loginUser: (user) =>
      set({ user, isAuthenticated: true }),
    logoutUser: () =>
      set({ user: null, isAuthenticated: false }),

    // Collections state
    collections: [],
    addCollection: (collection) =>
      set((state) => ({
        collections: [...state.collections, collection],
      })),
    updateCollection: (id, collection) =>
      set((state) => ({
        collections: state.collections.map((c) =>
          c.id === id ? { ...c, ...collection } : c
        ),
      })),
    deleteCollection: (id) =>
      set((state) => ({
        collections: state.collections.filter((c) => c.id !== id),
      })),
    setCollections: (collections) => set({ collections }),

    // APIs state
    apis: [],
    addAPI: (api) =>
      set((state) => ({
        apis: [...state.apis, api],
      })),
    updateAPI: (id, api) =>
      set((state) => ({
        apis: state.apis.map((a) =>
          a.id === id ? { ...a, ...api } : a
        ),
      })),
    deleteAPI: (id) =>
      set((state) => ({
        apis: state.apis.filter((a) => a.id !== id),
      })),
    setAPIs: (apis) => set({ apis }),

    // Current API state
    currentAPI: null,
    setCurrentAPI: (api) => set({ currentAPI: api }),

    // Server URL state
    serverUrl: 'http://localhost:3000',
    setServerUrl: (url) => set({ serverUrl: url }),

    // Auth token state
    authToken: '',
    setAuthToken: (token) => set({ authToken: token }),

    // Response history
    responseHistory: [],
    addResponse: (response) =>
      set((state) => ({
        responseHistory: [
          ...state.responseHistory,
          { ...response, timestamp: new Date() },
        ],
      })),
    clearResponseHistory: () => set({ responseHistory: [] }),

    // Comparison mode
    comparisonMode: false,
    toggleComparisonMode: () =>
      set((state) => ({
        comparisonMode: !state.comparisonMode,
      })),
    comparisonResponses: [],
    setComparisonResponses: (responses) =>
      set({ comparisonResponses: responses }),

    // Session token state (OTP-based, 10 min expiry)
    sessionToken: '',
    sessionTokenExpiry: null,
    setSessionToken: (token) =>
      set({ sessionToken: token, sessionTokenExpiry: Date.now() + 10 * 60 * 1000 }),
    clearSessionToken: () =>
      set({ sessionToken: '', sessionTokenExpiry: null }),

    // Batch testing state
    isBatchTesting: false,
    batchResults: [],
    startBatchTesting: () => set({ isBatchTesting: true }),
    stopBatchTesting: () => set({ isBatchTesting: false }),
    addBatchResult: (result) =>
      set((state) => ({
        batchResults: [...state.batchResults, result],
      })),
    clearBatchResults: () => set({ batchResults: [] }),

    // UI state
    selectedSidebar: null,
    setSelectedSidebar: (sidebar) => set({ selectedSidebar: sidebar }),

    // Theme
    theme: 'dark',
    toggleTheme: () =>
      set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark',
      })),
  }))
);

export default useStore;
