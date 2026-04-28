import React, { useEffect, useState } from 'react';
import useStore from './store';
import './styles/App.css';
import AuthScreen from './components/AuthScreen';
import MainLayout from './components/MainLayout';

function App() {
  const { isAuthenticated, loginUser, loadUser: loadUserFromStore } = useStore(
    (state) => ({
      isAuthenticated: state.isAuthenticated,
      loginUser: state.loginUser,
      loadUser: state.user,
    })
  );
  const [initialized, setInitialized] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    // Load persisted data from Electron storage
    const loadPersistedData = async () => {
      try {
        // Load user
        if (window.electronAPI && window.electronAPI.loadUser) {
          const userResult = await window.electronAPI.loadUser();
          if (userResult.success && userResult.data) {
            loginUser(userResult.data);
          }
        }

        // Load collections
        if (window.electronAPI && window.electronAPI.loadCollections) {
          const collectionsResult = await window.electronAPI.loadCollections();
          if (collectionsResult.success && collectionsResult.data) {
            useStore.getState().setCollections(collectionsResult.data);
          }
        }

        // Load APIs
        if (window.electronAPI && window.electronAPI.loadAPIs) {
          const apisResult = await window.electronAPI.loadAPIs();
          if (apisResult.success && apisResult.data) {
            useStore.getState().setAPIs(apisResult.data);
          }
        }
      } catch (error) {
        console.error('Failed to load persisted data:', error);
      }
      setInitialized(true);
    };

    loadPersistedData();
  }, [loginUser]);

  useEffect(() => {
    // Apply theme to document
    const root = document.documentElement;
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
