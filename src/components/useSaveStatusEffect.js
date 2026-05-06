import { useEffect } from 'react';

export const useSaveStatusEffect = (saveStatus, setSaveStatus) => {
  useEffect(() => {
    if (saveStatus) {
      const timeoutId = setTimeout(() => setSaveStatus(''), 2500);
      return () => clearTimeout(timeoutId);
    }
  }, [saveStatus, setSaveStatus]);
};
