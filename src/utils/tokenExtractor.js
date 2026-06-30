/**
 * Recursively search an object for common token keys
 * @param {any} obj - The object to search
 * @param {number} depth - Recursion depth limit to avoid stack overflow
 * @returns {string|null} - The token string if found, otherwise null
 */
export const findTokenInObject = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 5) return null;

  // List of common keys that might hold a token
  const keysToCheck = [
    'token', 
    'accessToken', 
    'access_token', 
    'jwt', 
    'idToken', 
    'id_token', 
    'sessionToken', 
    'session_token', 
    'bearer', 
    'authToken',
    'auth_token'
  ];

  // 1. Check direct keys first
  for (const key of keysToCheck) {
    if (obj[key] && typeof obj[key] === 'string' && obj[key].trim().length > 10) {
      return obj[key].trim();
    }
  }

  // 2. Check direct keys with case-insensitive matches or partial matches if not found
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('token') || lowerKey === 'jwt') {
      if (typeof obj[key] === 'string' && obj[key].trim().length > 10) {
        return obj[key].trim();
      }
    }
  }

  // 3. Recurse into nested objects
  for (const key of Object.keys(obj)) {
    if (obj[key] && typeof obj[key] === 'object') {
      const nestedToken = findTokenInObject(obj[key], depth + 1);
      if (nestedToken) return nestedToken;
    }
  }

  return null;
};
