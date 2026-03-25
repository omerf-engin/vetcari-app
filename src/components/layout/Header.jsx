import React from 'react';
import { TrendingUp, LayoutDashboard, Users, Pill } from 'lucide-react';

export default function Header({ activeTab, onNavigate }) {
  return (
    <header className="bg-indigo-600 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">VetCari Akıllı Defter</h1>
        </div>
        <nav className="flex space-x-1 bg-indigo-700/50 p-1 rounded-lg">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-indigo-600 shadow-sm' : 'hover:bg-indigo-600/50 text-indigo-100'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Ana Sayfa
          </button>
          <button
            onClick={() => onNavigate('customers')}
            className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${activeTab === 'customers' || activeTab === 'customerDetail' ? 'bg-indigo-600 shadow-sm' : 'hover:bg-indigo-600/50 text-indigo-100'}`}
          >
            <Users className="w-4 h-4" /> Müşteriler
          </button>
          <button
            onClick={() => onNavigate('drugs')}
            className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${activeTab === 'drugs' ? 'bg-indigo-600 shadow-sm' : 'hover:bg-indigo-600/50 text-indigo-100'}`}
          >
            <Pill className="w-4 h-4" /> İlaçlar & Fiyatlar
          </button>
        </nav>
      </div>
    </header>
  );
}
