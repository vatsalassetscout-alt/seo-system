/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { DSREntry, Project, AppUser, ProjectLocation, CustomSubmissionType } from '../types';
import { getUserDisplayName } from '../lib/userUtils';
import { 
  Calendar, 
  ClipboardCheck, 
  Users, 
  FileSpreadsheet, 
  TrendingUp, 
  Tag, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Percent, 
  Clock, 
  ArrowUpRight, 
  Activity, 
  FolderOpen, 
  CheckCircle,
  HelpCircle,
  AlertCircle,
  Building2,
  Award,
  BookOpen,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DSRDashboardProps {
  entries: DSREntry[];
  projects: Project[];
  allowedUsers: AppUser[];
  projectLocations: ProjectLocation[];
  isAdmin?: boolean;
  currentUserEmail?: string;
  customSubmissionTypes?: CustomSubmissionType[];
  alerts?: any[];
  onAddAlert?: (alert: any) => void;
  onUpdateProject?: (updatedProject: Project) => void;
  adminEmails?: string[];
}

export default function DSRDashboard({ 
  entries, 
  projects, 
  allowedUsers, 
  projectLocations,
  isAdmin = false,
  currentUserEmail = '',
  customSubmissionTypes = [],
  alerts = [],
  onAddAlert,
  onUpdateProject,
  adminEmails = []
}: DSRDashboardProps) {
  // Filter entries based on role representation (Admins see everything, regular users see only their own)
  const parsedEntries = useMemo(() => {
    if (isAdmin) {
      return entries;
    }
    if (!currentUserEmail) return [];
    const emailLower = currentUserEmail.toLowerCase().trim();
    const resolvedName = getUserDisplayName(currentUserEmail, allowedUsers).toLowerCase().trim();

    return entries.filter(entry => {
      if (!entry.userEmail) return false;
      const entryEmailLower = entry.userEmail.toLowerCase().trim();
      return entryEmailLower === emailLower || 
             entryEmailLower === resolvedName || 
             entryEmailLower.includes(emailLower) ||
             resolvedName.includes(entryEmailLower);
    });
  }, [entries, isAdmin, currentUserEmail, allowedUsers]);

  // Frequency Period Selection Tab state (daily, weekly, monthly)
  const [freqFilterType, setFreqFilterType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // Navigation for the 5 horizontal buttons
  const [activeTab, setActiveTab] = useState<'project_table' | 'frequency' | 'activity' | 'backlinks' | 'unworked_project' | 'keyword_section'>('project_table');

  // Heatmap Calendar state declarations
  const [heatmapMonth, setHeatmapMonth] = useState<number>(5); // Default to June (index 5)
  const [heatmapYear, setHeatmapYear] = useState<number>(2026); // Default to 2026
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>('2026-06-16');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthDays = useMemo(() => {
    const firstDayIndex = new Date(heatmapYear, heatmapMonth, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(heatmapYear, heatmapMonth + 1, 0).getDate();
    
    const blanks = Array(firstDayIndex).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    return {
      blanks,
      days,
    };
  }, [heatmapYear, heatmapMonth]);

  // Filter states
  const [showRoster, setShowRoster] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const [regionFilter, setRegionFilter] = useState<string>('All');

  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [locationSearchTerm, setLocationSearchTerm] = useState('');

  const [commonSearchTerm, setCommonSearchTerm] = useState('');
  const [keywordSearchTerm, setKeywordSearchTerm] = useState('');

  // Date filters (moved inside the top Workspace Filters section)
  const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'yesterday' | 'last_7_days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Project backlinks cell expand state (for clicking on the backlinks count)
  const [expandedProjectStats, setExpandedProjectStats] = useState<Record<string, boolean>>({});

  // Employee lookup details
  const employeeEmailToNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    
    // First fill fallback human friendly names from history
    entries.forEach(entry => {
      if (entry && entry.userEmail) {
        const email = entry.userEmail.trim().toLowerCase();
        map[email] = getUserDisplayName(email, allowedUsers);
      }
    });

    // Overwrite with absolute assigned names
    allowedUsers.forEach(u => {
      map[u.email.trim().toLowerCase()] = u.name || getUserDisplayName(u.email, allowedUsers);
    });

    return map;
  }, [allowedUsers, entries]);

  // Unique list of all available user accounts for checklist selection (excluding admins)
  const allUsersList = useMemo(() => {
    const emailMap = new Map<string, string>();
    const isUserAdmin = (email: string) => {
      const emailLower = email.trim().toLowerCase();
      if (emailLower === '8888' || emailLower.includes("admin")) return true;
      if (adminEmails && adminEmails.some(a => a.trim().toLowerCase() === emailLower)) return true;
      const hardcodedAdmins = ['vatsalpatelwork20@gmail.com', 'assetscout007rohan@gmail.com'];
      if (hardcodedAdmins.some((a) => a.trim().toLowerCase() === emailLower)) return true;
      return false;
    };

    allowedUsers.forEach(u => {
      if (u.email && u.email.trim() && !isUserAdmin(u.email)) {
        emailMap.set(u.email.trim().toLowerCase(), u.name || getUserDisplayName(u.email, allowedUsers));
      }
    });

    entries.forEach(entry => {
      if (entry && entry.userEmail && !isUserAdmin(entry.userEmail)) {
        const email = entry.userEmail.trim().toLowerCase();
        if (!emailMap.has(email)) {
          emailMap.set(email, getUserDisplayName(email, allowedUsers));
        }
      }
    });

    return Array.from(emailMap.entries()).map(([email, name]) => ({
      email,
      name
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allowedUsers, entries, adminEmails]);

  // User Projects based on logged-in user or admin's selected users filter
  const userProjects = useMemo(() => {
    if (!isAdmin) {
      if (!currentUserEmail) return [];
      const emailLower = currentUserEmail.trim().toLowerCase();
      const nameLower = getUserDisplayName(currentUserEmail, allowedUsers).toLowerCase();
      const prefix = emailLower.split('@')[0];
      return projects.filter((p) => {
        if (p.userId && String(p.userId).trim().toLowerCase() === emailLower) {
          return true;
        }
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
    }

    if (selectedUsers.length > 0) {
      const selectedSet = new Set(selectedUsers.map(e => e.toLowerCase().trim()));
      return projects.filter(p => {
        if (p.userId && selectedSet.has(p.userId.toLowerCase().trim())) return true;
        return p.users?.some(u => selectedSet.has(u.toLowerCase().trim()));
      });
    }

    return projects;
  }, [projects, isAdmin, currentUserEmail, selectedUsers, allowedUsers]);

  // Available locations list based on project locations in sheet
  const availableLocations = useMemo(() => {
    const locSet = new Set<string>();
    userProjects.forEach((p) => {
      const pLoc = (p as any).location;
      if (pLoc && pLoc.trim() !== '') {
        locSet.add(pLoc.trim());
      }
    });
    
    // Fallback default set if empty
    if (locSet.size === 0) {
      locSet.add('Mumbai');
      locSet.add('Delhi');
    }
    return Array.from(locSet).sort();
  }, [userProjects]);

  // Available regions list based on project regions in sheet
  const availableRegions = useMemo(() => {
    const regSet = new Set<string>();
    userProjects.forEach((p) => {
      const pReg = (p as any).region;
      if (pReg && pReg.trim() !== '') {
        regSet.add(pReg.trim());
      }
    });
    return Array.from(regSet).sort();
  }, [userProjects]);

  const regionOptions = useMemo(() => {
    return ['All', ...availableRegions];
  }, [availableRegions]);

  // Flat map of all individual project work blocks across all days to perform granular telemetry
  const flattenedWorks = useMemo(() => {
    const list: {
      date: string;
      userEmail: string;
      projectId: string;
      projectName: string;
      listingCount: number;
      blogCount: number;
      forumCount: number;
      pdfCount: number;
      imageCount: number;
      videoPptCount: number;
      profileCount: number;
      linkCount: number;
      blog: string;
      customValues: Record<string, string | number | boolean>;
      workTypes: string[];
      contentUpdates: string[];
      selectedKeywords: string[];
      workSummary: string;
      entryId: string;
    }[] = [];
    if (!Array.isArray(parsedEntries)) return list;
    parsedEntries.forEach((entry) => {
      if (!entry) return;
      const worksList = Array.isArray(entry.works) ? entry.works : [];
      worksList.forEach((w) => {
        if (!w) return;
        list.push({
          date: entry.date || '',
          userEmail: entry.userEmail || '',
          projectId: w.projectId || '',
          projectName: w.projectName || '',
          listingCount: Number(w.listingCount) || 0,
          blogCount: Number(w.blogCount) || 0,
          forumCount: Number(w.forumCount) || 0,
          pdfCount: Number(w.pdfCount) || 0,
          imageCount: Number(w.imageCount) || 0,
          videoPptCount: Number(w.videoPptCount) || 0,
          profileCount: Number(w.profileCount) || 0,
          linkCount: Number(w.linkCount) || 0,
          blog: w.blog || '',
          customValues: w.customValues || {},
          workTypes: w.workTypes || ['seo_backlink'],
          contentUpdates: w.contentUpdates || [],
          selectedKeywords: w.selectedKeywords || [],
          workSummary: w.workSummary || '',
          entryId: entry.id,
        });
      });
    });
    return list;
  }, [parsedEntries]);

  // Enriched locations & region details
  const enrichedWorks = useMemo(() => {
    return flattenedWorks.map((work) => {
      const proj = projects.find(p => p.id === work.projectId || p.name.toLowerCase() === work.projectName.toLowerCase());
      
      let region = 'West';
      let location = 'Mumbai';

      if (proj) {
        if ((proj as any).region) region = (proj as any).region;
        if ((proj as any).location) location = (proj as any).location;
      }

      return {
        ...work,
        region,
        location,
        allProjectLocations: [location]
      };
    });
  }, [flattenedWorks, projects]);

  // Handle filtering
  const filteredWorks = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const list7Days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      list7Days.push(d.toISOString().split('T')[0]);
    }

    return enrichedWorks.filter((work) => {
      // 1. Projects checklist filter matching ID or Project Name
      if (selectedProjectIds.length > 0) {
        const selectedProjNames = projects
          .filter(p => selectedProjectIds.includes(p.id))
          .map(p => p.name.toLowerCase().trim());
        const workProjName = work.projectName ? work.projectName.toLowerCase().trim() : '';
        if (!selectedProjectIds.includes(work.projectId) && !selectedProjNames.includes(workProjName)) {
          return false;
        }
      }

      // 2. Admin multi-user checklist filter
      if (isAdmin && selectedUsers.length > 0) {
        if (!work.userEmail || !selectedUsers.includes(work.userEmail.toLowerCase().trim())) {
          return false;
        }
      }

      // 3. Region Slider Toggle
      if (regionFilter !== 'All' && work.region !== regionFilter) {
        return false;
      }

      // 4. Project Location checklist filter
      if (selectedLocations.length > 0) {
        const matchesLocation = work.allProjectLocations.length > 0 
          ? work.allProjectLocations.some(loc => selectedLocations.includes(loc))
          : selectedLocations.includes(work.location);
        
        if (!matchesLocation) {
          return false;
        }
      }

      // 5. Date selection
      if (dateFilterType === 'today' && work.date !== todayStr) {
        return false;
      }
      if (dateFilterType === 'yesterday' && work.date !== yesterdayStr) {
        return false;
      }
      if (dateFilterType === 'last_7_days' && !list7Days.includes(work.date)) {
        return false;
      }
      if (dateFilterType === 'custom') {
        if (customStartDate && work.date < customStartDate) {
          return false;
        }
        if (customEndDate && work.date > customEndDate) {
          return false;
        }
      }

      // 6. Common Search Bar filter
      if (commonSearchTerm.trim()) {
        const term = commonSearchTerm.toLowerCase().trim();
        const proj = projects.find(p => p.id === work.projectId);
        const projectName = proj ? proj.name.toLowerCase() : '';
        const projectCode = proj ? proj.code.toLowerCase() : '';
        const projectDomain = proj?.domain ? proj.domain.toLowerCase() : '';
        const userEmail = work.userEmail?.toLowerCase() || '';
        const userName = (employeeEmailToNameMap[userEmail] || '').toLowerCase();
        const location = work.location?.toLowerCase() || '';
        const workSummary = work.workSummary?.toLowerCase() || '';
        const workTypes = (work.workTypes || []).map(t => t.toLowerCase()).join(' ');
        const contentUpdates = (work.contentUpdates || []).map(cu => cu.toLowerCase()).join(' ');

        if (
          !projectName.includes(term) &&
          !projectCode.includes(term) &&
          !projectDomain.includes(term) &&
          !userEmail.includes(term) &&
          !userName.includes(term) &&
          !location.includes(term) &&
          !workSummary.includes(term) &&
          !workTypes.includes(term) &&
          !contentUpdates.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedWorks, selectedProjectIds, selectedUsers, regionFilter, selectedLocations, dateFilterType, customStartDate, customEndDate, commonSearchTerm, isAdmin, projects, employeeEmailToNameMap]);

  // Backlink tab calculations ignore individual user filters for admin (always combined)
  const backlinksFilteredWorks = useMemo(() => {
    if (!isAdmin) {
      return filteredWorks;
    }
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const list7Days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      list7Days.push(d.toISOString().split('T')[0]);
    }

    return enrichedWorks.filter((work) => {
      // 1. Projects checklist filter matching ID or Project Name
      if (selectedProjectIds.length > 0) {
        const selectedProjNames = projects
          .filter(p => selectedProjectIds.includes(p.id))
          .map(p => p.name.toLowerCase().trim());
        const workProjName = work.projectName ? work.projectName.toLowerCase().trim() : '';
        if (!selectedProjectIds.includes(work.projectId) && !selectedProjNames.includes(workProjName)) {
          return false;
        }
      }

      // 2. Skip user filter for Admin in Backlinks tab (combined of all users)

      // 3. Region Slider Toggle
      if (regionFilter !== 'All' && work.region !== regionFilter) {
        return false;
      }

      // 4. Project Location checklist filter
      if (selectedLocations.length > 0) {
        const matchesLocation = work.allProjectLocations.length > 0 
          ? work.allProjectLocations.some(loc => selectedLocations.includes(loc))
          : selectedLocations.includes(work.location);
        
        if (!matchesLocation) {
          return false;
        }
      }

      // 5. Date selection
      if (dateFilterType === 'today' && work.date !== todayStr) {
        return false;
      }
      if (dateFilterType === 'yesterday' && work.date !== yesterdayStr) {
        return false;
      }
      if (dateFilterType === 'last_7_days' && !list7Days.includes(work.date)) {
        return false;
      }
      if (dateFilterType === 'custom') {
        if (customStartDate && work.date < customStartDate) {
          return false;
        }
        if (customEndDate && work.date > customEndDate) {
          return false;
        }
      }

      // 6. Common Search Bar filter
      if (commonSearchTerm.trim()) {
        const term = commonSearchTerm.toLowerCase().trim();
        const proj = projects.find(p => p.id === work.projectId);
        const projectName = proj ? proj.name.toLowerCase() : '';
        const projectCode = proj ? proj.code.toLowerCase() : '';
        const projectDomain = proj?.domain ? proj.domain.toLowerCase() : '';
        const userEmail = work.userEmail?.toLowerCase() || '';
        const userName = (employeeEmailToNameMap[userEmail] || '').toLowerCase();
        const location = work.location?.toLowerCase() || '';
        const workSummary = work.workSummary?.toLowerCase() || '';
        const workTypes = (work.workTypes || []).map(t => t.toLowerCase()).join(' ');
        const contentUpdates = (work.contentUpdates || []).map(cu => cu.toLowerCase()).join(' ');

        if (
          !projectName.includes(term) &&
          !projectCode.includes(term) &&
          !projectDomain.includes(term) &&
          !userEmail.includes(term) &&
          !userName.includes(term) &&
          !location.includes(term) &&
          !workSummary.includes(term) &&
          !workTypes.includes(term) &&
          !contentUpdates.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedWorks, selectedProjectIds, regionFilter, selectedLocations, dateFilterType, customStartDate, customEndDate, commonSearchTerm, isAdmin, projects, employeeEmailToNameMap, filteredWorks]);

  const handleResetFilters = () => {
    setSelectedProjectIds([]);
    setSelectedUsers([]);
    setRegionFilter('All');
    setSelectedLocations([]);
    setDateFilterType('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setCommonSearchTerm('');
    setProjectSearchTerm('');
    setUserSearchTerm('');
    setLocationSearchTerm('');
  };

  // Synchronized Project Filtering for Tab Metrics, Reports, and Unworked lists
  const filteredProjectsForMetrics = useMemo(() => {
    return projects.filter(p => {
      // 1. Projects checklist filter
      if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(p.id)) {
        return false;
      }

      let pRegion = (p as any).region || '';
      let pLocation = (p as any).location || '';

      // 2. Region filter
      if (regionFilter !== 'All') {
        if (pRegion.toLowerCase() !== regionFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Location checklist filter
      if (selectedLocations.length > 0) {
        if (!selectedLocations.includes(pLocation)) {
          return false;
        }
      }

      // 4. Common search term filtering for projects
      if (commonSearchTerm.trim()) {
        const term = commonSearchTerm.toLowerCase().trim();
        const projectName = p.name ? p.name.toLowerCase() : '';
        const projectCode = p.code ? p.code.toLowerCase() : '';
        const projectDomain = p.domain ? p.domain.toLowerCase() : '';
        
        if (
          !projectName.includes(term) &&
          !projectCode.includes(term) &&
          !projectDomain.includes(term)
        ) {
          // If project itself doesn't match the search term, check if there are any matching works for it in filteredWorks
          const hasMatchingWorks = filteredWorks.some(w => w.projectId === p.id);
          if (!hasMatchingWorks) {
            return false;
          }
        }
      }

      // 5. User scope checks of Projects
      if (!isAdmin) {
        const assignedUsers = (p as any).users || [];
        const emailLower = currentUserEmail.toLowerCase().trim();
        const matchesUser = (p.userId && String(p.userId).trim().toLowerCase() === emailLower) ||
                            assignedUsers.some((u: string) => u.toLowerCase().trim() === emailLower);
        if (!matchesUser) {
          return false;
        }
      } else if (selectedUsers.length > 0) {
        const assignedUsers = (p as any).users || [];
        const selectedSet = new Set(selectedUsers.map(e => e.toLowerCase().trim()));
        const matchesUser = (p.userId && selectedSet.has(String(p.userId).trim().toLowerCase())) ||
                            assignedUsers.some((u: string) => selectedSet.has(u.toLowerCase().trim()));
        if (!matchesUser) {
          return false;
        }
      }

      return true;
    });
  }, [projects, regionFilter, selectedLocations, selectedProjectIds, commonSearchTerm, filteredWorks, isAdmin, currentUserEmail, selectedUsers]);

  // KPI calculations for response metrics
  const projectsAssignedCount = projects.length;
  
  const northProjectsCount = useMemo(() => {
    return projects.filter(p => (p as any).region?.toLowerCase() === 'north').length;
  }, [projects]);

  const westProjectsCount = useMemo(() => {
    return projects.filter(p => (p as any).region?.toLowerCase() === 'west').length;
  }, [projects]);

  // Tab 1: Project Table data computing
  const projectTableData = useMemo(() => {
    return filteredProjectsForMetrics.map((p, idx) => {
      const pWorks = filteredWorks.filter(w => w.projectId === p.id);
      
      const listings = pWorks.reduce((sum, w) => sum + (w.listingCount || 0), 0);
      const blogs = pWorks.reduce((sum, w) => sum + (w.blogCount || 0), 0);
      const forums = pWorks.reduce((sum, w) => sum + (w.forumCount || 0), 0);
      const pdfs = pWorks.reduce((sum, w) => sum + (w.pdfCount || 0), 0);
      const images = pWorks.reduce((sum, w) => sum + (w.imageCount || 0), 0);
      const videoPpts = pWorks.reduce((sum, w) => sum + (w.videoPptCount || 0), 0);
      const profiles = pWorks.reduce((sum, w) => sum + (w.profileCount || 0), 0);
      const links = pWorks.reduce((sum, w) => sum + (w.linkCount || 0), 0);
      const totalBacklinks = listings + blogs + forums + pdfs + images + videoPpts + profiles + links;

      const timesWorked = pWorks.length;

      let lastWorked = 'Never';
      if (pWorks.length > 0) {
        const sortedDates = [...pWorks]
          .map(w => w.date)
          .filter(Boolean)
          .sort((a, b) => b.localeCompare(a));
        if (sortedDates.length > 0) {
          const parsed = new Date(sortedDates[0]);
          lastWorked = isNaN(parsed.getTime())
            ? sortedDates[0]
            : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }

      // Domain mapping
      let domain = p.domain || '';
      if (!domain) {
        domain = `${p.code.toLowerCase()}.com`;
        if (p.id === 'proj-1') domain = 'phoenix-hub.com';
        else if (p.id === 'proj-2') domain = 'alpha-marketing.io';
        else if (p.id === 'proj-3') domain = 'zenith-logistics.net';
        else if (p.id === 'proj-4') domain = 'polaris-systems.org';
        else {
          domain = p.name ? `${p.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')}.com` : 'client-domain.com';
        }
      }

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        domain,
        listings,
        blogs,
        pdfs,
        images,
        totalBacklinks,
        timesWorked,
        lastWorked,
        priority: p.priority,
        frequency: p.frequency,
        srNo: idx + 1
      };
    });
  }, [filteredProjectsForMetrics, filteredWorks]);

  // Computation of days in current selection
  const timeSpanDays = useMemo(() => {
    if (dateFilterType === 'today' || dateFilterType === 'yesterday') {
      return 1;
    }
    if (dateFilterType === 'last_7_days') {
      return 7;
    }
    if (dateFilterType === 'custom') {
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(1, diff);
      }
      return 7;
    }
    
    // For 'all' time: calculate the span of days from all entries
    if (filteredWorks.length > 0) {
      const dates = filteredWorks.map(w => w.date).filter(Boolean);
      if (dates.length > 0) {
        const timestamps = dates.map(d => new Date(d).getTime());
        const minT = Math.min(...timestamps);
        const maxT = Math.max(...timestamps);
        const diffTime = Math.abs(maxT - minT);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
      }
    }
    return 30; // default to monthly view scale if no items exist
  }, [dateFilterType, customStartDate, customEndDate, filteredWorks]);

  // Compute assigned users historically (whoever logged work on this project)
  const getAssignedUsersForProject = (projectId: string) => {
    const emails = new Set<string>();
    entries.forEach(entry => {
      if (entry.works && entry.works.some(w => w.projectId === projectId)) {
        if (entry.userEmail) {
          emails.add(entry.userEmail.toLowerCase().trim());
        }
      }
    });
    
    if (emails.size === 0) {
      return 'Unassigned';
    }
    
    return Array.from(emails)
      .map(email => employeeEmailToNameMap[email] || email)
      .join(', ');
  };

  // Tab 2: Frequency metric breakdown
  const frequencyData = useMemo(() => {
    return filteredProjectsForMetrics.map((p, idx) => {
      const pWorks = filteredWorks.filter(w => w.projectId === p.id);
      const timesWorked = pWorks.length;

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        domain: p.domain,
        assignedFrequency: p.frequency,
        timesWorked,
        srNo: idx + 1
      };
    }).sort((a, b) => b.timesWorked - a.timesWorked);
  }, [filteredProjectsForMetrics, filteredWorks]);

  // Tab 3: Team performance computed scoreboard
  const teamPerformanceData = useMemo(() => {
    const map: Record<string, { email: string; logsSubmitted: number; backlinksCount: number; activeProjects: Set<string> }> = {};

    filteredWorks.forEach((w) => {
      const email = w.userEmail.toLowerCase().trim();
      if (!map[email]) {
        map[email] = {
          email: w.userEmail,
          logsSubmitted: 0,
          backlinksCount: 0,
          activeProjects: new Set<string>()
        };
      }
      map[email].logsSubmitted += 1;
      map[email].backlinksCount += (
        (w.listingCount || 0) +
        (w.blogCount || 0) +
        (w.forumCount || 0) +
        (w.pdfCount || 0) +
        (w.imageCount || 0) +
        (w.videoPptCount || 0) +
        (w.profileCount || 0) +
        (w.linkCount || 0)
      );
      map[email].activeProjects.add(w.projectName);
    });

    return Object.values(map).map((val, idx) => {
      const avgBacklinks = val.logsSubmitted > 0 ? Math.round(val.backlinksCount / val.logsSubmitted) : 0;
      
      let badge = 'Active Builder';
      let badgeStyle = 'bg-teal-50 text-teal-800 border-teal-100';
      if (val.backlinksCount > 250) {
        badge = 'Lead Reporter';
        badgeStyle = 'bg-indigo-50 text-indigo-800 border-indigo-100';
      } else if (val.backlinksCount > 100) {
        badge = 'Power Contributor';
        badgeStyle = 'bg-purple-50 text-purple-800 border-purple-100';
      }

      return {
        ...val,
        averageBacklinks: avgBacklinks,
        badge,
        badgeStyle,
        srNo: idx + 1
      };
    }).sort((a, b) => b.backlinksCount - a.backlinksCount);
  }, [filteredWorks]);

  // Tab 4: Aggregated backlinks list
  const backlinksAggregated = useMemo(() => {
    const listingsSum = filteredWorks.reduce((sum, w) => sum + (w.listingCount || 0), 0);
    const blogsSum = filteredWorks.reduce((sum, w) => sum + (w.blogCount || 0), 0);
    const forumsSum = filteredWorks.reduce((sum, w) => sum + (w.forumCount || 0), 0);
    const pdfsSum = filteredWorks.reduce((sum, w) => sum + (w.pdfCount || 0), 0);
    const imagesSum = filteredWorks.reduce((sum, w) => sum + (w.imageCount || 0), 0);
    const videoPptsSum = filteredWorks.reduce((sum, w) => sum + (w.videoPptCount || 0), 0);
    const profilesSum = filteredWorks.reduce((sum, w) => sum + (w.profileCount || 0), 0);
    const linksSum = filteredWorks.reduce((sum, w) => sum + (w.linkCount || 0), 0);
    const totalSum = listingsSum + blogsSum + forumsSum + pdfsSum + imagesSum + videoPptsSum + profilesSum + linksSum;

    const distribution = [
      { type: 'Blogs Submissions', count: blogsSum, color: 'bg-emerald-600', text: 'text-emerald-700' },
      { type: 'Listings Backlinks', count: listingsSum, color: 'bg-indigo-600', text: 'text-indigo-700' },
      { type: 'Forum Submissions', count: forumsSum, color: 'bg-teal-600', text: 'text-teal-700' },
      { type: 'PDF Press Releases', count: pdfsSum, color: 'bg-amber-600', text: 'text-amber-700' },
      { type: 'Image Content Assets', count: imagesSum, color: 'bg-rose-500', text: 'text-rose-700' },
      { type: 'Video / PPT Uploads', count: videoPptsSum, color: 'bg-sky-600', text: 'text-sky-700' },
      { type: 'Profile Creations', count: profilesSum, color: 'bg-orange-600', text: 'text-orange-705' },
      { type: 'Link Submissions', count: linksSum, color: 'bg-fuchsia-600', text: 'text-fuchsia-700' }
    ];

    return {
      distribution,
      totalSum
    };
  }, [filteredWorks]);

  // Tab 5: Unworked project list (projects without any work in filtered dataset)
  const [unworkedFilter, setUnworkedFilter] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [selectedPlanProject, setSelectedPlanProject] = useState<{ id: string; name: string; domain?: string } | null>(null);
  const [planMessage, setPlanMessage] = useState('');

  const unworkedProjects = useMemo(() => {
    // Current date reference for calculation (as specified by system context: 2026-06-16)
    const today = new Date('2026-06-16');

    return filteredProjectsForMetrics.map((p) => {
      // Find all submissions for this project cross-matching DSR works
      const pWorks = filteredWorks.filter(w => w.projectId === p.id);

      let lastWorkedDateStr = 'Never';
      let daysSinceLastWorked = Infinity;

      if (pWorks.length > 0) {
        const sortedDates = [...pWorks]
          .map(w => w.date)
          .filter(Boolean)
          .sort((a, b) => b.localeCompare(a));
        if (sortedDates.length > 0) {
          lastWorkedDateStr = sortedDates[0];
          
          try {
            const workDate = new Date(lastWorkedDateStr);
            const timeDiff = today.getTime() - workDate.getTime();
            const diffDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
            daysSinceLastWorked = diffDays >= 0 ? diffDays : 0;
          } catch (e) {
            // fallback
          }
        }
      }

      return {
        id: p.id,
        name: p.name,
        code: p.code,
        domain: p.domain || '',
        lastWorkedDate: lastWorkedDateStr,
        daysSinceLastWorked: daysSinceLastWorked,
      };
    }).filter(proj => {
      const threshold = unworkedFilter === 'daily' ? 1 : unworkedFilter === 'weekly' ? 7 : 30;
      return proj.daysSinceLastWorked >= threshold;
    }).map((p, idx) => ({
      ...p,
      srNo: idx + 1
    }));
  }, [filteredProjectsForMetrics, filteredWorks, unworkedFilter]);

  const keywordStats = useMemo(() => {
    interface KeywordItem {
      id: string;
      projName: string;
      code: string;
      priority: string;
      frequency: string;
      domain: string;
      keyword: string;
      ranking: string;
      timesWorked: number;
      lastWorkedDate: string;
    }
    
    const items: KeywordItem[] = [];
    
    filteredProjectsForMetrics.forEach((proj) => {
      const kws = Array.isArray(proj.keywords) ? proj.keywords.filter(Boolean) : [];
      kws.forEach((kw) => {
        let timesWorked = 0;
        let lastWorked = 'Never';
        
        filteredWorks.forEach((work) => {
          if (work.projectId === proj.id) {
            const hasKeyword = Array.isArray(work.selectedKeywords) && work.selectedKeywords.includes(kw);
            if (hasKeyword) {
              timesWorked++;
              if (lastWorked === 'Never' || work.date > lastWorked) {
                lastWorked = work.date;
              }
            }
          }
        });
        
        items.push({
          id: `${proj.id}-${kw}`,
          projName: proj.name,
          code: proj.code || '',
          priority: proj.priority || '',
          frequency: proj.frequency ? String(proj.frequency) : '',
          domain: proj.domain || '',
          keyword: kw,
          ranking: '', // blank for now as requested
          timesWorked,
          lastWorkedDate: lastWorked
        });
      });
    });
    
    return items.map((item, index) => ({
      ...item,
      srNo: index + 1
    }));
  }, [filteredProjectsForMetrics, filteredWorks]);

  const filteredKeywordStats = useMemo(() => {
    if (!keywordSearchTerm.trim()) return keywordStats;
    const term = keywordSearchTerm.toLowerCase();
    return keywordStats.filter(item => 
      item.keyword.toLowerCase().includes(term) || 
      item.projName.toLowerCase().includes(term) || 
      item.domain.toLowerCase().includes(term)
    ).map((item, idx) => ({ ...item, srNo: idx + 1 }));
  }, [keywordStats, keywordSearchTerm]);

  const toggleProjectStats = (projId: string) => {
    setExpandedProjectStats(prev => ({
      ...prev,
      [projId]: !prev[projId]
    }));
  };

  const tabsInfo = [
    { id: 'project_table' as const, label: 'Project Table', icon: FileSpreadsheet },
    { id: 'frequency' as const, label: 'Frequency', icon: Clock },
    { id: 'activity' as const, label: isAdmin ? 'Team Activity' : 'Activity', icon: Calendar },
    { id: 'backlinks' as const, label: 'Backlinks', icon: Percent },
    { id: 'unworked_project' as const, label: 'Unworked Projects', icon: FolderOpen },
    { id: 'keyword_section' as const, label: 'Keywords', icon: Tag }
  ];

  return (
    <div className="space-y-6 animate-fade-in text-left">
      


      {/* Workspace Filters panel - ON TOP OF PAGE */}
      <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="text-indigo-600 shrink-0" size={14} />
            <span className="text-xs font-black text-gray-900 uppercase tracking-wider">Workspace Filters</span>
          </div>
          {(selectedProjectIds.length > 0 || selectedUsers.length > 0 || regionFilter !== 'All' || selectedLocations.length > 0 || dateFilterType !== 'all' || commonSearchTerm !== '') && (
            <button
              onClick={handleResetFilters}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-all"
            >
              <X size={11} className="shrink-0" />
              Reset Workspace Filters
            </button>
          )}
        </div>

        {/* Dynamic Common Search Bar */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search size={14} />
          </span>
          <input
            type="text"
            value={commonSearchTerm}
            onChange={(e) => setCommonSearchTerm(e.target.value)}
            placeholder="Search across project name, code, domain, location, users, task summaries..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:bg-slate-100/50 transition cursor-text text-gray-950"
          />
          {commonSearchTerm && (
            <button
              type="button"
              onClick={() => setCommonSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] font-black text-indigo-600 hover:text-indigo-850"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 pt-1`}>
          
          {/* Block 1: Date Filter */}
          <div className="flex flex-col gap-1.5 bg-slate-50/40 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 leading-none">
              <Calendar size={11} className="text-gray-400" />
              Date Filter
            </span>
            <div className="space-y-1.5">
              <select
                value={dateFilterType}
                onChange={(e) => setDateFilterType(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-950 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 transition cursor-pointer h-[30px]"
              >
                <option value="all">Every Date (All Time)</option>
                <option value="today">Today Only</option>
                <option value="yesterday">Yesterday Only</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="custom">Custom Range...</option>
              </select>

              {dateFilterType === 'custom' && (
                <div className="flex flex-col gap-1 mt-1 bg-white p-1.5 border border-indigo-100 rounded-lg">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-1.5 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold text-gray-900 cursor-pointer"
                    title="Start Date"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-1.5 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold text-gray-900 cursor-pointer"
                    title="End Date"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Block 2: Region Control */}
          <div className="flex flex-col gap-1.5 bg-slate-50/40 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1 leading-none">
              <TrendingUp size={11} className="text-gray-400" />
              Region Control
            </span>
            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 select-none h-[34px] items-center gap-1">
              {[
                { label: 'WEST', value: 'West' },
                { label: 'ALL', value: 'All' },
                { label: 'NORTH', value: 'North' }
              ].map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRegionFilter(r.value)}
                  className={`flex-1 text-center py-1.5 text-[10px] tracking-wider font-extrabold transition-all duration-200 rounded-lg cursor-pointer ${
                    regionFilter === r.value
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Block 3: Project Allocation with multi-select list and local search */}
          <div className="flex flex-col gap-1.5 bg-slate-50/40 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 leading-none">
              <Tag size={11} className="text-gray-400" />
              Project Allocation
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsProjectDropdownOpen(!isProjectDropdownOpen);
                  setIsUserDropdownOpen(false);
                  setIsLocationDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-950 font-bold focus:outline-none transition hover:bg-gray-50 h-[30px]"
              >
                <span className="truncate pr-1">
                  {selectedProjectIds.length === 0 
                    ? 'All Projects' 
                    : `${selectedProjectIds.length} selected`}
                </span>
                <ChevronDown size={12} className={`text-gray-400 transition-transform shrink-0 ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProjectDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProjectDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 left-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-2.5 space-y-2 max-h-56 overflow-y-auto">
                    <div className="flex items-center justify-between text-[9px] pb-1 border-b border-gray-100 font-bold text-gray-400">
                      <span>PROJECTS</span>
                      <div className="flex gap-2">
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setSelectedProjectIds([]); }} 
                          className="text-indigo-600 hover:text-indigo-850"
                        >
                          Clear
                        </button>
                        <span>•</span>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setSelectedProjectIds(userProjects.map(p => p.id)); }} 
                          className="text-indigo-600 hover:text-indigo-850"
                        >
                          All
                        </button>
                      </div>
                    </div>
                    
                    {/* Small Search Bar */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={projectSearchTerm}
                        onChange={(e) => setProjectSearchTerm(e.target.value)}
                        placeholder="Search project..."
                        className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-555 text-gray-950 placeholder-gray-400"
                      />
                    </div>

                    <div className="space-y-0.5 max-h-36 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                      {userProjects
                        .filter(p => p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) || p.code.toLowerCase().includes(projectSearchTerm.toLowerCase()))
                        .map((p) => {
                          const isChecked = selectedProjectIds.includes(p.id);
                          return (
                            <div key={p.id} className="flex items-center justify-between p-1 rounded hover:bg-gray-50 transition-colors">
                              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-800 font-bold grow select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedProjectIds(selectedProjectIds.filter(id => id !== p.id));
                                    } else {
                                      setSelectedProjectIds([...selectedProjectIds, p.id]);
                                    }
                                  }}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="truncate">{p.name}</span>
                              </label>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Block 4: Dynamic Location drop down filter based on the particular user's projects */}
          <div className="flex flex-col gap-1.5 bg-slate-50/40 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 leading-none">
              <MapPin size={11} className="text-gray-400" />
              Location
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsLocationDropdownOpen(!isLocationDropdownOpen);
                  setIsProjectDropdownOpen(false);
                  setIsUserDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-950 font-bold focus:outline-none transition hover:bg-gray-50 h-[30px]"
              >
                <span className="truncate pr-1">
                  {selectedLocations.length === 0 
                    ? 'All Locations' 
                    : `${selectedLocations.length} selected`}
                </span>
                <ChevronDown size={12} className={`text-gray-400 transition-transform shrink-0 ${isLocationDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isLocationDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsLocationDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 left-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-2.5 space-y-2 max-h-56 overflow-y-auto font-sans">
                    <div className="flex items-center justify-between text-[9px] pb-1 border-b border-gray-100 font-bold text-gray-400">
                      <span>LOCATIONS</span>
                      <div className="flex gap-2">
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setSelectedLocations([]); }} 
                          className="text-indigo-600 hover:text-indigo-850"
                        >
                          Clear
                        </button>
                        <span>•</span>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setSelectedLocations(availableLocations); }} 
                          className="text-indigo-600 hover:text-indigo-850"
                        >
                          All
                        </button>
                      </div>
                    </div>
                    
                    {/* Small Search Bar */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={locationSearchTerm}
                        onChange={(e) => setLocationSearchTerm(e.target.value)}
                        placeholder="Search location..."
                        className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-950 placeholder-gray-400"
                      />
                    </div>

                    <div className="space-y-0.5 max-h-36 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                      {availableLocations
                        .filter(loc => loc.toLowerCase().includes(locationSearchTerm.toLowerCase()))
                        .map((loc) => {
                          const isChecked = selectedLocations.includes(loc);
                          return (
                            <div key={loc} className="flex items-center justify-between p-1 rounded hover:bg-gray-50 transition-colors">
                              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-800 font-bold grow select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedLocations(selectedLocations.filter(item => item !== loc));
                                    } else {
                                      setSelectedLocations([...selectedLocations, loc]);
                                    }
                                  }}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="truncate">{loc}</span>
                              </label>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Block 5: Filter by User/Users (Admin Only) */}
          {isAdmin && (
            <div className="flex flex-col gap-1.5 bg-slate-50/40 p-2.5 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 leading-none">
                <Users size={11} className="text-gray-400" />
                Users
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserDropdownOpen(!isUserDropdownOpen);
                    setIsProjectDropdownOpen(false);
                    setIsLocationDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-950 font-bold focus:outline-none transition hover:bg-gray-50 h-[30px]"
                >
                  <span className="truncate pr-1">
                    {selectedUsers.length === 0 
                      ? 'All Users' 
                      : `${selectedUsers.length} selected`}
                  </span>
                  <ChevronDown size={12} className={`text-gray-400 transition-transform shrink-0 ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isUserDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsUserDropdownOpen(false)} 
                    />
                    <div className="absolute right-0 left-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-2.5 space-y-2 max-h-56 overflow-y-auto">
                      <div className="flex items-center justify-between text-[9px] pb-1 border-b border-gray-105 font-bold text-gray-400 font-sans">
                        <span>USERS</span>
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setSelectedUsers([]); }} 
                            className="text-indigo-600 hover:text-indigo-850"
                          >
                            Clear
                          </button>
                          <span>•</span>
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setSelectedUsers(allUsersList.map(u => u.email)); }} 
                            className="text-indigo-600 hover:text-indigo-850"
                          >
                            All
                          </button>
                        </div>
                      </div>

                      {/* Small Search Bar */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          placeholder="Search user..."
                          className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-950 placeholder-gray-400"
                        />
                      </div>

                      <div className="space-y-0.5 max-h-36 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        {allUsersList
                          .filter(u => u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) || u.email.toLowerCase().includes(userSearchTerm.toLowerCase()))
                          .map((u) => {
                            const isChecked = selectedUsers.includes(u.email);
                            return (
                              <div key={u.email} className="flex items-center justify-between p-1 rounded hover:bg-gray-50 transition-colors">
                                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-800 font-bold grow select-none">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedUsers(selectedUsers.filter(em => em !== u.email));
                                      } else {
                                        setSelectedUsers([...selectedUsers, u.email]);
                                      }
                                    }}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <span className="truncate">{u.name}</span>
                                </label>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>


      {/* 5 Horizontal Buttons Tab Selection Bar - Premium, Larger & Highly Professional */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl flex flex-wrap gap-2 border border-slate-200/60 shadow-inner">
        {tabsInfo.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs sm:text-[13px] font-extrabold uppercase tracking-wider transition-all duration-200 select-none cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md border-b-2 border-indigo-800 font-black'
                  : 'bg-transparent text-slate-650 hover:text-indigo-600 hover:bg-white/60'
              }`}
            >
              <IconComponent size={15} className={`transition-transform duration-200 ${isActive ? 'text-white scale-110' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Section corresponding to Selected Tab */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-3xs overflow-hidden">
        
        {activeTab === 'project_table' && (
          <div>
            <div className="p-4 bg-gray-50/50 border-b border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Live Projects Worklist</h3>

              </div>
              <div className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                Sorted by original declaration index
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50/55 text-slate-500 font-extrabold text-[10px] uppercase border-b border-gray-150">
                  <tr>
                    <th className="px-4 py-3 w-14">Sr No.</th>
                    <th className="px-4 py-3">Project Name</th>
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3 w-28">Priority</th>
                    <th className="px-4 py-3 w-28 text-center">SEO Stats</th>
                    <th className="px-4 py-3 w-32 text-center">Times Worked</th>
                    <th className="px-4 py-3 w-36">Last Worked</th>
                    {isAdmin && <th className="px-4 py-3">Assigned To</th>}
                    {isAdmin && <th className="px-4 py-3 w-44">Admin Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {projectTableData.map((item) => {
                    const isExpanded = !!expandedProjectStats[item.id];
                    return (
                      <React.Fragment key={item.id}>
                        {/* Main row */}
                        <tr className="hover:bg-slate-50/40 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-gray-400">{item.srNo}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                              {item.domain}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {item.priority === 'P1' && (
                              <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-black px-2 py-0.5 rounded border border-red-100 uppercase tracking-wider">
                                🚨 P1 High
                              </span>
                            )}
                            {item.priority === 'P2' && (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded border border-amber-100 uppercase tracking-wider">
                                ⚡ P2 Med
                              </span>
                            )}
                            {item.priority === 'P3' && (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                                🟢 P3 Low
                              </span>
                            )}
                            {!['P1', 'P2', 'P3'].includes(item.priority || '') && (
                              <span className="text-[10px] font-bold text-gray-400 italic">
                                — none —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleProjectStats(item.id)}
                              className="inline-flex items-center gap-1.5 bg-indigo-50/50 hover:bg-indigo-100/75 text-indigo-800 font-bold px-2 py-1 rounded border border-indigo-100 transition duration-75 text-[11px] cursor-pointer"
                              title="Click to toggle cumulative backlog stats"
                            >
                              <span>Stats</span>
                              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-gray-700">
                            {item.timesWorked}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-semibold text-gray-600">
                              {item.lastWorked}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <span className="text-gray-950 bg-slate-50 border border-slate-200/50 rounded px-2.5 py-1 text-[10px] select-all font-bold">
                                {getAssignedUsersForProject(item.id)}
                              </span>
                            </td>
                          )}
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={item.priority || ''}
                                  onChange={(e) => {
                                    const pVal = e.target.value;
                                    const orig = projects.find(pr => pr.id === item.id);
                                    if (orig && onUpdateProject) {
                                      onUpdateProject({ ...orig, priority: pVal });
                                    }
                                  }}
                                  className="px-1.5 py-0.5 text-[10px] font-bold bg-white border border-gray-200 rounded text-gray-800 cursor-pointer focus:outline-none"
                                >
                                  <option value="">- Priority -</option>
                                  <option value="P1">P1</option>
                                  <option value="P2">P2</option>
                                  <option value="P3">P3</option>
                                </select>
                              </div>
                            </td>
                          )}
                        </tr>

                        {/* Expandable distribution details sub-row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/30">
                            <td colSpan={isAdmin ? 9 : 7} className="px-6 py-3 border-t border-b border-gray-150">
                              <div className="bg-white p-3.5 rounded-xl border border-gray-150 space-y-3.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                                    📊 Detailed SEO Volumetrics for <span className="text-indigo-650 font-black">{item.name}</span>
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-medium">Cumulative numbers</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="bg-indigo-50/10 p-2.5 rounded-lg border border-indigo-100/50">
                                    <span className="block text-[9px] font-bold text-indigo-700 uppercase">Listings</span>
                                    <span className="block text-base font-extrabold text-indigo-950 font-mono mt-0.5">{item.listings}</span>
                                  </div>
                                  <div className="bg-emerald-50/15 p-2.5 rounded-lg border border-emerald-100/50">
                                    <span className="block text-[9px] font-bold text-emerald-800 uppercase">Blogs</span>
                                    <span className="block text-base font-extrabold text-emerald-950 font-mono mt-0.5">{item.blogs}</span>
                                  </div>
                                  <div className="bg-teal-50/15 p-2.5 rounded-lg border border-teal-100/50">
                                    <span className="block text-[9px] font-bold text-teal-800 uppercase">PDFs</span>
                                    <span className="block text-base font-extrabold text-teal-900 font-mono mt-0.5">{item.pdfs}</span>
                                  </div>
                                  <div className="bg-rose-50/15 p-2.5 rounded-lg border border-rose-100/50">
                                    <span className="block text-[9px] font-bold text-rose-700 uppercase">Images</span>
                                    <span className="block text-base font-extrabold text-rose-950 font-mono mt-0.5">{item.images}</span>
                                  </div>
                                </div>
                                <div className="text-[10px] text-gray-500 italic">
                                  ✓ Reports synchronized from developer spreadsheets and individual task forms successfully.
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'frequency' && (
          <div>
            <div className="p-4 bg-gray-50/50 border-b border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Report Frequency Index</h3>

              </div>

              {/* Dynamic Period Slider Filter Option */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/60 shadow-inner h-[32px]">
                <button
                  type="button"
                  onClick={() => setFreqFilterType('daily')}
                  className={`px-3 py-1 text-[11px] font-extrabold rounded-lg uppercase tracking-wider transition-all duration-150 select-none cursor-pointer text-center ${
                    freqFilterType === 'daily'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setFreqFilterType('weekly')}
                  className={`px-3 py-1 text-[11px] font-extrabold rounded-lg uppercase tracking-wider transition-all duration-150 select-none cursor-pointer text-center ${
                    freqFilterType === 'weekly'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setFreqFilterType('monthly')}
                  className={`px-3 py-1 text-[11px] font-extrabold rounded-lg uppercase tracking-wider transition-all duration-150 select-none cursor-pointer text-center ${
                    freqFilterType === 'monthly'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-slate-50/55 text-slate-500 font-extrabold text-[10px] uppercase border-b border-gray-150">
                  <tr>
                    <th className="px-4 py-3 w-14">Sr No.</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3 text-center">Assigned Frequency</th>
                    <th className="px-4 py-3 text-center">Worked Frequency</th>
                    <th className="px-4 py-3 text-center">Total Times Worked</th>
                    {isAdmin && <th className="px-4 py-3">Assigned To</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {frequencyData.map((item) => {
                    const timesWorked = item.timesWorked;

                    // Calculate frequency expression
                    let factor = 1;
                    let suffix = 'd';
                    if (freqFilterType === 'weekly') {
                      factor = 7;
                      suffix = 'w';
                    } else if (freqFilterType === 'monthly') {
                      factor = 30;
                      suffix = 'm';
                    }
                    const rate = (timesWorked / (timeSpanDays || 1)) * factor;
                    const formattedRate = rate % 1 === 0 ? rate.toFixed(0) : rate.toFixed(1);
                    const freqValue = `${formattedRate}/${suffix}`;

                    const assignedToName = getAssignedUsersForProject(item.id);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-gray-400">{item.srNo}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900">
                            {item.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-gray-600">
                          {item.domain ? (
                            <a 
                              href={`https://${item.domain}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-indigo-600 hover:underline inline-flex items-center gap-1"
                            >
                              {item.domain}
                            </a>
                          ) : (
                            <span className="text-gray-350 italic font-normal text-[11px]">No Domain</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center animate-fade-in">
                          {isAdmin ? (
                            <div className="flex items-center justify-center gap-1 mx-auto">
                              <input
                                type="number"
                                min="0"
                                max="14"
                                placeholder="..."
                                value={item.assignedFrequency !== undefined && item.assignedFrequency !== null ? item.assignedFrequency : ''}
                                onChange={(e) => {
                                  const nextFreq = e.target.value;
                                  const orig = projects.find(pr => pr.id === item.id);
                                  if (orig && onUpdateProject) {
                                    onUpdateProject({ ...orig, frequency: nextFreq });
                                  }
                                }}
                                className="w-14 px-1.5 py-1 text-xs font-mono text-center font-bold bg-white border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[28px]"
                              />
                              <span className="text-gray-400 font-bold text-[10px]">/ wk</span>
                            </div>
                          ) : (
                            item.assignedFrequency ? (
                              <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 text-[10px] uppercase tracking-wider">
                                {item.assignedFrequency}
                              </span>
                            ) : (
                              <span className="text-gray-350 italic font-normal text-[11px]">Unassigned</span>
                            )
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono font-black text-indigo-700 bg-indigo-50/60 px-3 py-1 rounded-lg border border-indigo-100 text-xs shadow-xs">
                            {freqValue}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-gray-700">
                          {timesWorked}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <span className="font-bold text-gray-650 bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-lg">
                              {assignedToName}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div>
            <div className="p-4 bg-gray-50/50 border-b border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block animate-pulse"></span>
                  {isAdmin ? 'Team Activity Heatmap' : 'Personal Activity Calendar'}
                </h3>

              </div>

              {/* Month Selector Controls */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-inner h-[32px] self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    if (heatmapMonth === 0) {
                      setHeatmapMonth(11);
                      setHeatmapYear(prev => prev - 1);
                    } else {
                      setHeatmapMonth(prev => prev - 1);
                    }
                  }}
                  className="px-2 py-1 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  <ChevronDown className="rotate-90" size={13} />
                </button>
                <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-700 min-w-[110px] text-center select-none">
                  {monthNames[heatmapMonth]} {heatmapYear}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (heatmapMonth === 11) {
                      setHeatmapMonth(0);
                      setHeatmapYear(prev => prev + 1);
                    } else {
                      setHeatmapMonth(prev => prev + 1);
                    }
                  }}
                  className="px-2 py-1 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  <ChevronUp className="rotate-90" size={13} />
                </button>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Side: Calendar Heatmap Grid */}
              <div className="lg:col-span-7 bg-slate-50/50 p-5 rounded-2xl border border-slate-150/60 shadow-inner">
                {/* Day labels header */}
                <div className="grid grid-cols-7 gap-2 mb-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <div>Sun</div>
                  <div>Mon</div>
                  <div>Tue</div>
                  <div>Wed</div>
                  <div>Thu</div>
                  <div>Fri</div>
                  <div>Sat</div>
                </div>

                {/* Calendar Grid cells */}
                <div className="grid grid-cols-7 gap-2">
                  {monthDays.blanks.map((_, idx) => (
                    <div 
                      key={`blank-${idx}`} 
                      className="aspect-square bg-slate-50/30 rounded-xl border border-dashed border-slate-200/20 opacity-20 select-none"
                    />
                  ))}
                  
                  {monthDays.days.map((day) => {
                    const dateStr = `${heatmapYear}-${String(heatmapMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = selectedCalendarDay === dateStr;
                    
                    // Filter items for this day while ignoring date range constraints to allow monthly display
                    const dayWorks = enrichedWorks.filter((work) => {
                      if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(work.projectId)) {
                        return false;
                      }
                      if (isAdmin && selectedUsers.length > 0) {
                        if (!work.userEmail || !selectedUsers.includes(work.userEmail.toLowerCase().trim())) {
                          return false;
                        }
                      }
                      if (regionFilter !== 'All' && work.region !== regionFilter) {
                        return false;
                      }
                      if (selectedLocations.length > 0) {
                        const matchesLocation = work.allProjectLocations.length > 0 
                          ? work.allProjectLocations.some(loc => selectedLocations.includes(loc))
                          : selectedLocations.includes(work.location);
                        if (!matchesLocation) return false;
                      }
                      if (commonSearchTerm.trim()) {
                        const term = commonSearchTerm.toLowerCase().trim();
                        const proj = projects.find(p => p.id === work.projectId);
                        const projectName = proj ? proj.name.toLowerCase() : '';
                        const projectCode = proj ? proj.code.toLowerCase() : '';
                        const projectDomain = proj?.domain ? proj.domain.toLowerCase() : '';
                        const userEmail = work.userEmail?.toLowerCase() || '';
                        const userName = (employeeEmailToNameMap[userEmail] || '').toLowerCase();
                        const location = work.location?.toLowerCase() || '';
                        const workSummary = work.workSummary?.toLowerCase() || '';
                        if (
                          !projectName.includes(term) &&
                          !projectCode.includes(term) &&
                          !projectDomain.includes(term) &&
                          !userEmail.includes(term) &&
                          !userName.includes(term) &&
                          !location.includes(term) &&
                          !workSummary.includes(term)
                        ) {
                          return false;
                        }
                      }
                      return work.date === dateStr;
                    });

                    const totalUpdates = dayWorks.length;
                    const totalBacklinks = dayWorks.reduce((sum, w) => sum + (Number(w.listingCount) || 0) + (Number(w.blogCount) || 0) + (Number(w.forumCount) || 0) + (Number(w.pdfCount) || 0) + (Number(w.imageCount) || 0) + (Number(w.videoPptCount) || 0) + (Number(w.profileCount) || 0) + (Number(w.linkCount) || 0), 0);

                    // Assign premium indigo contributions heatmap colors based on task density
                    let heatClass = 'bg-slate-50 hover:bg-slate-100/80 text-slate-400 border border-slate-200/50 hover:border-slate-300';
                    let dayNumClass = 'text-slate-450';
                    if (totalUpdates > 0) {
                      if (totalUpdates <= 2) {
                        heatClass = 'bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 shadow-2xs';
                        dayNumClass = 'text-indigo-800 font-extrabold';
                      } else if (totalUpdates <= 4) {
                        heatClass = 'bg-indigo-100 border border-indigo-250 text-indigo-850 hover:bg-indigo-200 shadow-2xs';
                        dayNumClass = 'text-indigo-900 font-black';
                      } else {
                        heatClass = 'bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 shadow-xs scale-102';
                        dayNumClass = 'text-indigo-50';
                      }
                    }

                    return (
                      <button
                        key={`day-${day}`}
                        type="button"
                        onClick={() => setSelectedCalendarDay(dateStr)}
                        className={`aspect-square rounded-2xl p-2.5 flex flex-col justify-between transition-all duration-300 ease-out cursor-pointer text-left select-none relative group hover:-translate-y-0.5 active:scale-95 ${heatClass} ${
                          isSelected ? 'ring-3 ring-indigo-500 ring-offset-2 scale-105 z-20 font-bold' : ''
                        }`}
                      >
                        {/* Day Number */}
                        <span className={`text-[11px] font-black tracking-tight ${dayNumClass}`}>
                          {day}
                        </span>

                        {/* Work indicator center counts */}
                        {totalUpdates > 0 && (
                          <div className="flex flex-col items-end leading-none text-right">
                            <span className="text-xs sm:text-[14px] font-black tracking-tighter">
                              {totalUpdates}
                            </span>
                          </div>
                        )}
                        
                        {/* Micro-tooltip */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-950 border border-slate-800 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl shadow-xl whitespace-nowrap z-30 leading-none">
                          {totalUpdates} task {totalUpdates === 1 ? 'update' : 'updates'} • {totalBacklinks} {totalBacklinks === 1 ? 'backlink' : 'backlinks'}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Heatmap intensity legend with Indigo representations */}
                <div className="mt-5 pt-4 border-t border-slate-150 flex flex-col sm:flex-row gap-3 items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 font-extrabold text-slate-400 uppercase tracking-wider">
                    <Activity size={12} className="text-indigo-600 animate-pulse" />
                    <span>Select any active grid block to view detailed task logging feed</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-400">
                    <span>No Work</span>
                    <div className="w-3.5 h-3.5 rounded-lg bg-slate-50 border border-slate-200" />
                    <div className="w-3.5 h-3.5 rounded-lg bg-indigo-50 border border-indigo-200" />
                    <div className="w-3.5 h-3.5 rounded-lg bg-indigo-100 border border-indigo-250" />
                    <div className="w-3.5 h-3.5 rounded-lg bg-indigo-600 border border-indigo-700" />
                    <span>Peak Update Density</span>
                  </div>
                </div>
              </div>

              {/* Right Side: Logged work entries history details for clicked day, OR selected month stats */}
              <div className="lg:col-span-5 flex flex-col justify-between">
                <div>
                  {selectedCalendarDay ? (() => {
                    const dayWorks = enrichedWorks.filter((work) => {
                      if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(work.projectId)) {
                        return false;
                      }
                      if (isAdmin && selectedUsers.length > 0) {
                        if (!work.userEmail || !selectedUsers.includes(work.userEmail.toLowerCase().trim())) {
                          return false;
                        }
                      }
                      if (regionFilter !== 'All' && work.region !== regionFilter) {
                        return false;
                      }
                      if (selectedLocations.length > 0) {
                        const matchesLocation = work.allProjectLocations.length > 0 
                          ? work.allProjectLocations.some(loc => selectedLocations.includes(loc))
                          : selectedLocations.includes(work.location);
                        if (!matchesLocation) return false;
                      }
                      if (commonSearchTerm.trim()) {
                        const term = commonSearchTerm.toLowerCase().trim();
                        const proj = projects.find(p => p.id === work.projectId);
                        const projectName = proj ? proj.name.toLowerCase() : '';
                        const projectCode = proj ? proj.code.toLowerCase() : '';
                        const projectDomain = proj?.domain ? proj.domain.toLowerCase() : '';
                        const userEmail = work.userEmail?.toLowerCase() || '';
                        const userName = (employeeEmailToNameMap[userEmail] || '').toLowerCase();
                        const location = work.location?.toLowerCase() || '';
                        const workSummary = work.workSummary?.toLowerCase() || '';
                        if (
                          !projectName.includes(term) &&
                          !projectCode.includes(term) &&
                          !projectDomain.includes(term) &&
                          !userEmail.includes(term) &&
                          !userName.includes(term) &&
                          !location.includes(term) &&
                          !workSummary.includes(term)
                        ) {
                          return false;
                        }
                      }
                      return work.date === selectedCalendarDay;
                    });
                    
                    const [y, m, d] = selectedCalendarDay.split('-');
                    const formattedDateObj = new Date(Number(y), Number(m) - 1, Number(d));
                    const readableSelectedDate = formattedDateObj.toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <div className="space-y-4 text-left">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-slate-450 uppercase tracking-widest">
                            Daily Logged Details
                          </h4>
                        </div>
                        
                        <div className="bg-indigo-50/40 p-4.5 rounded-2xl border border-indigo-100 shadow-2xs space-y-2.5">
                          <span className="text-xs font-black text-indigo-700 tracking-tight block uppercase">
                            {readableSelectedDate}
                          </span>
                          <div className="flex gap-3">
                            <div className="text-center bg-white border border-slate-150 py-2 px-3 rounded-xl flex-1 shadow-3xs">
                              <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Content Updates</span>
                              <span className="text-sm font-black text-slate-800">{dayWorks.length}</span>
                            </div>
                            <div className="text-center bg-white border border-slate-150 py-2 px-3 rounded-xl flex-1 shadow-3xs">
                              <span className="block text-[8px] font-black uppercase text-indigo-600 tracking-wider">Backlinks</span>
                              <span className="text-sm font-black text-indigo-700">
                                {dayWorks.reduce((sum, w) => sum + (Number(w.listingCount) || 0) + (Number(w.blogCount) || 0) + (Number(w.forumCount) || 0) + (Number(w.pdfCount) || 0) + (Number(w.imageCount) || 0) + (Number(w.videoPptCount) || 0) + (Number(w.profileCount) || 0) + (Number(w.linkCount) || 0), 0)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                          {dayWorks.length === 0 ? (
                            <div className="text-center p-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-xl text-[11px] text-slate-400 italic">
                              No submissions logged on this date.
                            </div>
                          ) : (() => {
                            // Group works by projectId for the selected day
                            const worksByProject = dayWorks.reduce((acc, work) => {
                              const pId = work.projectId;
                              if (!acc[pId]) {
                                acc[pId] = [];
                              }
                              acc[pId].push(work);
                              return acc;
                            }, {} as Record<string, any[]>);

                            return Object.entries(worksByProject).map(([pId, pWorks]) => {
                              const typedWorks = pWorks as any[];
                              const firstWork = typedWorks[0];
                              const projectObj = projects.find(p => p.id === pId);
                              const projectName = projectObj?.name || firstWork.projectName;
                              const projectCode = projectObj?.code;
                              const projectDomain = projectObj?.domain;

                              // Aggregate counts for this project
                              let blogCount = 0;
                              let listingCount = 0;
                              let forumCount = 0;
                              let pdfCount = 0;
                              let imageCount = 0;
                              let videoPptCount = 0;
                              let profileCount = 0;
                              let linkCount = 0;
                              const customValues: Record<string, number> = {};

                              typedWorks.forEach(w => {
                                blogCount += Number(w.blogCount) || 0;
                                listingCount += Number(w.listingCount) || 0;
                                forumCount += Number(w.forumCount) || 0;
                                pdfCount += Number(w.pdfCount) || 0;
                                imageCount += Number(w.imageCount) || 0;
                                videoPptCount += Number(w.videoPptCount) || 0;
                                profileCount += Number(w.profileCount) || 0;
                                linkCount += Number(w.linkCount) || 0;

                                if (w.customValues) {
                                  Object.entries(w.customValues).forEach(([key, val]) => {
                                    customValues[key] = (customValues[key] || 0) + (Number(val) || 0);
                                  });
                                }
                              });

                              const reportersInvolved = Array.from(new Set(typedWorks.map(w => employeeEmailToNameMap[w.userEmail.toLowerCase()] || w.userEmail)));
                              const regionsInvolved = Array.from(new Set(typedWorks.map(w => w.region))).filter(Boolean);
                              const summaries = typedWorks.map(w => w.workSummary).filter(Boolean);

                              return (
                                <div key={pId} className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-2xs space-y-3.5 text-xs hover:bg-slate-50/50 transition-all text-left">
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <div className="font-extrabold text-slate-900 flex items-center flex-wrap gap-1.5 leading-tight">
                                        <span className="text-sm font-black text-slate-850">{projectName}</span>
                                        {projectCode && (
                                          <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                            {projectCode}
                                          </span>
                                        )}
                                        {projectDomain && (
                                          <a 
                                            href={`https://${projectDomain}`} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="text-indigo-600 hover:underline font-bold text-[10px] ml-1 inline-flex items-center"
                                          >
                                            {projectDomain}
                                          </a>
                                        )}
                                      </div>
                                      <div className="text-[10px] font-bold text-slate-400 mt-1">
                                        By {reportersInvolved.join(', ')}
                                      </div>
                                    </div>
                                    {regionsInvolved.length > 0 && (
                                      <span className="text-[9px] font-mono font-black border border-slate-200 bg-slate-50 px-1.5 py-0.5 rounded text-slate-500 uppercase leading-none shrink-0">
                                        {regionsInvolved.join(' / ')} Region
                                      </span>
                                    )}
                                  </div>

                                  {summaries.length > 0 && (
                                    <div className="space-y-1.5 pt-0.5">
                                      {summaries.map((summary, sIdx) => (
                                        <p key={sIdx} className="text-[11px] font-medium text-slate-650 bg-slate-50 border border-slate-150 p-2.5 rounded-xl leading-relaxed">
                                          {summary}
                                        </p>
                                      ))}
                                    </div>
                                  )}

                                  {/* Grid of backlinks count */}
                                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-[9px] font-black uppercase text-slate-400 tracking-tight text-center pt-1.5">
                                    <div className="bg-emerald-50/20 p-1.5 rounded border border-emerald-100/40 text-emerald-700">
                                      <span className="block text-[7px] font-bold text-emerald-400">Blogs</span>
                                      {blogCount}
                                    </div>
                                    <div className="bg-indigo-50/20 p-1.5 rounded border border-indigo-100/40 text-indigo-700">
                                      <span className="block text-[7px] font-bold text-indigo-400">Listings</span>
                                      {listingCount}
                                    </div>
                                    <div className="bg-teal-50/20 p-1.5 rounded border border-teal-100/40 text-teal-700 font-bold">
                                      <span className="block text-[7px] font-bold text-teal-400">Forum</span>
                                      {forumCount}
                                    </div>
                                    <div className="bg-amber-50/20 p-1.5 rounded border border-amber-100/40 text-amber-700">
                                      <span className="block text-[7px] font-bold text-amber-400">PDFs</span>
                                      {pdfCount}
                                    </div>
                                    <div className="bg-rose-50/20 p-1.5 rounded border border-rose-100/40 text-rose-700">
                                      <span className="block text-[7px] font-bold text-rose-455">Images</span>
                                      {imageCount}
                                    </div>
                                    <div className="bg-sky-50/20 p-1.5 rounded border border-sky-100/40 text-sky-700">
                                      <span className="block text-[7px] font-bold text-sky-455">Video/PPT</span>
                                      {videoPptCount}
                                    </div>
                                    <div className="bg-orange-50/20 p-1.5 rounded border border-orange-100/40 text-orange-700">
                                      <span className="block text-[7px] font-bold text-orange-455">Profile</span>
                                      {profileCount}
                                    </div>
                                    <div className="bg-fuchsia-50/20 p-1.5 rounded border border-fuchsia-100/40 text-fuchsia-700">
                                      <span className="block text-[7px] font-bold text-fuchsia-455">Links</span>
                                      {linkCount}
                                    </div>
                                    {customSubmissionTypes.map((type) => {
                                      const val = customValues[type.id] || 0;
                                      if (val === 0) return null;
                                      return (
                                        <div key={type.id} className="bg-purple-50/20 p-1.5 rounded border border-purple-100/40 text-purple-705">
                                          <span className="block text-[7px] font-bold text-purple-400 truncate" title={type.name}>{type.name}</span>
                                          {val}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    );
                  })() : (
                    // Default Month Statistics overview
                    <div className="space-y-4 text-left">
                      <h4 className="text-[10px] font-black text-slate-450 uppercase tracking-widest">
                        {monthNames[heatmapMonth]} Summary
                      </h4>
                      
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150/80 shadow-2xs space-y-4">
                        <div className="flex gap-2 items-center text-slate-700">
                          <Award size={15} className="shrink-0 text-indigo-600" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Monthly Aggregations</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-3xs">
                            <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Active Days</span>
                            <span className="text-base font-black text-slate-800 leading-none block mt-1">
                              {new Set(enrichedWorks.filter(w => {
                                const [y, m] = w.date.split('-');
                                return Number(y) === heatmapYear && (Number(m) - 1) === heatmapMonth;
                              }).map(w => w.date)).size} days
                            </span>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-3xs">
                            <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Total Tasks</span>
                            <span className="text-base font-black text-slate-800 leading-none block mt-1">
                              {enrichedWorks.filter(w => {
                                const [y, m] = w.date.split('-');
                                return Number(y) === heatmapYear && (Number(m) - 1) === heatmapMonth;
                              }).length} logs
                            </span>
                          </div>
                        </div>

                        <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-3xs space-y-1.5">
                          <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Monthly Backlinks Logged</span>
                          <div className="flex justify-between items-baseline">
                            <span className="text-xl font-black text-indigo-600 leading-none block">
                              {enrichedWorks.filter(w => {
                                const [y, m] = w.date.split('-');
                                return Number(y) === heatmapYear && (Number(m) - 1) === heatmapMonth;
                              }).reduce((sum, w) => sum + (Number(w.listingCount) || 0) + (Number(w.blogCount) || 0) + (Number(w.forumCount) || 0) + (Number(w.pdfCount) || 0) + (Number(w.imageCount) || 0) + (Number(w.videoPptCount) || 0) + (Number(w.profileCount) || 0) + (Number(w.linkCount) || 0), 0)}
                            </span>
                          </div>
                        </div>

                        <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-[10px] text-indigo-750 leading-relaxed font-bold">
                          Click any colored cell in the month calendar grid to see granular project breakouts, individual submitters, and tasks logged on those dates.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'backlinks' && (() => {
          // 1. Calculate active categories with count > 0 dynamically
          const listingsSum = backlinksFilteredWorks.reduce((sum, w) => sum + (w.listingCount || 0), 0);
          const blogsSum = backlinksFilteredWorks.reduce((sum, w) => sum + (w.blogCount || 0), 0);
          const forumsSum = backlinksFilteredWorks.reduce((sum, w) => sum + (w.forumCount || 0), 0);
          const pdfsSum = backlinksFilteredWorks.reduce((sum, w) => sum + (w.pdfCount || 0), 0);
          const imagesSum = backlinksFilteredWorks.reduce((sum, w) => sum + (w.imageCount || 0), 0);
          const videoPptsSum = backlinksFilteredWorks.reduce((sum, w) => sum + (w.videoPptCount || 0), 0);
          const profilesSum = backlinksFilteredWorks.reduce((sum, w) => sum + (w.profileCount || 0), 0);
          const linksSum = backlinksFilteredWorks.reduce((sum, w) => sum + (w.linkCount || 0), 0);

          const allCategories = [
            { name: 'Blog / Article', count: blogsSum, color: 'bg-emerald-500 hover:bg-emerald-600' },
            { name: 'Listings', count: listingsSum, color: 'bg-indigo-500 hover:bg-indigo-600' },
            { name: 'Forum', count: forumsSum, color: 'bg-teal-500 hover:bg-teal-600' },
            { name: 'PDF', count: pdfsSum, color: 'bg-amber-500 hover:bg-amber-600' },
            { name: 'Images', count: imagesSum, color: 'bg-rose-500 hover:bg-rose-600' },
            { name: 'Video / PPT', count: videoPptsSum, color: 'bg-sky-500 hover:bg-sky-600' },
            { name: 'Profile', count: profilesSum, color: 'bg-orange-500 hover:bg-orange-600' },
            { name: 'Links', count: linksSum, color: 'bg-fuchsia-500 hover:bg-fuchsia-600' },
            ...customSubmissionTypes.map(t => ({
              name: t.name,
              count: backlinksFilteredWorks.reduce((sum, w) => sum + (Number(w.customValues?.[t.id]) || 0), 0),
              color: 'bg-purple-500 hover:bg-purple-600'
            }))
          ];

          // Filter out categories with 0 data
          const activeCategories = allCategories.filter(cat => cat.count > 0);
          const counts = activeCategories.map(c => c.count);
          const maxCount = counts.length > 0 ? Math.max(...counts) : 0;
          const minCount = counts.length > 0 ? Math.min(...counts) : 0;

          // 2. Determine active columns for the distribution table (where total column sum > 0)
          const activeColumns = [
            { key: 'blogCount', label: 'Blog / Article', total: blogsSum },
            { key: 'listingCount', label: 'Listings', total: listingsSum },
            { key: 'forumCount', label: 'Forum', total: forumsSum },
            { key: 'pdfCount', label: 'PDF', total: pdfsSum },
            { key: 'imageCount', label: 'Images', total: imagesSum },
            { key: 'videoPptCount', label: 'Video / PPT', total: videoPptsSum },
            { key: 'profileCount', label: 'Profile', total: profilesSum },
            { key: 'linkCount', label: 'Links', total: linksSum },
            ...customSubmissionTypes.map(t => ({
              key: `custom_${t.id}`,
              label: t.name,
              total: backlinksFilteredWorks.reduce((acc, w) => acc + (Number(w.customValues?.[t.id]) || 0), 0)
            }))
          ].filter(col => col.total > 0);

          // 3. Project rows holding columns with non-zero elements
          const projectRows = filteredProjectsForMetrics.map(proj => {
            const projWorks = backlinksFilteredWorks.filter(w => w.projectId === proj.id);
            const countsMap: Record<string, number> = {};
            let total = 0;

            activeColumns.forEach(col => {
              let sum = 0;
              if (col.key.startsWith('custom_')) {
                const customId = col.key.replace('custom_', '');
                sum = projWorks.reduce((acc, w) => acc + (Number(w.customValues?.[customId]) || 0), 0);
              } else {
                sum = projWorks.reduce((acc, w) => acc + (Number(w[col.key as keyof typeof w]) || 0), 0);
              }
              countsMap[col.key] = sum;
              total += sum;
            });

            return {
              id: proj.id,
              name: proj.name,
              code: proj.code,
              domain: proj.domain || '',
              counts: countsMap,
              total
            };
          }).filter(row => row.total > 0);

          return (
            <div>
              <div className="p-4 bg-gray-50/50 border-b border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Backlink Distribution</h3>
                {isAdmin && (
                  <div className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1.5 font-bold">
                    <Users size={12} className="shrink-0 text-emerald-600" />
                    <span>Combined dataset containing all team submissions</span>
                  </div>
                )}
              </div>

              <div className="p-5 space-y-8 text-left">
                {/* 1. Horizontal bar graph */}
                <div className="bg-slate-50/40 p-6 border border-gray-100 rounded-2xl shadow-3xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">Work Type Ratio Distribution</h4>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    {activeCategories.length === 0 ? (
                      <div className="text-center py-10 text-xs text-gray-400 font-mono italic">
                        No report submissions with non-zero backlinks logged in the selected timeframe.
                      </div>
                    ) : (
                      activeCategories.map((cat, idx) => {
                        const percentage = maxCount > 0 ? (cat.count / maxCount) * 100 : 0;

                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                              <span className="flex items-center gap-2">
                                <span className="text-gray-900 font-extrabold">{cat.name}</span>
                              </span>
                              <span className="font-mono text-gray-800 text-xs font-black bg-white px-2 py-0.5 rounded border border-gray-150 shadow-3xs">{cat.count} backlinks</span>
                            </div>
                            <div className="h-4 w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200/60 p-0.5">
                              <div 
                                className={`h-full ${cat.color} rounded-md transition-all duration-500`}
                                style={{ width: `${Math.max(percentage, 4)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2. Project counts distribution table (excluding 0 count items) */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">
                      Project Backlink Type Distribution
                    </h4>
                  </div>

                  <div className="overflow-x-auto border border-gray-150 rounded-2xl shadow-3xs bg-white">
                    <table className="w-full text-left text-xs min-w-[700px]">
                      <thead className="bg-slate-50 border-b border-gray-150 text-[10px] text-gray-400 uppercase font-black tracking-wider">
                        <tr>
                          <th className="px-4 py-3.5 w-16">Sr No.</th>
                          <th className="px-4 py-3.5 w-1/4">Project Name</th>
                          <th className="px-4 py-3.5 w-1/4">Domain</th>
                          {isAdmin && <th className="px-4 py-3.5 text-left">Assigned To</th>}
                          {activeColumns.map((col, cIdx) => (
                            <th key={cIdx} className="px-4 py-3.5 text-center font-bold">{col.label}</th>
                          ))}
                          <th className="px-4 py-3.5 text-center bg-indigo-50/40 text-indigo-900 font-extrabold font-mono">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 font-semibold text-gray-700">
                        {projectRows.map((row, idx) => (
                          <tr key={row.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-4 py-3.5 font-mono text-gray-400 font-bold">{idx + 1}</td>
                            <td className="px-4 py-3.5">
                              <span className="font-bold text-gray-900 block">{row.name}</span>
                            </td>
                            <td className="px-4 py-3.5 font-mono text-gray-500">
                              {row.domain ? (
                                <a 
                                  href={`https://${row.domain}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-indigo-600 hover:underline font-bold"
                                >
                                  {row.domain}
                                </a>
                              ) : (
                                <span className="text-gray-300 italic font-normal text-[11px]">No Domain</span>
                              )}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3.5 font-bold text-gray-800 text-left">
                                <span className="text-gray-900 bg-slate-50 border border-slate-200/50 rounded px-2.5 py-1 text-[10px] select-all font-bold">
                                  {getAssignedUsersForProject(row.id)}
                                </span>
                              </td>
                            )}
                            {activeColumns.map((col, cIdx) => {
                              const count = row.counts[col.key] || 0;
                              return (
                                <td key={cIdx} className="px-4 py-3.5 text-center font-mono font-bold">
                                  {count > 0 ? (
                                    <span className="text-gray-900 text-xs font-extrabold">{count}</span>
                                  ) : (
                                    <span className="text-gray-250 font-normal">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3.5 text-center bg-indigo-50/10">
                              <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg text-xs border border-indigo-100 shadow-3xs">
                                {row.total}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {projectRows.length === 0 && (
                          <tr>
                            <td colSpan={3 + activeColumns.length + 1 + (isAdmin ? 1 : 0)} className="px-4 py-10 text-center text-gray-400 font-medium font-mono italic">
                              No backlink metrics logged for active projects in the selected timeframe.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'unworked_project' && (
          <div>
            <div className="p-4 bg-gray-50/50 border-b border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Unworked/Neglected Projects</h3>
                <span className="text-[10px] text-gray-400 font-bold uppercase mt-1 block">
                  Campaign allocations with no registered updates
                </span>
              </div>
              
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setUnworkedFilter(mode)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      unworkedFilter === mode
                        ? 'bg-white text-indigo-700 shadow-3xs border border-indigo-100/30'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {mode === 'daily' ? '📅 Daily' : mode === 'weekly' ? '⏳ Weekly' : '🗓️ Monthly'}
                  </button>
                ))}
              </div>
            </div>

            {unworkedProjects.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-600 font-bold space-y-1 bg-slate-50/40 rounded-b-2xl border-t border-slate-150">
                <CheckCircle size={22} className="text-emerald-500 block mx-auto mb-2.5 animate-bounce" />
                <p>Outstanding! No unworked projects detected in this timeframe.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px] border-collapse">
                  <thead className="bg-slate-50/55 text-slate-500 font-extrabold text-[10px] uppercase border-b border-gray-150">
                    <tr>
                      <th className="px-4 py-3 w-14 text-center">Sr No.</th>
                      <th className="px-4 py-3">Project Name</th>
                      <th className="px-4 py-3">Domain Name</th>
                      <th className="px-4 py-3">Inactivity Duration</th>
                      <th className="px-4 py-3">Last Worked Date</th>
                      {isAdmin && <th className="px-4 py-3">Assigned To</th>}
                      {isAdmin && <th className="px-4 py-3 w-28 text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {unworkedProjects.map((proj) => (
                      <tr key={proj.id} className="hover:bg-slate-50/40">
                        <td className="px-4 py-3.5 font-mono font-black text-gray-400 text-center">{proj.srNo}</td>
                        
                        {/* Project Name column */}
                        <td className="px-4 py-3.5 font-bold text-gray-900 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 font-black">{proj.name}</span>
                          </div>
                        </td>

                        {/* Domain Name column */}
                        <td className="px-4 py-3.5 text-left">
                          {proj.domain ? (
                            <a 
                              href={proj.domain.startsWith('http') ? proj.domain : `https://${proj.domain}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-indigo-600 hover:underline font-mono text-[10px] font-bold inline-flex items-center gap-1"
                            >
                              {proj.domain}
                            </a>
                          ) : (
                            <span className="text-gray-300 italic text-[10px] font-normal">No Domain Assigned</span>
                          )}
                        </td>

                        {/* Inactivity Duration column */}
                        <td className="px-4 py-3.5 text-left">
                          {(() => {
                            const days = proj.daysSinceLastWorked;
                            if (days === Infinity || days === undefined || proj.lastWorkedDate === 'Never') {
                              return (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100/50 text-[9px] font-black uppercase tracking-wider">
                                  ⚠️ Never Worked
                                </span>
                              );
                            }
                            
                            if (days === 0) {
                              return <span className="font-black text-emerald-600">0 Days (Active Today)</span>;
                            }
                            
                            // If daily filter is selected, or if days are less than 7, show in days only without neglected word
                            if (unworkedFilter === 'daily' || days < 7) {
                              return <span className="font-black text-amber-600">{days} {days === 1 ? 'Day' : 'Days'}</span>;
                            }
                            
                            const weeks = (days / 7).toFixed(1);
                            if (days < 30) {
                              return <span className="font-black text-rose-650">{weeks} Weeks ({days} days)</span>;
                            }
                            const months = (days / 30).toFixed(1);
                            return <span className="font-black text-rose-800">{months} Months ({days} days)</span>;
                          })()}
                        </td>

                        {/* Last Worked Date column */}
                        <td className="px-4 py-3.5 text-left">
                          {(() => {
                            if (proj.lastWorkedDate === 'Never') {
                              return <span className="text-gray-400 font-bold">—</span>;
                            }
                            
                            try {
                              const d = new Date(proj.lastWorkedDate);
                              return (
                                <span className="text-gray-800 font-extrabold font-mono text-xs">
                                  {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              );
                            } catch {
                              return <span className="text-gray-800 font-extrabold font-mono text-xs">{proj.lastWorkedDate}</span>;
                            }
                          })()}
                        </td>

                        {/* Assigned To column (Admin Only) */}
                        {isAdmin && (
                          <td className="px-4 py-3.5 text-left font-bold text-gray-800">
                            <span className="text-gray-900 bg-slate-50 border border-slate-200/50 rounded px-2.5 py-1 text-[10px] select-all">
                              {getAssignedUsersForProject(proj.id)}
                            </span>
                          </td>
                        )}

                        {/* Actions column (Only for Admin) */}
                        {isAdmin && (
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => setSelectedPlanProject(proj)}
                              className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-750 font-black uppercase text-[10px] px-3 py-1.5 rounded-xl border border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition shadow-3xs cursor-pointer"
                            >
                              📋 Plan
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'keyword_section' && (
          <div>
            <div className="p-4 bg-gray-50/50 border-b border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider">Project Keyword Section</h3>
                <span className="text-[10px] text-gray-400 font-bold uppercase mt-1 block">
                  Organic SEO keyword performance and daily logged operations
                </span>
              </div>
              
              <div className="relative w-full sm:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  value={keywordSearchTerm}
                  onChange={(e) => setKeywordSearchTerm(e.target.value)}
                  placeholder="Search keywords or domains..."
                  className="w-full text-xs pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                />
              </div>
            </div>

            {filteredKeywordStats.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-500 font-bold space-y-1 bg-slate-50/40 rounded-b-2xl border-t border-slate-150">
                <p>No keywords found matching the current workspace and search criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[900px] border-collapse">
                  <thead className="bg-slate-50/55 text-slate-500 font-extrabold text-[10px] uppercase border-b border-gray-150">
                    <tr>
                      <th className="px-4 py-3 w-14 text-center">Sr No.</th>
                      <th className="px-4 py-3">Project Name</th>
                      <th className="px-4 py-3">Domain</th>
                      <th className="px-4 py-3">Keyword</th>
                      <th className="px-4 py-3 w-28 text-center">Priority</th>
                      <th className="px-4 py-3 w-28 text-center">Frequency</th>
                      <th className="px-4 py-3">Ranking</th>
                      <th className="px-4 py-3 text-center">Times Worked</th>
                      <th className="px-4 py-3">Last Worked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {filteredKeywordStats.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                        {/* Sr No. */}
                        <td className="px-4 py-3.5 font-mono font-black text-gray-400 text-center">{item.srNo}</td>
                        
                        {/* Project Name & Code */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{item.projName}</span>
                          </div>
                        </td>

                        {/* Domain with a link */}
                        <td className="px-4 py-3.5">
                          {item.domain ? (
                            <a 
                              href={item.domain.startsWith('http') ? item.domain : `https://${item.domain}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="font-mono text-indigo-600 hover:underline text-[11px] font-bold bg-indigo-50/25 border border-indigo-100/50 px-2.5 py-0.5 rounded-md inline-flex items-center gap-1"
                            >
                              {item.domain}
                            </a>
                          ) : (
                            <span className="text-gray-300 italic text-[10px] font-normal">—</span>
                          )}
                        </td>

                        {/* Keyword Name Column */}
                        <td className="px-4 py-3.5 text-left">
                          <span className="inline-block bg-amber-50 text-amber-900 font-extrabold px-2.5 py-1 rounded-xl border border-amber-200/50 text-[11px] font-mono shadow-3xs">
                            {item.keyword}
                          </span>
                        </td>

                        {/* Priority Column */}
                        <td className="px-4 py-3.5 text-center">
                          {item.priority === 'P1' && (
                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-black px-2 py-0.5 rounded border border-red-100 uppercase tracking-wider">
                              🚨 P1 High
                            </span>
                          )}
                          {item.priority === 'P2' && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded border border-amber-100 uppercase tracking-wider">
                              ⚡ P2 Med
                            </span>
                          )}
                          {item.priority === 'P3' && (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                              🟢 P3 Low
                            </span>
                          )}
                          {!['P1', 'P2', 'P3'].includes(item.priority || '') && (
                            <span className="text-[10px] font-bold text-gray-400 italic">
                              —
                            </span>
                          )}
                        </td>

                        {/* Frequency Column */}
                        <td className="px-4 py-3.5 text-center">
                          {item.frequency ? (
                            <span className="inline-flex items-center gap-1.5 bg-indigo-50/50 text-indigo-800 font-mono font-bold px-2 py-0.5 rounded border border-indigo-100 text-[11px]">
                              {item.frequency} / wk
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-400 italic">—</span>
                          )}
                        </td>

                        {/* Ranking Column (Blank) */}
                        <td className="px-4 py-3.5 text-left font-mono font-semibold text-gray-400">
                          —
                        </td>

                        {/* Times Worked Column */}
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center justify-center font-bold px-2.5 rounded-full text-[10px] h-5 min-w-5 leading-none font-mono ${
                            item.timesWorked > 0 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {item.timesWorked}
                          </span>
                        </td>

                        {/* Last Worked Column */}
                        <td className="px-4 py-3.5 text-left">
                          {(() => {
                            if (item.lastWorkedDate === 'Never') {
                              return <span className="text-gray-400 font-bold font-mono">—</span>;
                            }
                            
                            try {
                              const d = new Date(item.lastWorkedDate);
                              return (
                                <span className="text-gray-800 font-extrabold font-mono text-xs">
                                  {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              );
                            } catch {
                              return <span className="text-gray-800 font-extrabold font-mono text-xs">{item.lastWorkedDate}</span>;
                            }
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Admin Recovery Plan Modal PopUp */}
        <AnimatePresence>
          {selectedPlanProject && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in text-left">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl border border-slate-150 shadow-2xl max-w-md w-full overflow-hidden"
              >
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                      🚨 Setup Recovery Plan
                    </h3>
                    <p className="text-[10px] text-gray-500 font-bold font-mono mt-0.5">
                      PROJECT: {selectedPlanProject.name}
                    </p>
                  </div>
                  <button 
                    onClick={() => { setSelectedPlanProject(null); setPlanMessage(''); }}
                    className="p-1.5 hover:bg-slate-200/60 rounded-lg text-gray-400 hover:text-gray-700 transition"
                  >
                    &times;
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black text-gray-500 uppercase tracking-wider">
                      Message / Recovery Steps for Team
                    </label>
                    <textarea
                      rows={4}
                      value={planMessage}
                      onChange={(e) => setPlanMessage(e.target.value)}
                      placeholder="e.g., We need to speed up submissions on this campaign! Please focus on building 10 High-Quality Blogs and 5 PDF press releases tomorrow morning."
                      className="w-full text-xs p-3.5 border border-gray-200 rounded-2xl bg-slate-50/30 focus:outline-hidden focus:ring-2 focus:ring-indigo-150 focus:border-indigo-600 transition-all font-semibold text-gray-800 leading-relaxed"
                    />
                  </div>

                  <div className="bg-sky-50 p-3 rounded-2xl border border-sky-100 flex gap-2">
                    <span className="text-xs">📢</span>
                    <p className="text-[10px] text-sky-800 font-semibold leading-relaxed">
                      Publishing this will alert all reporters immediately via their notification bell.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-2.5">
                  <button
                    onClick={() => { setSelectedPlanProject(null); setPlanMessage(''); }}
                    className="px-4 py-2 text-xs font-bold text-gray-550 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!planMessage.trim()) return;
                      const newAlert = {
                        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        projectId: selectedPlanProject.id,
                        projectName: selectedPlanProject.name,
                        projectDomain: selectedPlanProject.domain,
                        message: planMessage.trim(),
                        createdAt: new Date().toISOString(),
                        adminEmail: currentUserEmail || 'Admin',
                        read: false
                      };
                      if (onAddAlert) {
                        onAddAlert(newAlert);
                      }
                      setSelectedPlanProject(null);
                      setPlanMessage('');
                    }}
                    disabled={!planMessage.trim()}
                    className="px-4 py-2 text-xs font-black bg-indigo-600 border border-indigo-700 hover:bg-indigo-700 text-white rounded-xl shadow-2xs cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🚀 Publish Alert Plan
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>

    </div>
  );
}
