import React, { useEffect, useState } from 'react';
import useStore from './store';
import './styles/animations.css';
import './styles/App.css';
import AuthScreen from './components/AuthScreen';
import MainLayout from './components/MainLayout';
import ToastManager from './components/ToastManager';
import { loadUserWithFallback, saveSessionState, restoreSessionState } from './utils/sessionManager';


function App() {
  const { isAuthenticated, loginUser, settings, updateSettings } = useStore(
    (state) => ({
      isAuthenticated: state.isAuthenticated,
      loginUser: state.loginUser,
      settings: state.settings,
      updateSettings: state.updateSettings,
    })
  );
  const [initialized, setInitialized] = useState(false);
  const theme = settings?.theme || 'dark';

  useEffect(() => {
    // Bridge electron native to in-app toast manager if available
    try {
      if (window.electronAPI && typeof window.electronAPI.showToast === 'function') {
        const original = window.electronAPI.showToast;
        window.electronAPI.showToast = (...args) => {
          try {
            const msg = args[0] || 'Notification';
            const detail = args[1] && args[1].detail ? args[1].detail : '';
            window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: msg, detail } }));
          } catch (e) {}
          return original(...args);
        };
      }
    } catch (e) {}
    // Load persisted data from Electron storage
    const loadPersistedData = async () => {
      try {
        // Check if we're in Electron environment
        const isElectron = window.electronAPI && typeof window.electronAPI.loadUser === 'function';
        console.log('Loading persisted data... Electron:', isElectron);

        // Load persisted auth user (GitHub / app state)
        // This is what enables "sign in once" behavior across app restarts.
        try {
          if (window.electronAPI && typeof window.electronAPI.loadUser === 'function') {
            const userResult = await window.electronAPI.loadUser();
            if (userResult?.success && userResult?.data) {
              loginUser(userResult.data);
            } else if (userResult?.data) {
              // tolerate different shapes
              loginUser(userResult.data);
            }
          }
        } catch (e) {
          // ignore; will fall back to other persistence sources
        }

        // Load unified Electron app state first if available
        let loadedCollections = [];
        let loadedAPIs = [];
        if (window.electronAPI && window.electronAPI.loadAppState) {
          const appStateResult = await window.electronAPI.loadAppState();
          if (appStateResult.success && appStateResult.data) {
            const appState = appStateResult.data;
            if (appState.user) {
              loginUser(appState.user);
            }
            if (Array.isArray(appState.collections)) {
              loadedCollections = appState.collections;
              useStore.getState().setCollections(loadedCollections);
            }
            if (Array.isArray(appState.apis)) {
              loadedAPIs = appState.apis;
              useStore.getState().setAPIs(loadedAPIs);
            }
            if (appState.settings && Object.keys(appState.settings).length > 0) {
              useStore.getState().loadSettings(appState.settings);
            }
            // Restore environments if saved
            if (Array.isArray(appState.environments)) {
              useStore.getState().setEnvironments(appState.environments);
            }
            if (appState.activeEnvironment) {
              useStore.getState().setActiveEnvironment(appState.activeEnvironment);
            }
            // Restore session token if not expired
            if (appState.sessionToken && appState.sessionTokenExpiry && Date.now() < appState.sessionTokenExpiry) {
              const minutes = Math.ceil((appState.sessionTokenExpiry - Date.now()) / 60000);
              useStore.getState().setSessionToken(appState.sessionToken, minutes);
            }
            // Restore OTP data if not expired
            if (appState.otpData && appState.otpData.expiry && Date.now() < appState.otpData.expiry) {
              useStore.getState().setOTPData(appState.otpData.current, appState.otpData.expiry);
            }

          }
        }

        // Load settings from settings.json if available
        if (window.electronAPI && window.electronAPI.loadSettings) {
          try {
            const savedSettings = await window.electronAPI.loadSettings();
            if (savedSettings) {
              useStore.getState().loadSettings(savedSettings);
            }
          } catch (e) {
            console.error('Error loading settings from settings.json:', e);
          }
        }


        // Fallback legacy persistence if the unified state file is missing
        if (loadedCollections.length === 0 && window.electronAPI && window.electronAPI.loadCollections) {
          const collectionsResult = await window.electronAPI.loadCollections();
          if (collectionsResult.success && collectionsResult.data) {
            loadedCollections = collectionsResult.data;
            useStore.getState().setCollections(loadedCollections);
          }
        }

        if (loadedAPIs.length === 0 && window.electronAPI && window.electronAPI.loadAPIs) {
          const apisResult = await window.electronAPI.loadAPIs();
          if (apisResult.success && apisResult.data) {
            loadedAPIs = apisResult.data;
            useStore.getState().setAPIs(loadedAPIs);
          }
        }

        if (loadedAPIs.length === 0 && loadedCollections.length > 0) {
          const recoveredAPIs = loadedCollections.flatMap((collection) =>
            Array.isArray(collection.apis)
              ? collection.apis.map((api) => ({ ...api, collectionId: collection.id }))
              : []
          );
          if (recoveredAPIs.length > 0) {
            useStore.getState().setAPIs(recoveredAPIs);
            if (window.electronAPI && window.electronAPI.saveAPIs) {
              window.electronAPI.saveAPIs(recoveredAPIs);
            }
            loadedAPIs = recoveredAPIs;
          }
        }

        // Create default Auth API if no APIs exist
        const state = useStore.getState();
        if (state.apis.length === 0) {
          const defaultCollection = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'Default',
            apis: [],
            createdAt: new Date(),
          };
          state.addCollection(defaultCollection);
          if (window.electronAPI && window.electronAPI.saveCollections) {
            window.electronAPI.saveCollections([defaultCollection]);
          }

          const authApi = {
            id: Math.random().toString(36).substr(2, 9),
            collectionId: defaultCollection.id,
            name: 'Auth',
            method: 'POST',
            endpoint: '/api/v1/auth/login',
            headers: { 'Content-Type': 'application/json' },
            params: {},
            body: JSON.stringify({ username: '', password: '' }, null, 2),
            auth: { type: 'none', token: '' },
            skipOtp: true,
          };
          state.addAPI(authApi);
          state.setCurrentAPI(authApi);
          if (window.electronAPI && window.electronAPI.saveAPIs) {
            window.electronAPI.saveAPIs([authApi]);
          }
        } else if (!state.currentAPI && state.apis.length > 0) {
          // Set current API to first available API if none is selected
          state.setCurrentAPI(state.apis[0]);
        }
      } catch (error) {
        console.error('Failed to load persisted data:', error);
      }
      setInitialized(true);
    };

    loadPersistedData();
  }, [loginUser]);

  const handleThemeChange = (newTheme) => {
    updateSettings({ theme: newTheme });
  };

  if (!initialized) {
    return (
      <div className="loading-container">
        <div className="loader">
          <div className="spinner"></div>
          <p>Loading API Checker...</p>
          <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>Initializing data & services</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${theme}-theme`}>
      <ToastManager />
      {isAuthenticated ? (
        <MainLayout onThemeChange={handleThemeChange} currentTheme={theme} />
      ) : (
        <AuthScreen onThemeChange={handleThemeChange} currentTheme={theme} />
      )}
    </div>
  );
}

export default App;
