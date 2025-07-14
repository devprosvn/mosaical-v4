import { createStore } from 'solid-js/store';

export interface UserSettings {
  nickname: string;
  theme: 'dark' | 'light' | 'system';
  fontSize: 'sm' | 'md' | 'lg';
  notificationLevel: 'all' | 'errors' | 'silent';
  autoConnect: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  nickname: '',
  theme: 'dark',
  fontSize: 'md',
  notificationLevel: 'all',
  autoConnect: true,
};

// Simple persistent store helper
function createPersistentStore<T extends object>(key: string, init: T) {
  const stored = localStorage.getItem(key);
  const initial = stored ? { ...init, ...JSON.parse(stored) } : init;
  const [state, setState] = createStore<T>(initial as T);
  // Persist on change
  //@ts-ignore
  window.__persistedStores = window.__persistedStores || {};
  if (!(window.__persistedStores as any)[key]) {
    (window.__persistedStores as any)[key] = true;
    import('solid-js').then(({ createEffect }) => {
      createEffect(() => {
        localStorage.setItem(key, JSON.stringify(state));
      });
    });
  }
  return [state, setState] as const;
}

declare global {
  interface Window { __persistedStores?: Record<string, boolean>; }
}

export const [userSettings, setUserSettings] = createPersistentStore<UserSettings>('mosaical_settings', DEFAULT_SETTINGS); 