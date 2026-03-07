'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface V2ContextType {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
}

const V2Context = createContext<V2ContextType>({ darkMode: true, setDarkMode: () => {} });

export function V2Provider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(true);
  return (
    <V2Context.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </V2Context.Provider>
  );
}

export function useV2() {
  return useContext(V2Context);
}
