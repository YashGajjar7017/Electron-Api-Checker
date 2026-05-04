import create from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Helper function to auto-persist data
const persistData = async (key, data) => {
  if (window.electronAPI) {
    try {
      console.log(`Persisting ${key}:`, data.length, 'items');
      const result = key === 'apis' 
        ? await window.electronAPI.saveAPIs(data)
        : await window.electronAPI.saveCollections(data);
      if (result?.success !== true) {
        console.error(`Persist ${key} failed:`, result?.error);
      } else {
        console.log(`✅ Persisted ${key} successfully`);
      }
    } catch (error) {
      console.error(`❌ Failed to persist ${key}:`, error);
    }
  }
};

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
addCollection: (collection) => {
      set((state) => {
        const newCollections = [...state.collections, collection];
        persistData('collections', newCollections);
        return { collections: newCollections };
      });
    },
    updateCollection: (id, collection) =>
      set((state) => {
        const newCollections = state.collections.map((c) =>
          c.id === id ? { ...c, ...collection } : c
        );
        persistData('collections', newCollections);
        return { collections: newCollections };
      }),
    deleteCollection: (id) =>
      set((state) => {
        const newCollections = state.collections.filter((c) => c.id !== id);
        persistData('collections', newCollections);
        return { collections: newCollections };
      }),
    setCollections: (collections) => {
      persistData('collections', collections);
      set({ collections });
    },
    shuffleCollections: () =>
      set((state) => {
        const shuffled = [...state.collections];
        // Fisher-Yates shuffle algorithm
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        persistData('collections', shuffled);
        return { collections: shuffled };
      }),

    // APIs state
    apis: [],
    addAPI: (api) =>
      set((state) => {
        const newApis = [...state.apis, api];
        persistData('apis', newApis);
        return { apis: newApis };
      }),
    updateAPI: (id, api) =>
      set((state) => {
        const newApis = state.apis.map((a) =>
          a.id === id ? { ...a, ...api } : a
        );
        persistData('apis', newApis);
        return { apis: newApis };
      }),
    deleteAPI: (id) =>
      set((state) => {
        const newApis = state.apis.filter((a) => a.id !== id);
        persistData('apis', newApis);
        return { apis: newApis };
      }),
    setAPIs: (apis) => {
      persistData('apis', apis);
      set({ apis });
    },
    shuffleAPIs: () =>
      set((state) => {
        const shuffled = [...state.apis];
        // Fisher-Yates shuffle algorithm
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        persistData('apis', shuffled);
        return { apis: shuffled };
      }),

    // Current API state
    currentAPI: null,
    setCurrentAPI: (api) => set({ currentAPI: api }),

    // Server URL state - default to localhost:3000 (React dev server)
    serverUrl: 'http://localhost:3000',
    setServerUrl: (url) => set({ serverUrl: url }),

    // Auth token state
    authToken: '',
    setAuthToken: (token) => set({ authToken: token }),

    // Response history
    responseHistory: [],
    addResponse: (response) =>
      set((state) => {
        // Keep only last 200 responses to avoid memory bloat
        const newHistory = [
          { ...response, timestamp: new Date() },
          ...state.responseHistory,
        ].slice(0, 200);
        return { responseHistory: newHistory };
      }),
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

    // API Response Token state (from login API, 10 min expiry by default)
    apiResponseToken: null,
    apiResponseTokenExpiry: null,
    setAPIResponseToken: (token, validForMinutes = 10) => {
      const expiryTime = Date.now() + validForMinutes * 60 * 1000;
      set({ apiResponseToken: token, apiResponseTokenExpiry: expiryTime });
      // Auto-clear token when it expires
      setTimeout(() => {
        set({ apiResponseToken: null, apiResponseTokenExpiry: null });
      }, validForMinutes * 60 * 1000);
    },
    clearAPIResponseToken: () =>
      set({ apiResponseToken: null, apiResponseTokenExpiry: null }),
    getAPIResponseToken: () => {
      const state = get();
      if (state.apiResponseToken && state.apiResponseTokenExpiry && Date.now() < state.apiResponseTokenExpiry) {
        return state.apiResponseToken;
      }
      return null;
    },

    // Batch testing state - enhanced with stats
    isBatchTesting: false,
    batchResults: [],
    batchStats: { total: 0, success: 0, failed: 0, avgResponseTime: 0 },
    batchTestDelay: 500, // Delay in ms between batch test requests
    startBatchTesting: () => set({ isBatchTesting: true, batchResults: [], batchStats: { total: 0, success: 0, failed: 0, avgResponseTime: 0 } }),
    stopBatchTesting: () => set({ isBatchTesting: false }),
    addBatchResult: (result) =>
      set((state) => {
        const newResults = [...state.batchResults, result];
        const successful = newResults.filter(r => r.status >= 200 && r.status < 300).length;
        const totalTime = newResults.reduce((sum, r) => sum + (r.responseTime || 0), 0);
        const stats = {
          total: newResults.length,
          success: successful,
          failed: newResults.length - successful,
          avgResponseTime: Math.round(totalTime / newResults.length) || 0,
        };
        return { batchResults: newResults, batchStats: stats };
      }),
    clearBatchResults: () => set({ batchResults: [], batchStats: { total: 0, success: 0, failed: 0, avgResponseTime: 0 } }),
    setBatchTestDelay: (delay) => set({ batchTestDelay: Math.max(100, delay) }),

    // UI state
    selectedSidebar: null,
    setSelectedSidebar: (sidebar) => set({ selectedSidebar: sidebar }),

    // Theme
    theme: 'dark',
    toggleTheme: () =>
      set((state) => ({
        theme: state.theme === 'dark' ? 'light' : 'dark',
      })),

    // MCP Configuration
    mcpServers: [],
    addMCPServer: (server) =>
      set((state) => {
        const newServers = [...state.mcpServers, server];
        persistData('mcpServers', newServers);
        return { mcpServers: newServers };
      }),
    updateMCPServer: (id, updates) =>
      set((state) => {
        const newServers = state.mcpServers.map((server) =>
          server.id === id ? { ...server, ...updates } : server
        );
        persistData('mcpServers', newServers);
        return { mcpServers: newServers };
      }),
    deleteMCPServer: (id) =>
      set((state) => {
        const newServers = state.mcpServers.filter((server) => server.id !== id);
        persistData('mcpServers', newServers);
        return { mcpServers: newServers };
      }),
    setMCPServers: (servers) => {
      persistData('mcpServers', servers);
      set({ mcpServers: servers });
    },
  }))
);

export default useStore;
