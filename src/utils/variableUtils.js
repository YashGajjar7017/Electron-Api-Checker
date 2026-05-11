export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const hex = [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16));
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
};

export const applyTemplateVariables = (template = '', context = {}) => {
  if (typeof template !== 'string') {
    return template;
  }

  return template.replace(/{{\s*(baseUrl|token|timestamp|uuid|randomInt)\s*}}/gi, (match, variable) => {
    switch (variable.toLowerCase()) {
      case 'baseurl':
        return context.baseUrl || '';
      case 'token':
        return context.token || '';
      case 'timestamp':
        return context.timestamp || `${Date.now()}`;
      case 'uuid':
        return context.uuid || generateUUID();
      case 'randomint':
        return String(Math.floor(Math.random() * (context.randomIntMax || 1000000)));
      default:
        return match;
    }
  });
};
