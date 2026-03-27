import React, { createContext } from 'react';

// eslint-disable-next-line react-refresh/only-export-components
export const CustomerContext = createContext(null);

export function CustomerProvider({ value, children }) {
  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
}
