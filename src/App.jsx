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
    // Load user from Electron storage
    const loadPersistedUser = async () => {
      try {
        if (window.electronAPI && window.electronAPI.loadUser) {
          const result = await window.electronAPI.loadUser();
          if (result.success && result.data) {
            loginUser(result.data);
          }
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      }
      setInitialized(true);
    };

    loadPersistedUser();
  }, []);

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
