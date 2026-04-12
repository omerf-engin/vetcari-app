import React, { useState } from 'react';
import { Stethoscope, Mail, KeyRound } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { version } from '../../../package.json';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      setError('E-posta veya şifre hatalı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col items-center p-8 border-t-8 border-t-indigo-600">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 mb-4 shadow-sm">
          <Stethoscope className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight text-center">VetCari Akıllı Defter</h1>
        <p className="text-sm text-slate-500 mb-8 text-center mt-2">Finansal dökümlerinizi güvenle saklayın.</p>
        
        {error && (
          <div className="w-full bg-red-50 text-red-600 border border-red-200 text-sm p-4 rounded-xl mb-6 font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1.5 ml-1">E-posta Adresi</label>
            <div className="relative">
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 pl-11 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800" 
                placeholder="ornek@vetcari.com" 
              />
              <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1.5 ml-1">Şifre</label>
            <div className="relative">
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 pl-11 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium text-slate-800" 
                placeholder="••••••••" 
              />
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-75 flex justify-center items-center mt-2"
          >
            {loading ? (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : 'Sisteme Giriş Yap'}
          </button>
        </form>
      </div>
      <div className="fixed bottom-6 text-xs text-slate-400 font-medium">{`VetCari Akıllı Defter v${version}`}</div>
    </div>
  );
}
