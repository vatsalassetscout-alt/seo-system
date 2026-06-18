/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Project, CustomSubmissionType, DSREntry, AppUser, ProjectLocation } from '../types';
import {
  Plus,
  Trash2,
  Lock,
  Mail,
  ShieldCheck,
  FileSpreadsheet,
  Users,
  Settings2,
  HardDriveUpload,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  Hash,
  Database,
  UserPlus,
  Layers
} from 'lucide-react';
import { motion } from 'motion/react';

interface DSRSettingsProps {
  projects: Project[];
  adminEmails: string[];
  entries: DSREntry[];
  onAddAdminEmail: (email: string) => void;
  onDeleteAdminEmail: (email: string) => void;
  currentUserEmail: string;

  // Custom Submission Type Callbacks
  customSubmissionTypes: CustomSubmissionType[];
  onAddCustomSubmissionType: (type: CustomSubmissionType) => void;
  onDeleteCustomSubmissionType: (id: string) => void;

  // Google Sheets integration state and callbacks
  sheetSettings: {
    projectsSpreadsheetId?: string;
    logsSpreadsheetId?: string;
    spreadsheetId: string;
    projectsTab: string;
    submissionsTab: string;
    locationsTab?: string;
    isConnected: boolean;
  };
  onUpdateSheetSettings: (settings: {
    projectsSpreadsheetId: string;
    logsSpreadsheetId: string;
    spreadsheetId: string;
    projectsTab: string;
    submissionsTab: string;
    locationsTab: string;
    isConnected: boolean;
  }) => void;
  onTriggerSync: () => Promise<void>;
  isSyncing: boolean;

  // Admin access-control users callbacks
  allowedUsers: AppUser[];
  onSetAllowedUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  projectLocations: ProjectLocation[];
  onSetProjectLocations: React.Dispatch<React.SetStateAction<ProjectLocation[]>>;
  onUpdateProjects?: (updatedProjects: Project[]) => void;
}

