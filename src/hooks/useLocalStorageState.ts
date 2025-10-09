import { useEffect, useRef, useState } from 'react';

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // lazy init (runs once)
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue; // SSR guard
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  // avoid writing immediately on first render if value came from storage
  const first = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Skip the very first effect if state is unchanged from init
      if (first.current) {
        first.current = false;
      }
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage might be full/blocked; fail quietly
    }
  }, [key, state]);

  return [state, setState];
}
