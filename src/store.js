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

const persistSessionData = async (sessionToken, sessionTokenExpiry, otpData) => {
  if (window.electronAPI && window.electronAPI.saveAppState) {
    try {
      await window.electronAPI.saveAppState({
        sessionToken,
        sessionTokenExpiry,
        otpData,
      });
      console.log('✅ Session and OTP persisted successfully');
    } catch (error) {
      console.error('❌ Failed to persist session data:', error);
    }
  }
};

const persistEnvironments = async (environments, activeEnvironment) => {
  if (window.electronAPI && window.electronAPI.saveAppState) {
    try {
      await window.electronAPI.saveAppState({
        environments,
        activeEnvironment,
      });
      console.log('✅ Environments persisted successfully');
    } catch (error) {
      console.error('❌ Failed to persist environments:', error);
    }
  }
};

const adjustColorBrightness = (hex, percent) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  let num = parseInt(hex.replace("#",""), 16),
      amt = Math.round(2.55 * percent),
      R = ((num >> 16) & 0xFF) + amt,
      G = ((num >> 8) & 0xFF) + amt,
      B = (num & 0xFF) + amt;
  return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
};

const applyGlobalSettings = (settings) => {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  if (!settings) return;

  // Font Size Scale
  const fsScale = settings.fontSize === 'small' ? '13px' : settings.fontSize === 'large' ? '18px' : '16px';
  root.style.setProperty('--font-size-scale', fsScale);

  // UI Scale
  const uiScale = settings.uiScale || 1;
  root.style.setProperty('--ui-scale', uiScale.toString());

  // Apply root font-size based on text size and UI scale
  let baseSize = 16;
  if (settings.fontSize === 'small') baseSize = 13;
  if (settings.fontSize === 'large') baseSize = 18;
  const finalSize = baseSize * uiScale;
  root.style.fontSize = `${finalSize}px`;

  // Card border radius
  const radius = settings.cardRadius === 'small' ? '8px' : settings.cardRadius === 'large' ? '20px' : '12px';
  root.style.setProperty('--card-radius', radius);

  // Accent / Primary color
  if (settings.accentColor) {
    root.style.setProperty('--primary', settings.accentColor);
    root.style.setProperty('--accent', settings.accentColor);
    
    // Shift color for a nice gradient
    const shifted = adjustColorBrightness(settings.accentColor, -15);
    root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${settings.accentColor} 0%, ${shifted} 100%)`);
  }

  // Background colors
  if (settings.backgroundColor) {
    root.style.setProperty('--bg-color', settings.backgroundColor);
    if (settings.theme === 'dark' || settings.theme === 'amoled') {
      root.style.setProperty('--bg-primary', settings.backgroundColor);
      root.style.setProperty('--background', settings.backgroundColor);
    }
  }

  // Transparency / Glass opacity
  if (settings.transparency !== undefined) {
    root.style.setProperty('--transparency', settings.transparency.toString());
    root.style.setProperty('--glass-bg', `rgba(13, 18, 34, ${settings.transparency})`);
  }

  // Font Family
  if (settings.fontFamily) {
    let fontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    if (settings.fontFamily === 'inter') {
      fontStack = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    } else if (settings.fontFamily === 'jetbrains') {
      fontStack = '"JetBrains Mono", Consolas, Monaco, monospace';
    } else if (settings.fontFamily === 'fira') {
      fontStack = '"Fira Code", Consolas, Monaco, monospace';
    }
    root.style.setProperty('--font-family', fontStack);
    document.body.style.fontFamily = fontStack;
  }

  // Compact Mode class
  if (settings.compactMode) {
    document.documentElement.classList.add('compact-mode');
  } else {
    document.documentElement.classList.remove('compact-mode');
  }

  // Animation speed transition overrides
  let speedMultiplier = 1;
  if (settings.animationSpeed === 'fast') speedMultiplier = 0.5;
  if (settings.animationSpeed === 'slow') speedMultiplier = 2;
  root.style.setProperty('--transition', `all ${0.25 * speedMultiplier}s cubic-bezier(0.4, 0, 0.2, 1)`);
  root.style.setProperty('--transition-fast', `${150 * speedMultiplier}ms cubic-bezier(0.4, 0, 0.2, 1)`);
  root.style.setProperty('--transition-base', `${250 * speedMultiplier}ms cubic-bezier(0.4, 0, 0.2, 1)`);

  // Themes
  if (settings.theme === 'amoled') {
    document.documentElement.classList.add('amoled-theme');
    document.documentElement.classList.add('dark-theme');
    document.documentElement.classList.remove('light-theme');
    root.style.setProperty('--bg-primary', '#000000');
    root.style.setProperty('--bg-secondary', '#050505');
    root.style.setProperty('--bg-tertiary', '#111111');
    root.style.setProperty('--background', '#000000');
  } else if (settings.theme === 'dark') {
    document.documentElement.classList.remove('amoled-theme');
    document.documentElement.classList.add('dark-theme');
    document.documentElement.classList.remove('light-theme');
    if (!settings.backgroundColor) {
      root.style.setProperty('--bg-primary', '#060913');
      root.style.setProperty('--bg-secondary', '#0d1222');
      root.style.setProperty('--bg-tertiary', '#192138');
    }
  } else if (settings.theme === 'light') {
    document.documentElement.classList.remove('amoled-theme');
    document.documentElement.classList.remove('dark-theme');
    document.documentElement.classList.add('light-theme');
    root.style.setProperty('--bg-primary', '#f8fafc');
    root.style.setProperty('--bg-secondary', '#f1f5f9');
    root.style.setProperty('--bg-tertiary', '#e2e8f0');
  }
};


const useStore = create(
  subscribeWithSelector((set, get) => ({
    // Auth state
    user: null,
    isAuthenticated: false,
    loginUser: async (user) => {
      if (window.electronAPI && window.electronAPI.saveUser) {
        await window.electronAPI.saveUser(user);
      }
      set({ user, isAuthenticated: true });
    },
    logoutUser: async () => {
      if (window.electronAPI && window.electronAPI.saveUser) {
        await window.electronAPI.saveUser(null);
      }
      set({ user: null, isAuthenticated: false });
    },

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
        
        const nextState = { apis: newApis };
        if (state.currentAPI && state.currentAPI.id === id) {
          nextState.currentAPI = { ...state.currentAPI, ...api };
        }
        return nextState;
      }),
    deleteAPI: (id) =>
      set((state) => {
        const newApis = state.apis.filter((a) => a.id !== id);
        persistData('apis', newApis);
        return { apis: newApis };
      }),
    setAPIs: (apis) => {
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

    // Server URL state - default to localhost:5000 (API server)
    serverUrl: 'http://localhost:5000',
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
    updateResponse: (id, updatedFields) =>
      set((state) => ({
        responseHistory: state.responseHistory.map((r) =>
          r.id === id ? { ...r, ...updatedFields } : r
        ),
      })),

    // Comparison mode
    comparisonMode: false,
    toggleComparisonMode: () =>
      set((state) => ({
        comparisonMode: !state.comparisonMode,
      })),
    comparisonResponses: [],
    setComparisonResponses: (responses) =>
      set({ comparisonResponses: responses }),

    // Plugin architecture
    plugins: [],
    registerPlugin: (plugin) =>
      set((state) => ({ plugins: [...state.plugins, plugin] })),
    runPlugin: async (pluginId, payload) => {
      const plugin = get().plugins.find((p) => p.id === pluginId);
      if (plugin && typeof plugin.execute === 'function') {
        return await plugin.execute(payload, get());
      }
      return null;
    },

    // Environment support
    environments: [
      { id: 'dev', name: 'Development', baseUrl: 'http://localhost:5000', values: {} },
      { id: 'staging', name: 'Staging', baseUrl: 'https://staging.api.local', values: {} },
      { id: 'prod', name: 'Production', baseUrl: 'https://api.production.com', values: {} },
    ],
    activeEnvironment: 'dev',
    setActiveEnvironment: (id) => {
      set({ activeEnvironment: id });
      persistEnvironments(get().environments, id);
    },
    setEnvironments: (envs) => {
      set({ environments: envs });
      persistEnvironments(envs, get().activeEnvironment);
    },
    addEnvironment: (env) => {
      set((state) => {
        const nextEnvironments = [...state.environments, env];
        persistEnvironments(nextEnvironments, state.activeEnvironment);
        return { environments: nextEnvironments };
      });
    },
    deleteEnvironment: (id) => {
      set((state) => {
        const nextEnvironments = state.environments.filter((e) => e.id !== id);
        let nextActive = state.activeEnvironment;
        if (nextActive === id) {
          nextActive = nextEnvironments[0]?.id || 'dev';
        }
        persistEnvironments(nextEnvironments, nextActive);
        return { environments: nextEnvironments, activeEnvironment: nextActive };
      });
    },
    updateEnvironment: (id, values) =>
      set((state) => {
        const nextEnvironments = state.environments.map((env) =>
          env.id === id ? { ...env, ...values } : env
        );
        persistEnvironments(nextEnvironments, state.activeEnvironment);
        return { environments: nextEnvironments };
      }),

    // Automation and workflow state
    automationWorkflows: [],
    addAutomationWorkflow: (workflow) =>
      set((state) => ({ automationWorkflows: [...state.automationWorkflows, workflow] })),
    updateAutomationWorkflow: (id, workflow) =>
      set((state) => ({
        automationWorkflows: state.automationWorkflows.map((item) =>
          item.id === id ? { ...item, ...workflow } : item
        ),
      })),

    // Performance data
    performanceMetrics: [],
    addPerformanceMetric: (metric) =>
      set((state) => ({
        performanceMetrics: [...state.performanceMetrics, metric].slice(-1000),
      })),
    clearPerformanceMetrics: () => set({ performanceMetrics: [] }),

    // Backend status / server messaging
    backendMessage: '',
    setBackendMessage: (message) => set({ backendMessage: message }),

    // Session token state (OTP-based, 10 min expiry)
    sessionToken: '',
    sessionTokenExpiry: null,
    sessionTokenTimeoutId: null,
    setSessionToken: (token, validForMinutes = 10) => {
      const state = get();
      // Clear any existing timeout
      if (state.sessionTokenTimeoutId) {
        clearTimeout(state.sessionTokenTimeoutId);
      }
      const expiryTime = Date.now() + validForMinutes * 60 * 1000;
      // Set up auto-clear when expires
      const timeoutId = setTimeout(() => {
        set({ sessionToken: '', sessionTokenExpiry: null, sessionTokenTimeoutId: null });
        persistSessionData('', null, get().otpData);
      }, validForMinutes * 60 * 1000);
      set({ sessionToken: token, sessionTokenExpiry: expiryTime, sessionTokenTimeoutId: timeoutId });
      persistSessionData(token, expiryTime, state.otpData);
    },
    clearSessionToken: () => {
      const state = get();
      if (state.sessionTokenTimeoutId) {
        clearTimeout(state.sessionTokenTimeoutId);
      }
      set({ sessionToken: '', sessionTokenExpiry: null, sessionTokenTimeoutId: null });
      persistSessionData('', null, state.otpData);
    },
    getSessionTokenRemainingTime: () => {
      const state = get();
      if (state.sessionToken && state.sessionTokenExpiry && Date.now() < state.sessionTokenExpiry) {
        return Math.max(0, state.sessionTokenExpiry - Date.now());
      }
      return 0;
    },

    // API Response Token state (from login API, 10 min expiry by default)
    apiResponseToken: null,
    apiResponseTokenExpiry: null,
    apiResponseTokenTimeoutId: null,
    setAPIResponseToken: (token, validForMinutes = 10) => {
      const state = get();
      // Clear any existing timeout
      if (state.apiResponseTokenTimeoutId) {
        clearTimeout(state.apiResponseTokenTimeoutId);
      }
      const expiryTime = Date.now() + validForMinutes * 60 * 1000;
      // Set up auto-clear when expires
      const timeoutId = setTimeout(() => {
        set({ apiResponseToken: null, apiResponseTokenExpiry: null, apiResponseTokenTimeoutId: null });
      }, validForMinutes * 60 * 1000);
      set({ apiResponseToken: token, apiResponseTokenExpiry: expiryTime, apiResponseTokenTimeoutId: timeoutId });
    },
    clearAPIResponseToken: () => {
      const state = get();
      if (state.apiResponseTokenTimeoutId) {
        clearTimeout(state.apiResponseTokenTimeoutId);
      }
      set({ apiResponseToken: null, apiResponseTokenExpiry: null, apiResponseTokenTimeoutId: null });
    },
    getAPIResponseToken: () => {
      const state = get();
      if (state.apiResponseToken && state.apiResponseTokenExpiry && Date.now() < state.apiResponseTokenExpiry) {
        return state.apiResponseToken;
      }
      return null;
    },
    getAPIResponseTokenRemainingTime: () => {
      const state = get();
      if (state.apiResponseToken && state.apiResponseTokenExpiry && Date.now() < state.apiResponseTokenExpiry) {
        return Math.max(0, state.apiResponseTokenExpiry - Date.now());
      }
      return 0;
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
    selectedSidebar: 'collections',
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

    // Settings state
    settings: {
      fontSize: 'medium',
      uiScale: 1,
      fontFamily: 'system',
      theme: 'dark',
      compactMode: false,
      cardRadius: 'medium',
      animationSpeed: 'normal',
      transparency: 0.95,
      accentColor: '#7c3aed',
      backgroundColor: '#0f172a',
      showNotifications: true,
      autoUpdate: true,
      gpuAcceleration: true,
      hardwareRendering: true,
      memoryOptimization: false,
    },
    updateSettings: (newSettings) =>
      set((state) => {
        const updated = { ...state.settings, ...newSettings };
        if (window.electronAPI?.saveSettings) {
          window.electronAPI.saveSettings(updated);
        }
        applyGlobalSettings(updated);
        return { settings: updated };
      }),
    loadSettings: (loadedSettings) => {
      const updated = { ...get().settings, ...loadedSettings };
      applyGlobalSettings(updated);
      set({ settings: updated });
    },

    // GitHub OAuth state
    githubToken: null,
    githubUser: null,
    setGitHubToken: (token) => set({ githubToken: token }),
    setGitHubUser: (user) => set({ githubUser: user }),
    clearGitHub: () => set({ githubToken: null, githubUser: null }),

    // OTP state
    otpData: {
      current: null,
      cached: null,
      expiry: null,
      attempts: 0,
    },
    setOTPData: (otp, expiry) => {
      const state = get();
      const updatedOtpData = {
        current: otp,
        cached: otp,
        expiry,
        attempts: 0,
      };
      set({ otpData: updatedOtpData });
      persistSessionData(state.sessionToken, state.sessionTokenExpiry, updatedOtpData);
    },
    clearOTPData: () => {
      const state = get();
      const clearedOtpData = {
        current: null,
        cached: null,
        expiry: null,
        attempts: 0,
      };
      set({ otpData: clearedOtpData });
      persistSessionData(state.sessionToken, state.sessionTokenExpiry, clearedOtpData);
    },

    // System monitor state
    systemMetrics: {
      cpu: 0,
      ram: 0,
      disk: 0,
      appMemory: 0,
      networkUp: 0,
      networkDown: 0,
      activeRequests: 0,
      failedRequests: 0,
      requestsPerSec: 0,
      isOnline: true,
      uptime: 0,
      automationTasks: 0,
    },
    updateSystemMetrics: (metrics) =>
      set({ systemMetrics: { ...get().systemMetrics, ...metrics } }),
  }))
);

export default useStore;
