/**
 * Session Manager - Handles user.json loading and session restoration
 * Supports custom folder paths and fallback mechanisms
 */

const DEFAULT_USER_FILE = 'user.json';
const SESSION_STORAGE_KEY = 'app_session_state';

/**
 * Load user data from specified folder path
 * @param {string} folderPath - Path to folder containing user.json
 * @returns {Promise<{success: boolean, data: any, error: string}>}
 */
export const loadUserFromFolder = async (folderPath) => {
  try {
    if (!window.electronAPI || !window.electronAPI.loadUserFromPath) {
      throw new Error('Electron API not available');
    }

    const result = await window.electronAPI.loadUserFromPath(folderPath);
    return result;
  } catch (error) {
    console.error('Error loading user from folder:', error);
    return {
      success: false,
      data: null,
      error: error.message || 'Failed to load user from folder',
    };
  }
};

/**
 * Save user data to specified folder
 * @param {string} folderPath - Path to folder
 * @param {any} userData - User data to save
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const saveUserToFolder = async (folderPath, userData) => {
  try {
    if (!window.electronAPI || !window.electronAPI.saveUserToPath) {
      throw new Error('Electron API not available');
    }

    const result = await window.electronAPI.saveUserToPath(folderPath, userData);
    return result;
  } catch (error) {
    console.error('Error saving user to folder:', error);
    return {
      success: false,
      error: error.message || 'Failed to save user to folder',
    };
  }
};

/**
 * Restore complete session from stored state
 * @returns {Promise<{user: any, collections: any[], apis: any[]}>}
 */
export const restoreSessionState = async () => {
  try {
    const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionData) {
      return { user: null, collections: [], apis: [] };
    }

    const parsed = JSON.parse(sessionData);
    return {
      user: parsed.user || null,
      collections: parsed.collections || [],
      apis: parsed.apis || [],
    };
  } catch (error) {
    console.error('Error restoring session state:', error);
    return { user: null, collections: [], apis: [] };
  }
};

/**
 * Save complete session state
 * @param {any} user - Current user
 * @param {any[]} collections - Collections array
 * @param {any[]} apis - APIs array
 */
export const saveSessionState = (user, collections, apis) => {
  try {
    const sessionData = {
      user,
      collections: collections || [],
      apis: apis || [],
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
  } catch (error) {
    console.error('Error saving session state:', error);
  }
};

/**
 * Load user with fallback chain: 
 * 1. Custom folder path if provided
 * 2. Electron default storage
 * 3. LocalStorage backup
 * @param {string} customFolderPath - Optional custom folder path
 * @returns {Promise<any>}
 */
export const loadUserWithFallback = async (customFolderPath) => {
  try {
    // Try custom folder first
    if (customFolderPath) {
      const result = await loadUserFromFolder(customFolderPath);
      if (result.success && result.data) {
        return result.data;
      }
    }

    // Try Electron storage
    if (window.electronAPI && window.electronAPI.loadUser) {
      const result = await window.electronAPI.loadUser();
      if (result?.success && result?.data) {
        return result.data;
      }
    }

    // Try localStorage backup
    const localStorageUser = localStorage.getItem('app_user');
    if (localStorageUser) {
      return JSON.parse(localStorageUser);
    }

    return null;
  } catch (error) {
    console.error('Error in loadUserWithFallback:', error);
    return null;
  }
};

/**
 * Clear all session data
 */
export const clearSessionState = () => {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem('app_user');
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_oauth_state');
  } catch (error) {
    console.error('Error clearing session state:', error);
  }
};
