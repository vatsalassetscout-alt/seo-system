/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  Layers,
  Check,
  Copy,
  AlertTriangle,
  ExternalLink
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
  alerts?: any[];
  onAddAlert?: (alert: any) => void;
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
  alerts = [],
  onAddAlert = () => {},
}: DSRSettingsProps) {
  // Navigation Tabs inside Settings Panel
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'assignments'>('users');

  // Input states
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [serviceAccountConfigured, setServiceAccountConfigured] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    fetch('/api/config-status')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Failed to load credentials detail');
      })
      .then(data => {
        if (data && data.serviceAccountEmail) {
          setServiceAccountEmail(data.serviceAccountEmail);
          setServiceAccountConfigured(data.serviceAccountConfigured);
        }
      })
      .catch(err => console.error("Could not fetch service account detail:", err));
  }, []);

  const handleCopyEmail = () => {
    if (!serviceAccountEmail) return;
    navigator.clipboard.writeText(serviceAccountEmail)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      });
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
          onClick={() => setActiveSubTab('assignments')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs cursor-pointer transition ${
            activeSubTab === 'assignments'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
          }`}
        >
          <Lock size={15} />
          Assign Project
        </button>
      </div>

      {serviceAccountEmail && (
        <div className="bg-slate-50 border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5 text-left">
            <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
              🟢 Google Sheets Active Backend Integration
            </h4>
            <p className="text-[11px] text-gray-500">
              The application automatically syncs and persists database logs to Google Sheets. Share your spreadsheet with this Service Account:
            </p>
            <span className="font-mono text-[10px] text-indigo-600 block mt-1 font-bold select-all bg-white px-2 py-1 rounded inline-block border border-gray-150">
              {serviceAccountEmail}
            </span>
          </div>
          <button
            onClick={handleCopyEmail}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-indigo-600 hover:text-indigo-800 border border-gray-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer w-fit shrink-0 shadow-3xs"
          >
            {isCopied ? <span className="text-emerald-600 font-bold">Copied Email!</span> : <>Copy Service Email</>}
          </button>
        </div>
      )}

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
                  Employee Directory & User IDs
                </h4>
                <p className="text-xs text-gray-400">
                  Assign human names to User IDs. Authorized employees will gain Work Log access. All reports in the system will display these names.
                </p>
              </div>

              <div className="space-y-4">
                
                {/* Table: Registered Users */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    {(() => {
                      const isUserAdmin = (email: string): boolean => {
                        if (!email) return false;
                        const emailLower = email.trim().toLowerCase();
                        if (emailLower === '8888' || emailLower.includes("admin")) return true;
                        if (adminEmails && adminEmails.some(adm => adm.toLowerCase() === emailLower)) return true;
                        const hardcodedAdmins = ['vatsalpatelwork20@gmail.com', 'assetscout007rohan@gmail.com'];
                        if (hardcodedAdmins.some(adm => adm.toLowerCase() === emailLower)) return true;
                        return false;
                      };
                      const activeUsers = allowedUsers.filter(u => !isUserAdmin(u.email));
                      return (
                        <>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-0.5">Logged-In System Users ({activeUsers.length})</span>
                          <span className="text-[10px] text-gray-500 font-semibold pl-0.5">
                            Note: Only authorized users registered here are allowed to log into the system. You can update names or revoke access at any time.
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  
                  <div className="overflow-x-auto border border-gray-150 rounded-2xl bg-white max-h-96 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-150 bg-gray-50/70 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          <th className="py-3 px-4 text-left">Employee Name</th>
                          <th className="py-3 px-4 text-left">User ID</th>
                          <th className="py-3 px-4 text-center">Last Logged In</th>
                          <th className="py-3 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-105">
                        {(() => {
                          const isUserAdmin = (email: string): boolean => {
                            if (!email) return false;
                            const emailLower = email.trim().toLowerCase();
                            if (emailLower === '8888' || emailLower.includes("admin")) return true;
                            if (adminEmails && adminEmails.some(adm => adm.toLowerCase() === emailLower)) return true;
                            const hardcodedAdmins = ['vatsalpatelwork20@gmail.com', 'assetscout007rohan@gmail.com'];
                            if (hardcodedAdmins.some(adm => adm.toLowerCase() === emailLower)) return true;
                            return false;
                          };
                          return allowedUsers.filter(u => !isUserAdmin(u.email)).map((u) => {
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
                                <td className="py-3.5 px-4 text-center font-mono text-xs font-semibold text-gray-500">{u.lastLoggedIn || 'Never'}</td>
                                <td className="py-3.5 px-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Revoke Work Log system access and delete identity mapping for: ${u.name}?`)) {
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
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>



          </div>
        )}





        {/* TAB 4: Assign Projects Panel */}
        {activeSubTab === 'assignments' && (
          <div className="space-y-8 animate-fade-in text-left">
            <div className="border-b border-gray-100 pb-4">
              <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                <Lock size={16} className="text-indigo-600" />
                Assign Work Domain to Reporter
              </h4>
              <p className="text-xs text-gray-450">
                Create a targeted alert requesting an employee to fill task logs on a specific project for a selected date. The notification remains sticky until they submit!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Form: Assign Project */}
              <div className="md:col-span-1 bg-slate-50/50 p-6 rounded-2xl border border-gray-150 h-fit space-y-4">
                <h5 className="font-bold text-gray-800 text-xs uppercase tracking-wide">
                  Create Assignment
                </h5>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    const email = formData.get('userEmail') as string;
                    const projectId = formData.get('projectId') as string;
                    const date = formData.get('date') as string;
                    const customMsg = formData.get('message') as string;

                    if (!email || !projectId || !date) {
                      triggerAlert('error', 'Please fill in all layout fields to continue.');
                      return;
                    }

                    const matchedProj = projects.find(p => p.id === projectId);
                    const payload = {
                      id: `assign-${Date.now()}`,
                      alertType: 'project_assignment',
                      userEmail: email.trim().toLowerCase(),
                      projectId: projectId,
                      projectDomain: matchedProj?.domain || matchedProj?.name || '',
                      projectName: matchedProj?.name || '',
                      date: date,
                      message: customMsg || `Admin has requested that you submit a Work Log for ${matchedProj?.name || 'domain'} for the reporting date of ${date}.`,
                      adminEmail: currentUserEmail,
                      createdAt: new Date().toISOString(),
                      read: false
                    };

                    onAddAlert(payload);
                    triggerAlert('success', `Direct task request dispatched for ${email} on date ${date}!`);
                    form.reset();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold block uppercase">Reporter Email</label>
                    <select
                      name="userEmail"
                      required
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 text-gray-900 focus:outline-none"
                    >
                      <option value="">- Select Human Reporter -</option>
                      {allowedUsers.map(u => (
                        <option key={u.email} value={u.email}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold block uppercase">Project Domain</label>
                    <select
                      name="projectId"
                      required
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 text-gray-900 focus:outline-none"
                    >
                      <option value="">- Select Active Project -</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.domain || 'no domain'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold block uppercase">Target Date</label>
                    <input
                      type="date"
                      name="date"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 text-gray-900 font-mono focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold block uppercase">Custom Notes</label>
                    <textarea
                      name="message"
                      rows={3}
                      placeholder="e.g. Please check SEO backlinks and indexation status"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 text-gray-900 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    Send Assignment Task
                  </button>
                </form>
              </div>

              {/* Assignments History & Status Tracker Table */}
              <div className="md:col-span-2 space-y-4">
                <h5 className="font-bold text-gray-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                  🛡️ Active Task Assignments Board
                </h5>
                <div className="bg-white border border-gray-150 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50/70 border-b border-gray-150 font-bold text-gray-500 text-[10px] uppercase">
                        <tr>
                          <th className="px-4 py-3">Reporter</th>
                          <th className="px-4 py-3">Project Domain</th>
                          <th className="px-4 py-3">Target Date</th>
                          <th className="px-4 py-3">Logged?</th>
                          <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
                          const assignmentAlertsList = (alerts || []).filter(a => a.alertType === 'project_assignment');
                          if (assignmentAlertsList.length === 0) {
                            return (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">
                                  No direct assignments have been registered yet.
                                </td>
                              </tr>
                            );
                          }

                          return assignmentAlertsList.map((asg) => {
                            // Check if logged matching user email, target date and project id
                            const isFulfilled = (entries || []).some(entry => {
                              const matchesUser = (entry.userEmail || '').trim().toLowerCase() === (asg.userEmail || '').trim().toLowerCase();
                              const matchesDate = entry.date === asg.date;
                              const hasProj = (entry.works || []).some(w => String(w.projectId) === String(asg.projectId));
                              return matchesUser && matchesDate && hasProj;
                            });

                            const userRecord = allowedUsers.find(u => u.email.toLowerCase() === asg.userEmail.toLowerCase());

                            return (
                              <tr key={asg.id} className="hover:bg-slate-50/40">
                                <td className="px-4 py-3.5">
                                  <div className="font-bold text-gray-900">{userRecord?.name || asg.userEmail}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">{asg.userEmail}</div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="font-bold text-gray-800">{asg.projectName || 'Project'}</div>
                                  <div className="text-[10px] font-mono text-indigo-600 font-bold">{asg.projectDomain}</div>
                                </td>
                                <td className="px-4 py-3.5 font-mono text-gray-600 font-semibold">
                                  {asg.date}
                                </td>
                                <td className="px-4 py-3.5">
                                  {isFulfilled ? (
                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100">
                                      🟢 Yes, Filled
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-100">
                                      🚨 Pending
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  {isFulfilled ? (
                                    <span className="text-[10px] font-black text-emerald-600 tracking-wider">COMPLETED</span>
                                  ) : (
                                    <span className="text-[10px] font-black text-amber-600 animate-pulse tracking-wider">ACTIVE BANNER</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}



      </div>
    </div>
  );
}
