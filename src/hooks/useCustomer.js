import { useContext } from 'react';
import { CustomerContext } from '../contexts/CustomerContext';

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) throw new Error('useCustomer must be used within CustomerProvider');
  return context;
}
