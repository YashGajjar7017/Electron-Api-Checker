import React, { useEffect, useState } from 'react';
import useStore from './store';
import './styles/App.css';
import AuthScreen from './components/AuthScreen';
import MainLayout from './components/MainLayout';

function App() {
  const { isAuthenticated, loginUser } = useStore(
    (state) => ({
      isAuthenticated: state.isAuthenticated,
      loginUser: state.loginUser,
    })
  );
  const [initialized, setInitialized] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    // Load persisted data from Electron storage
    const loadPersistedData = async () => {
      try {
        // Check if we're in Electron environment
        const isElectron = window.electronAPI && typeof window.electronAPI.loadUser === 'function';
        console.log('Loading persisted data... Electron:', isElectron);
        
        // Load user
        if (window.electronAPI && window.electronAPI.loadUser) {
          const userResult = await window.electronAPI.loadUser();
          if (userResult.success && userResult.data) {
            loginUser(userResult.data);
          }
        }

        // Load collections
        let loadedCollections = [];
        if (window.electronAPI && window.electronAPI.loadCollections) {
          const collectionsResult = await window.electronAPI.loadCollections();
          if (collectionsResult.success && collectionsResult.data) {
            loadedCollections = collectionsResult.data;
            useStore.getState().setCollections(loadedCollections);
          }
        }

        // Load APIs
        let loadedAPIs = [];
        if (window.electronAPI && window.electronAPI.loadAPIs) {
          const apisResult = await window.electronAPI.loadAPIs();
          if (apisResult.success && apisResult.data) {
            loadedAPIs = apisResult.data;
            useStore.getState().setAPIs(loadedAPIs);
          }
        }

        // Recover APIs stored inside collections if API file was lost or empty
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

  useEffect(() => {
    // Apply theme to document immediately
    const root = document.documentElement;
    root.classList.add('dark-theme'); // Default to dark theme
    if (theme === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    } else {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    }
  }, [theme]);

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
      {isAuthenticated ? (
        <MainLayout onThemeChange={setTheme} currentTheme={theme} />
      ) : (
        <AuthScreen onThemeChange={setTheme} currentTheme={theme} />
      )}
    </div>
  );
}

export default App;
