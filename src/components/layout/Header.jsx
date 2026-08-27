import React from 'react';
import { Stethoscope, LayoutDashboard, Users, Pill, BarChart3, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';

export default function Header({ activeTab, onNavigate }) {
  return (
    <header className="bg-indigo-600 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Stethoscope className="w-6 h-6" />
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
          <button
            onClick={() => onNavigate('reports')}
            className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${activeTab === 'reports' ? 'bg-indigo-600 shadow-sm' : 'hover:bg-indigo-600/50 text-indigo-100'}`}
          >
            <BarChart3 className="w-4 h-4" /> Raporlar
          </button>

          <button
            onClick={() => signOut(auth)}
            title="Sistemden Çıkış Yap"
            className="px-3 py-2 rounded-md font-medium transition-colors flex items-center hover:bg-rose-500 hover:text-white text-indigo-200 ml-1 border border-transparent hover:border-rose-400 group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline ml-1 text-sm">Çıkış</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