export default function DSRSettings({
  projects,
  adminEmails,
  entries,
  onAddAdminEmail,
  onDeleteAdminEmail,
  currentUserEmail,

  customSubmissionTypes,
  onAddCustomSubmissionType,
  onDeleteCustomSubmissionType,

  sheetSettings,
  onUpdateSheetSettings,
  onTriggerSync,
  isSyncing,

  allowedUsers,
  onSetAllowedUsers,
  projectLocations,
  onSetProjectLocations,
  onUpdateProjects,
}: DSRSettingsProps) {
  // Navigation Tabs inside Settings Panel
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'admins' | 'sheets'>('users');

  // Input states
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  // Google Sheets input states
  const [localProjectsSpreadsheetId, setLocalProjectsSpreadsheetId] = useState(sheetSettings.projectsSpreadsheetId || sheetSettings.spreadsheetId || '');
  const [localLogsSpreadsheetId, setLocalLogsSpreadsheetId] = useState(sheetSettings.logsSpreadsheetId || sheetSettings.spreadsheetId || '');
  const [localProjectsTab, setLocalProjectsTab] = useState(sheetSettings.projectsTab || 'Projects_Mapping');
  const [localSubmissionsTab, setLocalSubmissionsTab] = useState(sheetSettings.submissionsTab || 'DSR_Logs');

  const handleSaveSheetSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSheetSettings({
      projectsSpreadsheetId: localProjectsSpreadsheetId.trim(),
      logsSpreadsheetId: localLogsSpreadsheetId.trim(),
      spreadsheetId: localLogsSpreadsheetId.trim(), // fallback
      projectsTab: localProjectsTab.trim() || 'Projects_Mapping',
      submissionsTab: localSubmissionsTab.trim() || 'DSR_Logs',
      locationsTab: 'Locations',
      isConnected: true
    });
    triggerAlert('success', 'Google Sheets configuration updated locally. Trigger sync to refresh entries.');
  };

  // Status Alerts
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const triggerAlert = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => {
      setStatusMsg(null);
    }, 4000);
  };

  // Human Reporter directory compilation
  const reportersDir = useMemo(() => {
    const map: Record<string, {
      email: string;
      submissionsCount: number;
      listing: number;
      blog: number;
      pdf: number;
      image: number;
      lastActive: string;
    }> = {};

    entries.forEach((entry) => {
      if (!entry || !entry.userEmail) return;
      const email = entry.userEmail.trim().toLowerCase();
      if (!map[email]) {
        map[email] = {
          email: entry.userEmail,
          submissionsCount: 0,
          listing: 0,
          blog: 0,
          pdf: 0,
          image: 0,
          lastActive: entry.date,
        };
      }

      const userRecord = map[email];
      userRecord.submissionsCount += 1;
      
      if (new Date(entry.date) > new Date(userRecord.lastActive)) {
        userRecord.lastActive = entry.date;
      }

      (entry.works || []).forEach((work) => {
        userRecord.listing += (work.listingCount || 0);
        userRecord.blog += (work.blogCount || 0);
        userRecord.pdf += (work.pdfCount || 0);
        userRecord.image += (work.imageCount || 0);
      });
    });

    return Object.values(map).sort((a, b) => b.submissionsCount - a.submissionsCount);
  }, [entries]);

  // Admin addition
  const handleAddAdminEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newAdminEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) return;
    
    if (adminEmails.includes(email)) {
      alert('Email specified is already in the administrator registry!');
      return;
    }

    onAddAdminEmail(email);
    setNewAdminEmail('');
    triggerAlert('success', 'Authorized admin email added to secure list.');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Internal Setup Tabs */}
      <div className="flex border-b border-gray-150 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs cursor-pointer transition ${
            activeSubTab === 'users'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
          }`}
        >
          <Users size={15} />
          Users
        </button>
        <button
          onClick={() => setActiveSubTab('admins')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs cursor-pointer transition ${
            activeSubTab === 'admins'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
          }`}
        >
          <Mail size={15} />
          Authorized Administrators
        </button>
        <button
          onClick={() => setActiveSubTab('sheets')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs cursor-pointer transition ${
            activeSubTab === 'sheets'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
          }`}
        >
          <FileSpreadsheet size={15} />
          Google Sheets Sync
        </button>
      </div>

      {/* Sub-Alert status notifications */}
      {statusMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs ${
            statusMsg.type === 'success'
              ? 'bg-emerald-55 text-emerald-900 border border-emerald-100'
              : 'bg-rose-50 text-rose-900 border border-rose-100'
          }`}
        >
          <span>{statusMsg.type === 'success' ? '🟢' : '🔴'}</span>
          <span>{statusMsg.text}</span>
        </motion.div>
      )}

      {/* Active settings module view */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-150 shadow-xs">
        {/* TAB 1: Users Panel (Email authorization & Location assignment) */}
        {activeSubTab === 'users' && (
          <div className="space-y-12 animate-fade-in text-left">
            
            {/* Section 1: User Identity & Registration */}
            <div className="space-y-6">
              <div className="border-b border-gray-100 pb-4">
                <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                  <Users size={16} className="text-indigo-600 animate-pulse" />
                  Employee Directory & Authorized Emails
                </h4>
                <p className="text-xs text-gray-400">
                  Assign human names to corporate emails. Authorized employees will gain DSR access. All reports in the system will display these names.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Form: Add / Edit User */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-150 h-fit">
                  <h5 className="font-bold text-gray-800 text-xs mb-4 flex items-center gap-1.5 uppercase tracking-wide">
                    <UserPlus size={14} className="text-slate-500" />
                    Authorize New User
                  </h5>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const email = newUserEmail.trim().toLowerCase();
                    const name = newUserName.trim();
                    if (!email || !name) return;

                    const exists = allowedUsers.some(u => u.email.toLowerCase() === email);
                    if (exists) {
                      onSetAllowedUsers(prev => prev.map(u => u.email.toLowerCase() === email ? { ...u, name } : u));
                      triggerAlert('success', `Updated human name for ${email} to "${name}".`);
                    } else {
                      onSetAllowedUsers(prev => [...prev, { email, name }]);
                      triggerAlert('success', `Successfully authorized employee "${name}" (${email}).`);
                    }
                    setNewUserEmail('');
                    setNewUserName('');
                  }} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-bold block uppercase">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Alex Rivera"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-bold block uppercase">Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. employee@company.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 font-mono font-semibold"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      Save & Authorize User
                    </button>
                  </form>
                </div>

                {/* Table: Registered Users */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-0.5">Logged-In System Users ({allowedUsers.length})</span>
                    <span className="text-[10px] text-gray-500 font-semibold pl-0.5">
                      Note: New users can log in using their email address and are automatically registered. You can rename or assign human names to any user by typing directly into their name field below.
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto border border-gray-150 rounded-2xl bg-white max-h-96 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-150 bg-gray-50/70 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          <th className="py-3 px-4 text-left">Employee Name</th>
                          <th className="py-3 px-4 text-left">Authorized Email</th>
                          <th className="py-3 px-4 text-center">Submissions Logged</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-105">
                        {allowedUsers.map((u) => {
                          const userSubmissions = entries.filter(e => e.userEmail?.toLowerCase() === u.email.toLowerCase()).length;
                          return (
                            <tr key={u.email} className="hover:bg-slate-50/45 transition text-xs">
                              <td className="py-2 px-4 font-extrabold text-gray-900">
                                <input
                                  type="text"
                                  value={u.name}
                                  onChange={(e) => {
                                    const nextName = e.target.value;
                                    onSetAllowedUsers(prev => prev.map(item => item.email.toLowerCase() === u.email.toLowerCase() ? { ...item, name: nextName } : item));
                                  }}
                                  className="px-2 py-1.5 border border-gray-200/50 hover:border-indigo-300 focus:border-indigo-500 rounded bg-gray-50/20 focus:bg-white text-xs font-bold w-full transition outline-none"
                                  placeholder="Assign Name..."
                                />
                              </td>
                              <td className="py-3.5 px-4 font-mono font-semibold text-gray-500">{u.email}</td>
                              <td className="py-3.5 px-4 text-center font-mono text-gray-500">{userSubmissions} DSRs</td>
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Revoke DSR system access and delete identity mapping for: ${u.name}?`)) {
                                      onSetAllowedUsers(prev => prev.filter(item => item.email.toLowerCase() !== u.email.toLowerCase()));
                                      triggerAlert('success', `Revoked access for ${u.name}`);
                                    }
                                  }}
                                  className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-500 rounded transition cursor-pointer"
                                  title="Revoke User"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>



          </div>
        )}

        {/* TAB 4: Authorized Administrators */}
        {activeSubTab === 'admins' && (
          <div className="space-y-8 animate-fade-in">
            <div className="border-b border-gray-100 pb-5">
              <h4 className="font-extrabold text-gray-900 text-sm">Privileged Admin Emails</h4>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Column: Authorized Admins List */}
              <div className="space-y-3">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-0.5">Admin Emails Directory</span>
                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto pr-1">
                  {adminEmails.map((email) => (
                    <div key={email} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 font-mono">{email}</span>
                        {email === currentUserEmail && (
                          <span className="text-[8px] font-sans font-bold bg-indigo-100 text-indigo-750 px-1.5 py-0.5 rounded-full uppercase">
                            Your account
                          </span>
                        )}
                      </div>
                      {email !== currentUserEmail && adminEmails.length > 1 && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Revoke administrator permissions for email: ${email}?`)) {
                              onDeleteAdminEmail(email);
                            }
                          }}
                          className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-500 rounded cursor-pointer transition"
                          title="Revoke Admin Access privileges"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Invite Form */}
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-150 flex flex-col justify-between">
                <form onSubmit={handleAddAdminEmail} className="space-y-4">
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Register Authorized Admin</span>
                  
                  <div className="space-y-1.5">
                    <label htmlFor="admin-sub-email" className="text-[10px] text-gray-500 font-bold block uppercase">Email Address</label>
                    <input
                      id="admin-sub-email"
                      type="email"
                      required
                      placeholder="account@company.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 font-mono font-semibold"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <Plus size={13} /> Elevate Email to Admin
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: Google Sheets Sync Configurations */}
        {activeSubTab === 'sheets' && (
          <div className="space-y-8 animate-fade-in mb-8">
            <div className="border-b border-gray-100 pb-5">
              <h4 className="font-extrabold text-gray-900 text-sm">Two-Sheet Google Workspace Database Mapping</h4>
              <p className="text-xs text-gray-500 mt-1">
                Configure separate spreadsheets for Project Directories and Submission Logs belonging to your workspace.
              </p>
            </div>

            <form onSubmit={handleSaveSheetSettings} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column: Projects Directory Sheet */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                      <Layers size={16} />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-gray-800 uppercase tracking-wide">1. Projects Directory Sheet</h5>
                      <p className="text-[10px] text-gray-400">Maps domains, locations, regions & assignees</p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-bold block uppercase">Spreadsheet Link or ID</label>
                      <input
                        type="text"
                        required
                        placeholder="https://docs.google.com/spreadsheets/d/... or raw-id"
                        value={localProjectsSpreadsheetId}
                        onChange={(e) => setLocalProjectsSpreadsheetId(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 focus:bg-white rounded text-xs focus:ring-1 focus:ring-indigo-500 font-mono font-medium text-gray-950"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-bold block uppercase">Sheet Tab Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Projects_Mapping"
                        value={localProjectsTab}
                        onChange={(e) => setLocalProjectsTab(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 focus:bg-white rounded text-xs focus:ring-1 focus:ring-indigo-500 font-mono font-medium text-gray-950"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-indigo-50/20 p-3.5 rounded-xl border border-indigo-100 text-[10px] text-indigo-850 leading-relaxed">
                    <span className="font-bold">Recognized Headers:</span> ID, Domain, Project Name, Project Code, Location, Region, Assigned Users, Description.
                  </div>
                </div>

                {/* Right Column: submissions log db */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                      <Database size={16} />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-gray-800 uppercase tracking-wide">2. Central Logs Database Sheet</h5>
                      <p className="text-[10px] text-gray-400">Stores historical daily reporting (DSR) logs</p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-bold block uppercase">Spreadsheet Link or ID</label>
                      <input
                        type="text"
                        required
                        placeholder="https://docs.google.com/spreadsheets/d/... or raw-id"
                        value={localLogsSpreadsheetId}
                        onChange={(e) => setLocalLogsSpreadsheetId(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 focus:bg-white rounded text-xs focus:ring-1 focus:ring-indigo-500 font-mono font-medium text-gray-950"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 font-bold block uppercase">Sheet Tab Name</label>
                      <input
                        type="text"
                        required
                        placeholder="DSR_Logs"
                        value={localSubmissionsTab}
                        onChange={(e) => setLocalSubmissionsTab(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 focus:bg-white rounded text-xs focus:ring-1 focus:ring-indigo-500 font-mono font-medium text-gray-950"
                      />
                    </div>
                  </div>

                  <div className="bg-emerald-50/20 p-3.5 rounded-xl border border-emerald-100 text-[10px] text-emerald-800 leading-relaxed">
                    <span className="font-bold">Logs Structure:</span> Submissions will append to this sheet. If empty, the system automatically initializes columns on first sync.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${sheetSettings.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                  <span className="text-[11px] font-bold text-gray-600">
                    {sheetSettings.isConnected 
                      ? 'Secure Connection Live' 
                      : 'Not Synced Yet'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    Save & Apply Configurations
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await onTriggerSync();
                        triggerAlert('success', 'Google Sheets synchronization completed successfully!');
                      } catch (err: any) {
                        triggerAlert('error', `Sync failed: ${err.message || String(err)}`);
                      }
                    }}
                    disabled={isSyncing}
                    className="px-6 py-2.5 bg-gray-950 text-white hover:bg-black font-bold text-xs rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer select-none transition"
                  >
                    <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Synchronizing...' : 'Sync Now'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
