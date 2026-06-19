/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Project, DSREntry, ProjectWork, CustomSubmissionType, AppUser, ProjectLocation } from './types';
import {
  DEFAULT_PROJECTS,
  INITIAL_DSR_ENTRIES,
  ADMIN_EMAILS,
  DEFAULT_ALLOWED_USERS,
} from './data';
import DSRForm from './components/DSRForm';
import DSRLogs from './components/DSRLogs';
import DSRDashboard from './components/DSRDashboard';
import DSRSettings from './components/DSRSettings';
import LoginScreen from './components/LoginScreen';
import { initAuth, googleSignIn, getAccessToken, logout } from './lib/firebase';
import { getUserDisplayName } from './lib/userUtils';
import {
  fetchProjectsFromSheet,
  fetchSubmissionsFromSheet,
  appendSubmissionsToSheet,
  fetchLocationsFromSheet
} from './lib/sheetsService';
import {
  LayoutGrid,
  PenTool,
  Database,
  Sliders,
  Shield,
  User,
  LogOut,
  FileSpreadsheet,
  Building2,
  HardDriveUpload,
  UserCheck,
  Bell,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Global States (synchronized with localStorage)
  const [adminEmails, setAdminEmails] = useState<string[]>(() => {
    const saved = localStorage.getItem('dsr_admin_emails');
    const savedList: string[] = saved ? JSON.parse(saved) : [];
    // Merge hardcoded ADMIN_EMAILS to always keep new configurations accessible
    const merged = Array.from(new Set([...savedList, ...ADMIN_EMAILS]));
    return merged;
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('dsr_projects');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_PROJECTS;
    if (Array.isArray(parsed)) {
      return parsed.filter((p: any) => p && p.id !== "titan-realestate" && p.id !== "aerospace-craft" && p.id !== "clean-energy");
    }
    return [];
  });

  const [allowedUsers, setAllowedUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem('dsr_allowed_users');
    const savedList: AppUser[] = saved ? JSON.parse(saved) : [];
    
    // Convert hardcoded defaults
    const defaultUsers: AppUser[] = DEFAULT_ALLOWED_USERS.map((email) => ({
      email,
      name: email.includes('@') ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : email
    }));

    // Merge by unique email key
    const uniqueMap = new Map<string, AppUser>();
    [...defaultUsers, ...savedList].forEach(user => {
      uniqueMap.set(user.email.toLowerCase().trim(), user);
    });
    
    return Array.from(uniqueMap.values());
  });

  const [projectLocations, setProjectLocations] = useState<ProjectLocation[]>(() => {
    const saved = localStorage.getItem('dsr_project_locations');
    return saved ? JSON.parse(saved) : [];
  });

  const [customSubmissionTypes, setCustomSubmissionTypes] = useState<CustomSubmissionType[]>(() => {
    const saved = localStorage.getItem('dsr_custom_submission_types');
    return saved ? JSON.parse(saved) : [];
  });

  const [sheetSettings, setSheetSettings] = useState(() => {
    const saved = localStorage.getItem('dsr_sheet_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          projectsSpreadsheetId: parsed.projectsSpreadsheetId || parsed.spreadsheetId || '',
          logsSpreadsheetId: parsed.logsSpreadsheetId || parsed.spreadsheetId || '',
          spreadsheetId: parsed.spreadsheetId || '',
          projectsTab: parsed.projectsTab || 'Projects_Mapping',
          submissionsTab: parsed.submissionsTab || 'DSR_Logs',
          locationsTab: parsed.locationsTab || 'Locations',
          isConnected: !!parsed.isConnected
        };
      } catch (e) {
        // ignore fallback
      }
    }
    return {
      projectsSpreadsheetId: '',
      logsSpreadsheetId: '',
      spreadsheetId: '',
      projectsTab: 'Projects_Mapping',
      submissionsTab: 'DSR_Logs',
      locationsTab: 'Locations',
      isConnected: false
    };
  });

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginValidationError, setLoginValidationError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [alerts, setAlerts] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('dsr_admin_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showNotifications, setShowNotifications] = useState(false);
  const [assignmentPreFill, setAssignmentPreFill] = useState<{ projectId: string; date: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('dsr_admin_alerts', JSON.stringify(alerts));
  }, [alerts]);

  const handleAddAlert = (alert: any) => {
    setAlerts(prev => [alert, ...prev]);
    fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alert })
    }).catch(err => console.warn("Failed syncing new alert to backend fallback:", err));
  };

  const handleMarkAllAlertsAsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
    fetch("/api/alerts/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true })
    }).catch(err => console.warn("Failed marking all alerts as read on backend:", err));
  };

  const handleClearAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    fetch("/api/alerts/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    }).catch(err => console.warn("Failed deleting alert on backend:", err));
  };

  const [entries, setEntries] = useState<DSREntry[]>(() => {
    const saved = localStorage.getItem('dsr_entries');
    if (!saved) return INITIAL_DSR_ENTRIES;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const migrated = parsed.map((entry: any) => {
          // If already format-compliant, return as is
          if (entry && entry.userEmail && Array.isArray(entry.works)) {
            return entry as DSREntry;
          }

          // Convert a legacy entry to the modern multi-work layout
          const userEmail = entry?.userEmail || entry?.employeeEmail || (entry?.employeeName ? `${entry.employeeName.toLowerCase().replace(/\s+/g, '.')}@company.com` : 'user@company.com');
          
          let works = entry?.works;
          if (!Array.isArray(works)) {
            works = [
              {
                id: `work-legacy-${entry?.id || Date.now()}`,
                projectId: entry?.projectId || 'proj-1',
                projectName: entry?.projectName || 'Phoenix Redesign',
                listingCount: typeof entry?.metric1 === 'number' ? entry.metric1 : (typeof entry?.metric2 === 'number' ? entry.metric2 : 100),
                blog: entry?.notes || entry?.blog || 'Completed legacy task activities logged dynamically.',
                customValues: entry?.customValues || {},
              }
            ];
          }

          return {
            id: entry?.id || `dsr-legacy-${Date.now()}-${Math.random()}`,
            date: entry?.date || new Date().toISOString().split('T')[0],
            userEmail,
            works,
            createdAt: entry?.createdAt || new Date().toISOString(),
          } as DSREntry;
        });

        // Filter out any works and logs that refer to dummy hardcoded projects
        return migrated
          .map((entry) => {
            const filteredWorks = entry.works.filter(
              (w) =>
                w.projectId !== 'titan-realestate' &&
                w.projectId !== 'aerospace-craft' &&
                w.projectId !== 'clean-energy' &&
                w.projectId !== 'proj-1'
            );
            return { ...entry, works: filteredWorks };
          })
          .filter((entry) => entry.works && entry.works.length > 0);
      }
    } catch (e) {
      console.error("Failed to parse or migrate saved entries:", e);
    }
    return INITIAL_DSR_ENTRIES;
  });

  // Helper to auto-register a user on successful login
  const registerLoggedInUser = (email: string, initialName?: string) => {
    const emailLower = email.trim().toLowerCase();
    const isAlreadyAllowed = allowedUsers.some(u => u.email.trim().toLowerCase() === emailLower);
    if (!isAlreadyAllowed) {
      let defaultName = initialName;
      if (!defaultName) {
        const prefix = emailLower.split('@')[0];
        defaultName = prefix
          .split(/[\._\-]/)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      setAllowedUsers((prev) => {
        if (prev.some((u) => u.email.trim().toLowerCase() === emailLower)) return prev;
        return [...prev, { email: emailLower, name: defaultName! }];
      });
    }
  };

  // Login session state
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('dsr_logged_user') || null;
  });

  const [currentUserRole, setCurrentUserRole] = useState<'user' | 'admin' | null>(() => {
    return (localStorage.getItem('dsr_logged_role') as 'user' | 'admin') || null;
  });

  const [activeTab, setActiveTab] = useState<'submit' | 'logs' | 'dashboard' | 'settings'>(() => {
    const savedUser = localStorage.getItem('dsr_logged_user');
    const savedRole = localStorage.getItem('dsr_logged_role') as 'user' | 'admin' | null;
    if (savedUser) {
      if (savedRole) {
        return savedRole === 'admin' ? 'dashboard' : 'submit';
      }
      const savedAdmins = localStorage.getItem('dsr_admin_emails');
      const admins = savedAdmins ? JSON.parse(savedAdmins) : ADMIN_EMAILS;
      return admins.includes(savedUser.trim().toLowerCase()) ? 'dashboard' : 'submit';
    }
    return 'submit';
  });

  // Synchronize dynamic data from our central Sheets API
  const syncWithBackend = async () => {
    setIsSyncing(true);
    try {
      // Sync access configuration list from the backend source of truth
      try {
        const authConfRes = await fetch("/api/auth/config");
        if (authConfRes.ok) {
          const authConfData = await authConfRes.json();
          if (authConfData.allowedAdmins) {
            setAdminEmails(authConfData.allowedAdmins);
          }
          if (authConfData.allowedUsers) {
            setAllowedUsers(authConfData.allowedUsers.map((u: string) => ({
              email: u,
              name: u.includes('@') ? u.split('@')[0].charAt(0).toUpperCase() + u.split('@')[0].slice(1) : u
            })));
          }
        }
      } catch (authErr) {
        console.warn("Failed to fetch server auth config:", authErr);
      }

       const syncHeaders: Record<string, string> = {};
      if (sheetSettings?.projectsSpreadsheetId) {
        syncHeaders["x-projects-spreadsheet-id"] = sheetSettings.projectsSpreadsheetId;
      }
      if (sheetSettings?.logsSpreadsheetId) {
        syncHeaders["x-logs-spreadsheet-id"] = sheetSettings.logsSpreadsheetId;
      }
      if (sheetSettings?.spreadsheetId) {
        syncHeaders["x-spreadsheet-id"] = sheetSettings.spreadsheetId;
      }
      syncHeaders["x-projects-tab"] = sheetSettings?.projectsTab || 'Projects_Mapping';
      syncHeaders["x-submissions-tab"] = sheetSettings?.submissionsTab || 'DSR_Logs';

      // 1. Fetch Consolidated Dynamic Filters & Spreadsheet configurations
      const filterRes = await fetch("/api/filters", { headers: syncHeaders });
      if (filterRes.ok) {
        const filterData = await filterRes.json();
        if (filterData) {
          if (filterData.projects && Array.isArray(filterData.projects)) {
            setProjects(filterData.projects);
            localStorage.setItem('dsr_projects', JSON.stringify(filterData.projects));
            
            // Sync locations from spreadsheet fields
            const locationsList = filterData.projects.map((p: any) => ({
              projectId: p.id,
              north: p.location || "Mumbai",
              west: p.region || "West"
            }));
            setProjectLocations(locationsList);
            localStorage.setItem('dsr_project_locations', JSON.stringify(locationsList));
          }

          if (filterData.users && Array.isArray(filterData.users)) {
            setAllowedUsers(filterData.users);
            localStorage.setItem('dsr_allowed_users', JSON.stringify(filterData.users));
          }
        }
      } else {
        // Fallback to individual projects fetch if not supported
        const projRes = await fetch("/api/projects", { headers: syncHeaders });
        if (projRes.ok) {
          const loadedProjects = await projRes.json();
          if (loadedProjects && Array.isArray(loadedProjects)) {
            setProjects(loadedProjects);
            localStorage.setItem('dsr_projects', JSON.stringify(loadedProjects));
          }
        }
      }

      // 2. Fetch Submissions (Logs)
      const subRes = await fetch("/api/submissions", { headers: syncHeaders });
      if (subRes.ok) {
        const loadedEntries = await subRes.json();
        if (loadedEntries && Array.isArray(loadedEntries)) {
          setEntries(loadedEntries);
          localStorage.setItem('dsr_entries', JSON.stringify(loadedEntries));
        }
      }

      // 3. Fetch Alerts
      const alertRes = await fetch("/api/alerts");
      if (alertRes.ok) {
        const loadedAlerts = await alertRes.json();
        if (loadedAlerts && Array.isArray(loadedAlerts)) {
          setAlerts(loadedAlerts);
        }
      }
    } catch (err) {
      console.warn("Express Sheets DB sync failed, running local caches:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Run on mount or when logged user changes
  useEffect(() => {
    syncWithBackend();
    
    const savedUser = localStorage.getItem('dsr_logged_user');
    if (savedUser) {
      setCurrentUserEmail(savedUser.trim().toLowerCase());
    }
  }, []);

  // Sync when user states change to double-check their project assignments
  useEffect(() => {
    if (currentUserEmail) {
      syncWithBackend();
    }
  }, [currentUserEmail]);

  // Load and cache Auth automatically
  useEffect(() => {
    initAuth(async (user) => {
      if (user && user.email) {
        const userEmail = user.email.trim().toLowerCase();
        registerLoggedInUser(userEmail, user.displayName || undefined);
        setCurrentUserEmail(userEmail);
        syncWithBackend();
      }
    }, () => {
      // Sign-out action
    });
  }, [adminEmails]);

  // Sync states triggers
  useEffect(() => {
    localStorage.setItem('dsr_admin_emails', JSON.stringify(adminEmails));
  }, [adminEmails]);

  useEffect(() => {
    localStorage.setItem('dsr_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('dsr_allowed_users', JSON.stringify(allowedUsers));
  }, [allowedUsers]);

  useEffect(() => {
    localStorage.setItem('dsr_project_locations', JSON.stringify(projectLocations));
  }, [projectLocations]);

  useEffect(() => {
    localStorage.setItem('dsr_custom_submission_types', JSON.stringify(customSubmissionTypes));
  }, [customSubmissionTypes]);

  useEffect(() => {
    localStorage.setItem('dsr_sheet_settings', JSON.stringify(sheetSettings));
  }, [sheetSettings]);

  useEffect(() => {
    localStorage.setItem('dsr_entries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    if (currentUserEmail) {
      localStorage.setItem('dsr_logged_user', currentUserEmail);
    } else {
      localStorage.removeItem('dsr_logged_user');
      localStorage.removeItem('dsr_logged_role');
    }
  }, [currentUserEmail]);

  // Derived user parameters
  const isAdmin = currentUserRole === 'admin';
  
  // Filter projects by whether the user is assigned to them in the Sheets database project mapping
  const filteredProjectsForUser = useMemo(() => {
    if (!currentUserEmail) return [];
    
    // Admins always see ALL projects/domains
    if (isAdmin) return projects;

    const emailLower = currentUserEmail.trim().toLowerCase();
    const nameLower = getUserDisplayName(currentUserEmail, allowedUsers).toLowerCase();
    const prefix = emailLower.split('@')[0];

    return projects.filter((p) => {
      if (!p.users || !Array.isArray(p.users) || p.users.length === 0) return false;
      return p.users.some((user: string) => {
        const uLower = user.toLowerCase();
        return uLower === emailLower || 
               uLower === nameLower || 
               uLower === prefix || 
               emailLower.includes(uLower) || 
               nameLower.includes(uLower);
      });
    });
  }, [projects, currentUserEmail, isAdmin, allowedUsers]);
  
  // Active Project Assignment tasks for the currently logged in user
  const activeAssignmentAlerts = useMemo(() => {
    if (!currentUserEmail) return [];
    const lowerCurrent = currentUserEmail.trim().toLowerCase();
    
    return alerts.filter(alert => {
      if (alert.alertType !== 'project_assignment') return false;
      const lowerEmail = (alert.userEmail || '').trim().toLowerCase();
      if (lowerEmail !== lowerCurrent) return false;

      // Check if user has already submitted a work log for this project on this target date
      const isFulfilled = entries.some(entry => {
        const matchesUser = (entry.userEmail || '').trim().toLowerCase() === lowerCurrent;
        const matchesDate = entry.date === alert.date;
        const hasProject = (entry.works || []).some(w => String(w.projectId) === String(alert.projectId));
        return matchesUser && matchesDate && hasProject;
      });

      return !isFulfilled;
    });
  }, [alerts, entries, currentUserEmail]);

  // Filter alerts by role: admins see user notes and admin notes, users only see admin notes
  const visibleAlerts = alerts.filter(alert => {
    const isUserMsg = alert.alertType === 'user_message';
    return isAdmin ? true : !isUserMsg;
  });

  const unreadCount = visibleAlerts.filter(a => !a.read).length;
  const [filteredLogsCount, setFilteredLogsCount] = useState<number | null>(null);

  // Actions
  const handleLogin = async (email: string, role: 'user' | 'admin') => {
    const emailLower = email.trim().toLowerCase();
    setLoginValidationError(null);
    setIsLoggingIn(true);

    try {
      // Validate with backend auth structure
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLower })
      });

      const bodyText = await res.text();
      let data: any;
      try {
        data = JSON.parse(bodyText);
      } catch (jsonErr) {
        throw new Error(`The workspace server returned an unexpected response format (Status: ${res.status}). Please try refreshing the page.`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "Login attempt rejected. Email not authorized.");
      }

      const actualRole = data.role as 'user' | 'admin';

      if (role === 'admin' && actualRole !== 'admin') {
        throw new Error("Access Denied: This email account is not registered as an Administrator.");
      }

      // Save user to memory/state instantly
      registerLoggedInUser(emailLower);
      setCurrentUserEmail(emailLower);
      setCurrentUserRole(role);
      localStorage.setItem('dsr_logged_role', role);
      setActiveTab(role === 'admin' ? 'dashboard' : 'submit');

      // Attempt background backend synchronisation for active state updates without blocking login UI or crashing
      syncWithBackend().catch((err) => {
        console.warn("Background sheet sync was deferred on login:", err);
      });
    } catch (err: any) {
      console.error(err);
      setLoginValidationError(err.message || String(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // silent catch for local logins
    }
    setCurrentUserEmail(null);
    setCurrentUserRole(null);
    setLoginValidationError(null);
    localStorage.removeItem('dsr_logged_user');
    localStorage.removeItem('dsr_logged_role');
  };

  const handleAddCustomSubmissionType = (type: CustomSubmissionType) => {
    setCustomSubmissionTypes((prev) => [...prev, type]);
  };

  const handleDeleteCustomSubmissionType = (id: string) => {
    setCustomSubmissionTypes((prev) => prev.filter(t => t.id !== id));
  };

  const handleUpdateSheetSettings = (settings: typeof sheetSettings) => {
    setSheetSettings(settings);
  };

  // Google SSO authenticator
  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setLoginValidationError(null);
    try {
      const result = await googleSignIn();
      if (result && result.user && result.user.email) {
        const userEmail = result.user.email.trim().toLowerCase();
        
        // Verify via backend
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: userEmail })
        });

        const bodyText = await res.text();
        let data: any;
        try {
          data = JSON.parse(bodyText);
        } catch (jsonErr) {
          await logout();
          throw new Error(`The workspace server returned an unexpected response format (Status: ${res.status}).`);
        }

        if (!res.ok) {
          await logout(); // invalidate local login since not accepted by backend
          throw new Error(data?.error || "Google SSO account is not registered to enter workspace.");
        }

        // Update local credentials
        if (data.allowedAdmins) setAdminEmails(data.allowedAdmins);
        if (data.allowedUsers) {
          setAllowedUsers(data.allowedUsers.map((u: string) => ({
            email: u,
            name: u.includes('@') ? u.split('@')[0].charAt(0).toUpperCase() + u.split('@')[0].slice(1) : u
          })));
        }

        // Auto-register upon Google Sign-In
        registerLoggedInUser(userEmail, result.user.displayName || undefined);

        setCurrentUserEmail(userEmail);
        const actualRole = data.role as 'user' | 'admin';
        setCurrentUserRole(actualRole);
        localStorage.setItem('dsr_logged_role', actualRole);
        setActiveTab(actualRole === "admin" ? 'dashboard' : 'submit');

        await syncWithBackend();
      }
    } catch (err: any) {
      console.error(err);
      setLoginValidationError(err.message || String(err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleTriggerSync = async () => {
    await syncWithBackend();
  };

  const handleAddDSR = async (worksData: Omit<ProjectWork, 'id'>[], date: string) => {
    if (!currentUserEmail) return;

    // Build the clean works subrecords with unique stable IDs
    const worksWithIds: ProjectWork[] = worksData.map((w, index) => ({
      ...w,
      id: `work-sub-${Date.now()}-${index}-${Math.round(Math.random() * 1000)}`,
    }));

    const newEntry: DSREntry = {
      id: `dsr-${Date.now()}`,
      date,
      userEmail: currentUserEmail,
      works: worksWithIds,
      createdAt: new Date().toISOString(),
    };

    // Save locally immediately
    setEntries((prev) => [newEntry, ...prev]);

    // Async write to sheets via service account proxy
    try {
       const appendHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sheetSettings?.projectsSpreadsheetId) {
        appendHeaders['x-projects-spreadsheet-id'] = sheetSettings.projectsSpreadsheetId;
      }
      if (sheetSettings?.logsSpreadsheetId) {
        appendHeaders['x-logs-spreadsheet-id'] = sheetSettings.logsSpreadsheetId;
      }
      if (sheetSettings?.spreadsheetId) {
        appendHeaders['x-spreadsheet-id'] = sheetSettings.spreadsheetId;
      }
      appendHeaders["x-projects-tab"] = sheetSettings?.projectsTab || 'Projects_Mapping';
      appendHeaders["x-submissions-tab"] = sheetSettings?.submissionsTab || 'DSR_Logs';

      await fetch('/api/submissions/append', {
        method: 'POST',
        headers: appendHeaders,
        body: JSON.stringify({
          works: worksData,
          date,
          userEmail: currentUserEmail,
        }),
      });
      await syncWithBackend();
    } catch (err) {
      console.warn('Backend sheets appending failed, saved locally:', err);
    }
  };

  const handleDeleteDSR = (id: string) => {
    // Disabled - logs can never be deleted
  };

  const handleUpdateDSRStatus = (id: string, status: 'Pending' | 'Approved' | 'Needs Revision') => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status } : e))
    );
  };

  const handleSendUserMessage = (message: string) => {
    if (!currentUserEmail || !message.trim()) return;
    const userName = getUserDisplayName(currentUserEmail, allowedUsers);
    const newAlert = {
      id: `usr-msg-${Date.now()}-${Math.round(Math.random() * 10000)}`,
      alertType: 'user_message',
      projectName: 'Message from User',
      projectDomain: userName,
      adminEmail: currentUserEmail,
      message: message.trim(),
      createdAt: new Date().toISOString(),
      read: false
    };
    setAlerts((prev) => [newAlert, ...prev]);
  };

  // Admin Project Registry callbacks
  const handleAddProject = (newProj: Omit<Project, 'id'>) => {
    const project: Project = {
      ...newProj,
      id: `proj-${Date.now()}`,
    };
    setProjects((prev) => [...prev, project]);
  };

  const handleUpdateProject = async (updatedProject: Project) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
    try {
      const spreadsheetId = localStorage.getItem('dsr_projects_spreadsheet_id') || localStorage.getItem('dsr_spreadsheet_id') || '';
      const projectsTab = localStorage.getItem('dsr_projects_tab') || 'Projects_Mapping';
      const syncHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-spreadsheet-id': spreadsheetId,
        'x-projects-tab': projectsTab,
      };

      await fetch("/api/projects", {
        method: "POST",
        headers: syncHeaders,
        body: JSON.stringify({
          action: "edit",
          project: updatedProject
        })
      });
    } catch (err) {
      console.error("Failed to update project priority/frequency:", err);
    }
  };

  const handleDeleteProject = (id: string) => {
    if (window.confirm('Deleting this project will prevent future DSR submissions from tagging it. Continue?')) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // Admin Registry Dynamic modification
  const handleAddAdminEmail = (email: string) => {
    setAdminEmails((prev) => [...prev, email]);
  };

  const handleDeleteAdminEmail = (email: string) => {
    if (window.confirm(`Revoke admin clearance privileges for email ${email}?`)) {
      setAdminEmails((prev) => prev.filter((e) => e !== email));
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('Reset workspace database? This will clear local overrides and let you fetch the latest clean configuration from Google Sheets.')) {
      localStorage.removeItem('dsr_admin_emails');
      localStorage.removeItem('dsr_projects');
      localStorage.removeItem('dsr_entries');
      localStorage.removeItem('dsr_logged_user');
      localStorage.removeItem('dsr_custom_submission_types');
      localStorage.removeItem('dsr_sheet_settings');

      setAdminEmails(ADMIN_EMAILS);
      setProjects(DEFAULT_PROJECTS);
      setEntries(INITIAL_DSR_ENTRIES);
      setCustomSubmissionTypes([]);
      setSheetSettings({
        spreadsheetId: '',
        projectsTab: 'Projects',
        submissionsTab: 'Submissions',
        isConnected: false
      });
      setCurrentUserEmail(null);
      setActiveTab('submit');
    }
  };

  // Render Login state first if session is missing
  if (!currentUserEmail) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        adminEmails={adminEmails}
        allowedUsers={allowedUsers}
        onGoogleSignIn={handleGoogleSignIn}
        isLoggingIn={isLoggingIn}
        loginError={loginValidationError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 text-gray-900 font-sans selection:bg-indigo-105 selection:text-indigo-900">

      {/* Main header block */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-150">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Left side: branding */}
            <div className="flex items-center">
              <img 
                src="https://assetscout.in/assets/images/Assetscout%20Logo%20Black.webp" 
                alt="Assetscout Logo" 
                className="h-7 sm:h-8 w-auto object-contain block"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Middle navigation tabs */}
            <nav className="hidden md:flex space-x-1" aria-label="Global Workspace Navigation">
              {!isAdmin && (
                <button
                  id="tab-submit"
                  onClick={() => setActiveTab('submit')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                    activeTab === 'submit'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <PenTool size={14} />
                  Work Log Submission
                </button>
              )}

              <button
                id="tab-logs"
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                  activeTab === 'logs'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Database size={14} />
                Work Log History
              </button>

              <button
                id="tab-dashboard"
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid size={14} />
                Analytics Dashboard
              </button>

              {isAdmin && (
                <button
                  id="tab-settings"
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                    activeTab === 'settings'
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Sliders size={14} />
                  Admin Settings
                </button>
              )}
            </nav>

            {/* Right Side: Account Actions & Logouts */}
            <div className="flex items-center gap-3">
              {/* Notifications Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-2 border border-gray-150 hover:bg-slate-50 text-gray-500 hover:text-indigo-600 rounded-xl transition cursor-pointer relative ${showNotifications ? 'bg-indigo-50/50 text-indigo-600 border-indigo-200' : ''}`}
                  title="Notifications & Alerts"
                >
                  <Bell size={15} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-150 rounded-2xl shadow-lg py-3 z-50 animate-fade-in divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                    <div className="px-4 pb-2 flex justify-between items-center">
                      <span className="font-extrabold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                        <Bell size={12} className="text-indigo-600" />
                        Admin Alerts
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAlertsAsRead}
                          className="text-[10px] text-indigo-600 hover:underline font-extrabold uppercase font-sans"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="py-1">
                      {visibleAlerts.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-gray-400 font-medium font-mono italic">
                          No alerts or messages logged here yet.
                        </div>
                      ) : (
                        visibleAlerts.map((alert) => {
                          const isUserMsg = alert.alertType === 'user_message';
                          return (
                            <div
                              key={alert.id}
                              className={`px-4 py-3 text-left relative hover:bg-slate-50/50 transition-colors ${!alert.read ? 'bg-indigo-50/10 font-bold' : ''}`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  {isUserMsg ? (
                                    <span className="inline-block bg-emerald-50 text-emerald-800 font-black px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider mb-1 border border-emerald-100">
                                      📬 User Note
                                    </span>
                                  ) : (
                                    <span className="inline-block bg-indigo-50 text-indigo-700 font-black px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider mb-1">
                                      {alert.projectName}
                                    </span>
                                  )}
                                  {alert.projectDomain && (
                                    <span className="text-[8px] text-gray-405 font-medium ml-1">
                                      {isUserMsg ? `from ${alert.projectDomain}` : `(${alert.projectDomain})`}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleClearAlert(alert.id)}
                                  className="text-gray-400 hover:text-rose-600 text-[12px] p-0.5 leading-none font-bold"
                                  title="Dismiss Alert"
                                >
                                  &times;
                                </button>
                              </div>
                              <p className="text-[11px] font-semibold text-gray-750 leading-relaxed mt-1 whitespace-pre-wrap">
                                {alert.message}
                              </p>
                              <div className="flex justify-between items-center mt-2 text-[8px] text-gray-405 font-bold font-mono uppercase">
                                <span>{isUserMsg ? `Sender: ${alert.adminEmail}` : `By ${alert.adminEmail}`}</span>
                                <span>{new Date(alert.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {!alert.read && (
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile card badge */}
              <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 bg-gray-50 border border-gray-150 rounded-xl text-xs max-w-64">
                {isAdmin ? (
                  <Shield size={13} className="text-indigo-600 shrink-0" />
                ) : (
                  <User size={13} className="text-gray-550 shrink-0" />
                )}
                <div className="overflow-hidden leading-none text-left">
                  <span className="block font-bold text-gray-800 truncate" title={currentUserEmail || ''}>
                    {getUserDisplayName(currentUserEmail, allowedUsers)}
                  </span>
                  <span className="text-[9px] text-gray-400 font-mono mt-0.5 block uppercase tracking-wider">
                    {isAdmin ? 'Administrator' : 'Reporter Profile'}
                  </span>
                </div>
              </div>

              {/* Log out actions */}
              <button
                onClick={handleLogout}
                className="p-2 border border-gray-150 hover:bg-rose-50 text-gray-500 hover:text-rose-600 rounded-xl transition cursor-pointer"
                title="Switch Account / Sign Out"
              >
                <LogOut size={15} />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main app grid frame */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Constant & Stable Project Assignment Alerts Banner */}
        {activeAssignmentAlerts.length > 0 && (
          <div className="mb-6 space-y-3">
            {activeAssignmentAlerts.map((alert) => (
              <div 
                key={alert.id}
                className="bg-amber-500/10 text-amber-900 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans shadow-2xs relative overflow-hidden"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">🚨</span>
                  <div className="text-left">
                    <h4 className="font-extrabold text-[10px] text-amber-800 uppercase tracking-wider">
                      Required Action: Log Assigned Task
                    </h4>
                    <p className="text-xs text-amber-950 font-bold mt-1">
                      Please submit a Work Log for project <span className="underline decoration-amber-600 decoration-2">{alert.projectName} ({alert.projectDomain})</span> assigned for the target date <span className="font-mono text-amber-900 bg-amber-100 border border-amber-250 px-1.5 py-0.5 rounded font-black">{alert.date}</span>.
                    </p>
                    {alert.message && alert.message !== `Admin has requested that you submit a Work Log for ${alert.projectName} for the reporting date of ${alert.date}.` && (
                      <p className="text-[11px] text-amber-700 font-semibold italic mt-0.5">
                        &ldquo;{alert.message}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <button
                    onClick={() => {
                      setAssignmentPreFill({
                        projectId: alert.projectId,
                        date: alert.date
                      });
                      setActiveTab('submit');
                    }}
                    className="whitespace-nowrap px-4 py-2 bg-amber-600 hover:bg-amber-700 hover:scale-[1.01] active:scale-[0.99] text-white font-extrabold rounded-xl text-xs transition duration-75 shadow-xs cursor-pointer"
                  >
                    👉 Fill Work Log
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
              {/* Mobile quick tab Navigation */}
        <div className="flex md:hidden bg-white p-2 rounded-2xl border border-gray-150 mb-6 gap-1 justify-around shadow-xs">
          {!isAdmin && (
            <button
              onClick={() => setActiveTab('submit')}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[10px] font-bold w-1/4 transition cursor-pointer ${
                activeTab === 'submit' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <PenTool size={15} />
              Work Log Entry
            </button>
          )}

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl text-[10px] font-bold w-1/4 transition cursor-pointer ${
              activeTab === 'logs' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <Database size={15} />
            History Logs
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl text-[10px] font-bold w-1/4 transition cursor-pointer ${
              activeTab === 'dashboard' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <LayoutGrid size={15} />
            Dashboard
          </button>
          
          {isAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl text-[10px] font-bold w-1/4 transition cursor-pointer ${
                activeTab === 'settings' ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <Sliders size={15} />
              Settings
            </button>
          )}
        </div>

        {/* Dynamic header descriptions */}
        {activeTab !== 'dashboard' && (
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 pb-6">
            <div className="space-y-1">
              <h1 className="text-xl font-black text-gray-900 tracking-tight sm:text-2xl flex items-center gap-2">
                {activeTab === 'submit' && 'Work Log Submissions'}
                {activeTab === 'logs' && 'Daily Task History'}
                {activeTab === 'settings' && 'System Configuration Studio'}
              </h1>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {activeTab === 'logs' && (
                <span className="bg-indigo-50 border border-indigo-200/60 text-indigo-700 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs">
                  ⚡ Total Logs: <strong>{filteredLogsCount !== null ? filteredLogsCount : 0} logs</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Primary Workspace View Switch */}
        <div className="min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'submit' && !isAdmin && (
                <DSRForm
                  projects={filteredProjectsForUser}
                  onSubmit={handleAddDSR}
                  currentUserEmail={currentUserEmail}
                  allowedUsers={allowedUsers}
                  onViewLogs={() => setActiveTab('logs')}
                  customSubmissionTypes={customSubmissionTypes}
                  onSendAdminMessage={handleSendUserMessage}
                  preFill={assignmentPreFill}
                  onClearPreFill={() => setAssignmentPreFill(null)}
                />
              )}

              {activeTab === 'logs' && (
                <DSRLogs
                  entries={entries}
                  projects={projects}
                  onDeleteEntry={handleDeleteDSR}
                  onUpdateStatus={handleUpdateDSRStatus}
                  isAdmin={isAdmin}
                  customSubmissionTypes={customSubmissionTypes}
                  allowedUsers={allowedUsers}
                  currentUserEmail={currentUserEmail}
                  onFilteredCountChange={setFilteredLogsCount}
                />
              )}

              {activeTab === 'dashboard' && (
                <DSRDashboard
                  entries={entries}
                  projects={projects}
                  allowedUsers={allowedUsers}
                  projectLocations={projectLocations}
                  isAdmin={isAdmin}
                  currentUserEmail={currentUserEmail || ''}
                  customSubmissionTypes={customSubmissionTypes}
                  alerts={alerts}
                  onAddAlert={handleAddAlert}
                  onUpdateProject={handleUpdateProject}
                />
              )}

              {activeTab === 'settings' && isAdmin && (
                <DSRSettings
                  projects={projects}
                  adminEmails={adminEmails}
                  entries={entries}
                  onAddAdminEmail={handleAddAdminEmail}
                  onDeleteAdminEmail={handleDeleteAdminEmail}
                  currentUserEmail={currentUserEmail}
                  customSubmissionTypes={customSubmissionTypes}
                  onAddCustomSubmissionType={handleAddCustomSubmissionType}
                  onDeleteCustomSubmissionType={handleDeleteCustomSubmissionType}
                  sheetSettings={sheetSettings}
                  onUpdateSheetSettings={handleUpdateSheetSettings}
                  onTriggerSync={handleTriggerSync}
                  isSyncing={isSyncing}
                  allowedUsers={allowedUsers}
                  onSetAllowedUsers={setAllowedUsers}
                  projectLocations={projectLocations}
                  onSetProjectLocations={setProjectLocations}
                  onUpdateProjects={setProjects}
                  alerts={alerts}
                  onAddAlert={handleAddAlert}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </main>
    </div>
  );
}
