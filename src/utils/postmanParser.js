/**
 * Postman Collection Parser
 * Recursively parses Postman collections and extracts API requests
 */

export const parsePostmanCollection = (collectionData) => {
  const apis = [];

  const extractHeaders = (headerArray) => {
    const headers = {};
    if (Array.isArray(headerArray)) {
      headerArray.forEach((header) => {
        if (header.key && header.value && !header.disabled) {
          headers[header.key] = header.value;
        }
      });
    }
    return headers;
  };

  const extractAuth = (authData) => {
    if (!authData) {
      return { type: 'none', token: '' };
    }

    const auth = { type: authData.type || 'none', token: '' };

    if (authData.type === 'bearer' && authData.bearer) {
      const tokenObj = authData.bearer.find((t) => t.key === 'token');
      if (tokenObj) {
        auth.token = tokenObj.value;
      }
    } else if (authData.type === 'basic' && authData.basic) {
      const usernameObj = authData.basic.find((b) => b.key === 'username');
      const passwordObj = authData.basic.find((b) => b.key === 'password');
      if (usernameObj && passwordObj) {
        auth.token = btoa(`${usernameObj.value}:${passwordObj.value}`);
      }
    } else if (authData.type === 'apikey' && authData.apikey) {
      const keyObj = authData.apikey.find((a) => a.key === 'key');
      if (keyObj) {
        auth.token = keyObj.value;
      }
    }

    return auth;
  };

  const extractUrl = (urlData) => {
    if (typeof urlData === 'string') {
      return urlData;
    }

    if (urlData && typeof urlData === 'object') {
      if (urlData.raw) {
        return urlData.raw;
      }

      const protocol = urlData.protocol || 'http';
      const host = Array.isArray(urlData.host) ? urlData.host.join('.') : urlData.host || '';
      const port = urlData.port ? `:${urlData.port}` : '';
      const path = Array.isArray(urlData.path) ? `/${urlData.path.join('/')}` : urlData.path || '';

      let query = '';
      if (Array.isArray(urlData.query)) {
        const queryParams = urlData.query
          .filter((q) => !q.disabled)
          .map((q) => `${q.key}=${q.value}`)
          .join('&');
        if (queryParams) {
          query = `?${queryParams}`;
        }
      }

      return `${protocol}://${host}${port}${path}${query}`;
    }

    return '';
  };

  const extractEndpoint = (urlData) => {
    if (typeof urlData === 'string') {
      try {
        const url = new URL(urlData);
        let path = url.pathname;
        if (url.search) {
          path += url.search;
        }
        return path || '/';
      } catch {
        return urlData;
      }
    }

    if (urlData && typeof urlData === 'object') {
      const path = Array.isArray(urlData.path) ? `/${urlData.path.join('/')}` : urlData.path || '/';
      let query = '';
      if (Array.isArray(urlData.query)) {
        const queryParams = urlData.query
          .filter((q) => !q.disabled)
          .map((q) => `${q.key}=${q.value}`)
          .join('&');
        if (queryParams) {
          query = `?${queryParams}`;
        }
      }
      return `${path}${query}`;
    }

    return '/';
  };

  const extractParams = (urlData) => {
    const params = {};
    if (urlData && typeof urlData === 'object' && Array.isArray(urlData.query)) {
      urlData.query.forEach((query) => {
        if (!query.disabled && query.key) {
          params[query.key] = query.value || '';
        }
      });
    }
    return params;
  };

  const extractBody = (bodyData) => {
    if (!bodyData) {
      return '';
    }

    if (bodyData.mode === 'raw' && bodyData.raw) {
      return bodyData.raw;
    }

    if (bodyData.mode === 'formdata' && Array.isArray(bodyData.formdata)) {
      // Build FormData string format for URL encoding
      const formDataParts = [];
      bodyData.formdata.forEach((item) => {
        if (!item.disabled && item.key) {
          const encodedKey = encodeURIComponent(item.key);
          const encodedValue = encodeURIComponent(item.value || '');
          formDataParts.push(`${encodedKey}=${encodedValue}`);
        }
      });
      return formDataParts.join('&');
    }

    if (bodyData.mode === 'urlencoded' && Array.isArray(bodyData.urlencoded)) {
      // Build URL-encoded string format
      const encodedParts = [];
      bodyData.urlencoded.forEach((item) => {
        if (!item.disabled && item.key) {
          const encodedKey = encodeURIComponent(item.key);
          const encodedValue = encodeURIComponent(item.value || '');
          encodedParts.push(`${encodedKey}=${encodedValue}`);
        }
      });
      return encodedParts.join('&');
    }

    return '';
  };

  const parseItems = (items, depth = 0, parentName = '') => {
    if (!Array.isArray(items)) {
      return;
    }

    items.forEach((item) => {
      if (!item) {
        return;
      }

      // Check if this is a folder (has nested items but no request)
      if (item.item && Array.isArray(item.item) && !item.request) {
        // Recursively process folder items
        parseItems(item.item, depth + 1, item.name);
      } else if (item.request) {
        // This is an actual request
        const request = item.request;
        const fullName = parentName ? `${parentName} / ${item.name}` : item.name;

        const url = extractUrl(request.url);
        const headers = extractHeaders(request.header);

        // Extract server URL and endpoint
        let serverUrl = 'http://localhost:3000';
        let endpoint = '/';

        if (url) {
          try {
            const urlObj = new URL(url);
            serverUrl = `${urlObj.protocol}//${urlObj.host}`;
            endpoint = extractEndpoint(request.url);
          } catch {
            endpoint = extractEndpoint(request.url);
          }
        }

        const api = {
          id: Math.random().toString(36).substr(2, 9),
          name: fullName || 'Untitled',
          method: request.method || 'GET',
          endpoint,
          headers,
          params: extractParams(request.url),
          body: extractBody(request.body),
          auth: extractAuth(request.auth),
          serverUrl,
          fullUrl: url,
        };

        apis.push(api);
      }
    });
  };

  // Start parsing from top-level items
  if (collectionData.item) {
    parseItems(collectionData.item);
  }

  return apis;
};

export default parsePostmanCollection;
