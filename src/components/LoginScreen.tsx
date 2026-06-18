/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileSpreadsheet, Sparkles, KeyRound, ShieldAlert, ArrowRight, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { AppUser } from '../types';

interface LoginScreenProps {
  onLogin: (email: string, role: 'user' | 'admin') => void;
  adminEmails: string[];
  allowedUsers?: AppUser[];
  onGoogleSignIn?: () => Promise<void>;
  isLoggingIn?: boolean;
  loginError?: string | null;
}

export default function LoginScreen({
  onLogin,
  adminEmails,
  allowedUsers = [],
  onGoogleSignIn,
  isLoggingIn = false,
  loginError = null,
}: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  const [emailInput, setEmailInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const email = emailInput.trim().toLowerCase();
    
    // Simple robust email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setErrorMsg('Please enter a valid business email address (e.g., mail@company.com).');
      return;
    }

    // Determine the lowercase list of admin emails on the fly
    const adminsLower = adminEmails.map(a => a.toLowerCase());

    // Determine the lowercase list of allowed user emails on the fly
    const usersLower = allowedUsers.map(u => u.email.toLowerCase());

    if (activeTab === 'admin') {
      const isAdmin = adminsLower.includes(email);
      if (!isAdmin) {
        if (usersLower.includes(email)) {
          setErrorMsg('This is a Reporter/User email. Please login using the User Portal tab.');
        } else {
          setErrorMsg('Access Denied: This email is not registered as an Administrator.');
        }
        return;
      }
    } else {
      // activeTab === 'user'
      const isUser = usersLower.includes(email);
      if (!isUser) {
        if (adminsLower.includes(email)) {
          setErrorMsg('This is an Administrator email. Please login using the Admin Panel tab.');
        } else {
          setErrorMsg('Access Denied: This email is not in the allowed user list. Please contact your system administrator.');
        }
        return;
      }
    }

    onLogin(email, activeTab);
  };

  const activeError = errorMsg || loginError;

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Brand Banner */}
        <div className="text-center pb-2">
          <img 
            src="https://assetscout.in/assets/images/Assetscout%20Logo%20Black.webp" 
            alt="Assetscout Logo" 
            className="h-10 sm:h-12 w-auto object-contain block mx-auto"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Main login card */}
        <div className="bg-white p-8 rounded-3xl border border-gray-150 shadow-md space-y-6 relative overflow-hidden">
          <div className="space-y-1.5 text-center">
            <h2 className="text-base font-bold text-gray-900 font-sans">Authenticate session</h2>
            <p className="text-xs text-gray-500">Sign in with email. Choose your access portal below.</p>
          </div>

          {/* Tab Control */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl border border-gray-150">
            <button
              type="button"
              onClick={() => {
                setActiveTab('user');
                setEmailInput('');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'user'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <UserCheck size={14} className={activeTab === 'user' ? 'text-indigo-600' : ''} />
              User Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setEmailInput('');
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <KeyRound size={14} className={activeTab === 'admin' ? 'text-indigo-600' : ''} />
              Admin Panel
            </button>
          </div>

          {activeError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold leading-relaxed">
              {activeError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {activeTab === 'admin' ? 'Administrator Email' : 'Reporter / User Email'}
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoFocus
                placeholder={activeTab === 'admin' ? 'e.g. admin@company.com' : 'e.g. employee@company.com'}
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-indigo-600 rounded-xl text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-650 transition text-sm sm:text-xs"
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="w-full px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              Enter {activeTab === 'admin' ? 'Administrator Workspace' : 'User Portal'}
              <ArrowRight size={13} />
            </button>
          </form>

        </div>

        {/* Security / Sheets info indicator footer */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-gray-400 font-semibold font-mono">
          <span className="flex items-center gap-1">
            <ShieldAlert size={12} /> Sandbox active
          </span>
          <span>•</span>
          <span>Sheets layout configured</span>
        </div>
      </motion.div>
    </div>
  );
}
