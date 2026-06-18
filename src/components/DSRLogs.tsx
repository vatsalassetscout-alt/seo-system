/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { DSREntry, Project, ProjectWork, CustomSubmissionType, AppUser } from '../types';
import { getUserDisplayName } from '../lib/userUtils';
import {
  Search,
  Calendar,
  Layers,
  FileCheck2,
  Image,
  Tag,
  Clock,
  Trash2,
  Compass,
  Download,
  Flame,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  User,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DSRLogsProps {
  entries: DSREntry[];
  projects: Project[];
  onDeleteEntry?: (id: string) => void;
  onUpdateStatus?: (id: string, status: 'Pending' | 'Approved' | 'Needs Revision') => void;
  isAdmin: boolean;
  customSubmissionTypes?: CustomSubmissionType[];
  allowedUsers?: AppUser[];
  currentUserEmail?: string | null;
  onFilteredCountChange?: (count: number) => void;
}

export default function DSRLogs({
  entries,
  projects,
  onDeleteEntry,
  onUpdateStatus,
  isAdmin,
  customSubmissionTypes = [],
  allowedUsers = [],
  currentUserEmail = null,
  onFilteredCountChange,
}: DSRLogsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'yesterday_today' | 'yesterday' | 'last_7_days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});

  // Active Image Modal state for viewing uploaded screenshot full scale
  const [activePreviewImage, setActivePreviewImage] = useState<{ src: string; title: string } | null>(null);

  // User Checklist Multi-select dropdown filters
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  // Host list of all users on the system (both allowed list and historic logging addresses)
  const allUsersList = useMemo(() => {
    const emailMap = new Map<string, string>();
    allowedUsers.forEach(u => {
      if (u.email && u.email.trim()) {
        emailMap.set(u.email.trim().toLowerCase(), u.name || u.email);
      }
    });

    entries.forEach(entry => {
      if (entry && entry.userEmail) {
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
  }, [allowedUsers, entries]);

  const employeeNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    
    // Default format for any existing log emails first
    entries.forEach(entry => {
      if (entry && entry.userEmail) {
        const email = entry.userEmail.trim().toLowerCase();
        map[email] = getUserDisplayName(email, allowedUsers);
      }
    });

    // Overwrite with assigned name from allowedUsers
    allowedUsers.forEach(u => {
      map[u.email.trim().toLowerCase()] = u.name;
    });

    return map;
  }, [allowedUsers, entries]);

  const toggleExpand = (id: string) => {
    setExpandedEntries(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getLocalDateStrings = () => {
    const todayObj = new Date();
    
    const formatDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const todayStr = formatDate(todayObj);

    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = formatDate(yesterdayObj);

    const list7Days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      list7Days.push(formatDate(d));
    }

    return { todayStr, yesterdayStr, list7Days };
  };

  // Only show currently logged-in user's logs if they are not an administrator
  const visibleEntries = useMemo(() => {
    if (isAdmin) {
      return entries;
    }
    if (!currentUserEmail) return [];
    return entries.filter(
      (entry) =>
        entry.userEmail &&
        entry.userEmail.toLowerCase().trim() === currentUserEmail.toLowerCase().trim()
    );
  }, [entries, isAdmin, currentUserEmail]);

  // Filtering logs
  const filteredEntries = useMemo(() => {
    return visibleEntries.filter((entry) => {
      if (!entry) return false;
      const email = entry.userEmail || '';
      const emailLower = email.toLowerCase().trim();
      const worksList = Array.isArray(entry.works) ? entry.works : [];

      // Checkbox multi-user filter (Admin only)
      if (isAdmin && selectedUsers.length > 0) {
        if (!emailLower || !selectedUsers.includes(emailLower)) {
          return false;
        }
      }

      // Search matches everything (developer email, project names, code, deliverables, text notes)
      const matchesEmail = email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesName = (employeeNamesMap[email.toLowerCase()] || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesWorks = worksList.some((work) => {
        if (!work) return false;
        
        // Match against local parameters
        const localProjName = (work.projectName || '').toLowerCase();
        const blogText = (work.blog || '').toLowerCase();
        const summaryText = (work.workSummary || '').toLowerCase();
        const pdfText = (work.pdfName || '').toLowerCase();
        const imgText = (work.imageName || '').toLowerCase();
        
        // Resolve matches against full project dynamic entity (name & code)
        const matchedProj = projects.find(p => p.id === work.projectId);
        const fullProjName = matchedProj ? matchedProj.name.toLowerCase() : '';
        const fullProjCode = matchedProj ? matchedProj.code.toLowerCase() : '';

        const query = searchTerm.toLowerCase();

        return (
          localProjName.includes(query) ||
          fullProjName.includes(query) ||
          fullProjCode.includes(query) ||
          blogText.includes(query) ||
          summaryText.includes(query) ||
          pdfText.includes(query) ||
          imgText.includes(query)
        );
      });

      const matchesSearch = matchesEmail || matchesName || matchesWorks || searchTerm === '';

      // Date qualification filter
      const { todayStr, yesterdayStr, list7Days } = getLocalDateStrings();
      const isDateQualified = (entryDate: string) => {
        if (!entryDate) return false;
        const dStr = entryDate.trim().split('T')[0];

        switch (dateFilterType) {
          case 'all':
            return true;
          case 'today':
            return dStr === todayStr;
          case 'yesterday_today':
            return dStr === todayStr || dStr === yesterdayStr;
          case 'yesterday':
            return dStr === yesterdayStr;
          case 'last_7_days':
            return list7Days.includes(dStr);
          case 'custom': {
            let ok = true;
            if (customStartDate) {
              ok = ok && dStr >= customStartDate;
            }
            if (customEndDate) {
              ok = ok && dStr <= customEndDate;
            }
            return ok;
          }
          default:
            return true;
        }
      };

      const matchesDate = isDateQualified(entry.date);

      // Project matches if 'all' or if the entry has at least one work targeting this project by ID or project name
      const selectedProjObj = projects.find(p => p.id === selectedProjectId);
      const matchesProject = selectedProjectId === 'all' || worksList.some(w => {
        if (!w) return false;
        if (w.projectId === selectedProjectId) return true;
        if (selectedProjObj && w.projectName && w.projectName.toLowerCase().trim() === selectedProjObj.name.toLowerCase().trim()) return true;
        return false;
      });

      return matchesSearch && matchesDate && matchesProject;
    });
  }, [visibleEntries, isAdmin, selectedUsers, searchTerm, employeeNamesMap, projects, dateFilterType, customStartDate, customEndDate, selectedProjectId]);

  // Call parent callback with the total matching count when filters or logs change
  useEffect(() => {
    if (onFilteredCountChange) {
      const selectedProjObj = projects.find(p => p.id === selectedProjectId);
      const totalProjectEntriesCount = filteredEntries.reduce((sum, entry) => {
        const works = entry.works || [];
        if (selectedProjectId === 'all') {
          return sum + works.length;
        } else {
          return sum + works.filter(w => {
            if (!w) return false;
            if (w.projectId === selectedProjectId) return true;
            if (selectedProjObj && w.projectName && w.projectName.toLowerCase().trim() === selectedProjObj.name.toLowerCase().trim()) return true;
            return false;
          }).length;
        }
      }, 0);
      onFilteredCountChange(totalProjectEntriesCount);
    }
  }, [filteredEntries, selectedProjectId, projects, onFilteredCountChange]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedProjectId('all');
    setDateFilterType('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedUsers([]);
    setUserSearchTerm('');
  };

  // Group filtered entries day-wise: key is entry.date
  const groupedDates = useMemo(() => {
    const map: Record<string, DSREntry[]> = {};
    filteredEntries.forEach((entry) => {
      const d = entry.date || new Date().toISOString().split('T')[0];
      if (!map[d]) {
        map[d] = [];
      }
      map[d].push(entry);
    });

    // Make sorted array of days (most recent day first)
    return Object.keys(map)
      .map((dateStr) => {
        // Sort entries of that day so that more recently created reports come first
        const dayEntries = map[dateStr].sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tB - tA; // most recent first
        });
        return {
          dateStr,
          entries: dayEntries,
        };
      })
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      {/* Search & Parameters panel */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Historical Daily Logs</h3>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 focus:outline-none"
          >
            Reset Filters
          </button>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
          {/* Text search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search everything (email, project, blog)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-950 focus:outline-none focus:ring-1 focus:ring-indigo-550 transition h-[40px]"
            />
          </div>

          {/* Project Allocation selection */}
          <div className="flex items-center gap-1.5 h-[40px]">
            <Tag size={12} className="text-gray-400 shrink-0" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-950 focus:outline-none transition h-[40px]"
            >
              <option value="all">Every Project (All Allocations)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.code}]
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-1.5 h-[40px]">
            <Calendar size={12} className="text-gray-400 shrink-0" />
            <select
              value={dateFilterType}
              onChange={(e) => setDateFilterType(e.target.value as any)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-950 focus:outline-none transition cursor-pointer h-[40px]"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
              <option value="yesterday_today">Yesterday & Today Combined</option>
              <option value="yesterday">Yesterday Only</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>

          {/* User Checklist drop-down filter (Admin only) */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 h-[40px] relative">
              <Users size={12} className="text-gray-400 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  setIsUserDropdownOpen(!isUserDropdownOpen);
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-950 font-bold focus:outline-none transition hover:bg-gray-100 h-[40px]"
              >
                <span className="truncate pr-1">
                  {selectedUsers.length === 0 
                    ? 'All Users' 
                    : `${selectedUsers.length} Selected`}
                </span>
                <ChevronDown size={12} className={`text-gray-400 transition-transform shrink-0 ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isUserDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsUserDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 left-0 mt-[42px] top-0 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-2.5 space-y-2 max-h-56 overflow-y-auto">
                    <div className="flex items-center justify-between text-[9px] pb-1 border-b border-gray-100 font-bold text-gray-400">
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

                    {/* Small Search Bar inside dropdown */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        placeholder="Search user..."
                        className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-550 text-gray-950 placeholder-gray-400 h-[26px]"
                      />
                    </div>

                    <div className="space-y-0.5 max-h-36 overflow-y-auto text-left" onClick={(e) => e.stopPropagation()}>
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
          )}
        </div>

        {/* Custom date pickers if range chosen */}
        {dateFilterType === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-indigo-50/15 rounded-2xl border border-indigo-105/30">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-950 focus:outline-none focus:ring-1 focus:ring-indigo-555"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-950 focus:outline-none focus:ring-1 focus:ring-indigo-555"
              />
            </div>
          </div>
        )}
      </div>

      {/* Primary entries feed list */}
      {groupedDates.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-150 text-center flex flex-col items-center justify-center space-y-4 max-w-xl mx-auto">
          <Compass size={40} className="text-gray-300 animate-pulse" />
          <h4 className="text-sm font-bold text-gray-800">Clear Search Criteria</h4>
          <p className="text-xs text-gray-550 leading-relaxed">
            No daily status reports match your specified filters or search queries. Try resetting filters to explore seed project metrics.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-gray-400 font-semibold flex items-center justify-between">
            <span>SHOWING {groupedDates.length} ACTIVE DAYS OF REPORT DATA</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {groupedDates.map(({ dateStr, entries: dayEntries }) => {
              const worksCount = dayEntries.reduce((sum, e) => sum + (e.works || []).length, 0);
              const isExpanded = !!expandedEntries[dateStr]; // collapsed by default

              // Cumulative counts for this date
              let totalListings = 0;
              let totalBlogs = 0;
              let totalPdfs = 0;
              let totalImages = 0;

              dayEntries.forEach((e) => {
                (e.works || []).forEach((w) => {
                  totalListings += w.listingCount || 0;
                  totalBlogs += w.blogCount || 0;
                  totalPdfs += w.pdfCount || 0;
                  totalImages += w.imageCount || 0;
                });
              });

              const parsedDate = new Date(dateStr);
              const formattedDateString = isNaN(parsedDate.getTime())
                ? dateStr
                : parsedDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

              return (
                <div
                  key={dateStr}
                  className="bg-white rounded-2xl border border-gray-150 hover:border-gray-205 transition-all shadow-2xs overflow-hidden"
                >
                  {/* Card Main Bar - Grouped by Date */}
                  <div
                    onClick={() => toggleExpand(dateStr)}
                    className="px-4 py-3 bg-gray-50/50 hover:bg-gray-100/40 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 cursor-pointer transition select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-black flex items-center justify-center">
                        <Calendar size={14} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-950 text-xs sm:text-sm">
                            {formattedDateString}
                          </span>
                          <span className="text-[9px] bg-slate-100 text-slate-655 font-bold px-1.5 py-0.5 rounded uppercase">
                            {dayEntries.length} {dayEntries.length === 1 ? 'Sub' : 'Subs'}
                          </span>
                        </div>

                        {/* Summary of what they achieved */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500 font-medium mt-0.5">
                          <span className="inline-flex items-center gap-0.5 bg-white border border-gray-200/40 px-1.5 py-0.5 rounded text-[9px] text-indigo-600 font-bold">
                            📂 {worksCount} {worksCount === 1 ? 'Work' : 'Works'}
                          </span>
                          <span>•</span>
                          <span className="text-gray-405">Total:</span>
                          <span className="font-mono text-gray-900 font-bold">{totalListings} List</span>
                          <span className="text-gray-200">|</span>
                          <span className="font-mono text-gray-900 font-bold">{totalBlogs} Blog</span>
                          <span className="text-gray-200">|</span>
                          <span className="font-mono text-gray-900 font-bold">{totalPdfs} PDF</span>
                          <span className="text-gray-200">|</span>
                          <span className="font-mono text-gray-900 font-bold">{totalImages} Img</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {/* Name of users on this day */}
                      {(() => {
                        const uniqueUsers = Array.from(
                          new Set(
                            dayEntries
                              .map((entry) => (entry.userEmail ? entry.userEmail.trim().toLowerCase() : ''))
                              .filter(Boolean)
                          )
                        ).map((email) => employeeNamesMap[email] || email);

                        if (uniqueUsers.length === 0) return null;

                        return (
                          <div
                            className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-1 rounded-md border border-indigo-100 transition overflow-hidden max-w-[160px] sm:max-w-[240px]"
                            title={`Users: ${uniqueUsers.join(', ')}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <User size={10} className="text-indigo-500 shrink-0" />
                            <span className="truncate">{uniqueUsers.join(', ')}</span>
                          </div>
                        );
                      })()}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(dateStr);
                        }}
                        className="flex items-center gap-1 py-1 px-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg transition text-[10px] font-bold cursor-pointer shrink-0"
                        title="Expand or collapse tasks filed on this date"
                      >
                        {isExpanded ? 'Hide' : 'Show'}
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    </div>
                  </div>

                  {/* Redesigned details */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-white"
                      >
                        <div className="p-2.5 sm:p-3 space-y-2.5 border-t border-gray-100 bg-slate-50/20">
                          {/* Overview banner showing the day of the week after click */}
                          <div className="px-3 py-2 bg-indigo-50/30 rounded-xl border border-indigo-100/40 text-xs text-slate-900 flex flex-wrap items-center justify-between gap-2 shadow-3xs">
                            <span className="font-bold">
                              🗓️ Overview for <span className="text-indigo-700 font-extrabold">{isNaN(parsedDate.getTime()) ? '' : parsedDate.toLocaleDateString('en-US', { weekday: 'long' })}</span> ({formattedDateString})
                            </span>
                            <span className="text-[10px] font-bold text-indigo-650">
                              {dayEntries.length} {dayEntries.length === 1 ? 'submission item' : 'submission items'} total
                            </span>
                          </div>

                          {dayEntries.map((entry, entryIdx) => {
                            const timeStr = entry.createdAt
                              ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Pending';

                            return (
                              <div
                                key={entry.id || entryIdx}
                                className="bg-white rounded-xl border border-gray-150 p-2.5 sm:p-3 space-y-2.5 shadow-2xs"
                              >
                                {/* Submission line header with timestamp and name details */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                    <Clock size={12} className="text-indigo-655 shrink-0" />
                                    <span className="font-bold text-gray-850">
                                      Submission at <span className="font-mono text-indigo-700 font-extrabold">{timeStr}</span>
                                    </span>
                                    {isAdmin && (
                                      <span className="text-[10px] text-gray-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                                        by {employeeNamesMap[entry.userEmail.toLowerCase()] || entry.userEmail}
                                      </span>
                                    )}
                                  </div>

                                  {/* Right side controls */}
                                  <div className="flex items-center gap-1.5">
                                    {entry.status && (
                                      <span className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border ${
                                        entry.status === 'Approved' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                                        entry.status === 'Needs Revision' ? 'bg-rose-50 text-rose-855 border-rose-100' :
                                        'bg-amber-50 text-amber-855 border-amber-100'
                                      }`}>
                                        {entry.status}
                                      </span>
                                    )}

                                    {isAdmin && onUpdateStatus && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => onUpdateStatus(entry.id, 'Approved')}
                                          className="text-[9px] font-black bg-emerald-600 hover:bg-emerald-700 text-white px-1.5 py-0.5 rounded transition cursor-pointer"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => onUpdateStatus(entry.id, 'Needs Revision')}
                                          className="text-[9px] font-black bg-rose-600 hover:bg-rose-700 text-white px-1.5 py-0.5 rounded transition cursor-pointer"
                                        >
                                          Revision
                                        </button>
                                      </div>
                                    )}


                                  </div>
                                </div>

                                {/* Works submitted list - Project on Left / Done Row on Right */}
                                <div className="space-y-1.5">
                                  {(entry.works || []).map((work, wIdx) => {
                                    const matchedProj = projects.find(p => p.id === work.projectId);
                                    const workTypes = work.workTypes || ['seo_backlink'];
                                    const hasSEO = workTypes.includes('seo_backlink');
                                    const hasContentUpdate = workTypes.includes('content_update');

                                    return (
                                      <div
                                        key={wIdx}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/40 p-2 rounded-lg border border-gray-150 hover:bg-slate-50/80 transition"
                                      >
                                        {/* Left Side: Project details */}
                                        <div className="flex items-center gap-2 min-w-[180px] shrink-0">
                                          <span className="font-mono bg-indigo-650 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                                            {matchedProj?.code || 'DEV'}
                                          </span>
                                          <span className="text-xs font-bold text-gray-900 truncate max-w-[140px]" title={matchedProj?.name || work.projectName}>
                                            {matchedProj?.name || work.projectName || 'Task Item'}
                                          </span>
                                        </div>

                                        {/* Right Side / In Front: Exactly what work was done */}
                                        <div className="flex-1 flex flex-wrap items-center gap-2 sm:justify-end text-[11px]">
                                          {/* SEO Metrics List inline */}
                                          {hasSEO && (
                                            <div className="flex flex-wrap items-center gap-1">
                                              {(work.listingCount ?? 0) > 0 && (
                                                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-extrabold text-[9px] border border-indigo-100/60">
                                                  {work.listingCount} List
                                                </span>
                                              )}
                                              {(work.blogCount ?? 0) > 0 && (
                                                <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-extrabold text-[9px] border border-emerald-100/60">
                                                  {work.blogCount} Blog
                                                </span>
                                              )}
                                              {(work.pdfCount ?? 0) > 0 && (
                                                <span className="bg-teal-50 text-teal-850 px-1.5 py-0.5 rounded font-extrabold text-[9px] border border-teal-100/60">
                                                  {work.pdfCount} PDF
                                                </span>
                                              )}
                                              {(work.imageCount ?? 0) > 0 && (
                                                <span className="bg-sky-50 text-sky-805 px-1.5 py-0.5 rounded font-extrabold text-[9px] border border-sky-100/60">
                                                  {work.imageCount} Img
                                                </span>
                                              )}
                                              {customSubmissionTypes.map((type) => {
                                                const rawVal = work.customValues?.[type.id];
                                                const count = rawVal !== undefined ? Number(rawVal) : 0;
                                                if (count <= 0) return null;
                                                return (
                                                  <span key={type.id} className="bg-purple-50 text-purple-800 px-1.5 py-0.5 rounded font-extrabold text-[9px] border border-purple-100/60" title={type.name}>
                                                    {count} {type.code}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {/* Content Update badges inline */}
                                          {hasContentUpdate && work.contentUpdates && work.contentUpdates.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-1">
                                              {work.contentUpdates.map((item: string) => {
                                                const labelMap: Record<string, string> = {
                                                  meta_title_desc: 'Meta',
                                                  keyword_update: 'Keywords',
                                                  section_update: 'Section',
                                                  restructure: 'Restruct'
                                                };
                                                return (
                                                  <span key={item} className="bg-slate-100 text-slate-705 px-1.5 py-0.5 rounded font-bold text-[9px]" title={item}>
                                                    ✓ {labelMap[item] || item}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {/* Brief Text summary explanation / in front notes */}
                                          {work.workSummary && (
                                            <span className="text-gray-650 italic bg-white px-2 py-0.5 border border-gray-150 rounded text-[10px] max-w-[260px] truncate" title={work.workSummary}>
                                              — {work.workSummary}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Polish Portal Screen Preview Lightbox modal for Image zooming */}
      <AnimatePresence>
        {activePreviewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-gray-950/90 flex items-center justify-center p-4 backdrop-blur-xs"
            onClick={() => setActivePreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-3xl w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <span className="text-xs font-bold text-gray-800">{activePreviewImage.title}</span>
                <button
                  onClick={() => setActivePreviewImage(null)}
                  className="p-1 hover:bg-gray-200 rounded-lg text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>
              {/* Zoom image container */}
              <div className="p-4 bg-gray-100 flex justify-center max-h-[80vh] overflow-hidden">
                <img
                  src={activePreviewImage.src}
                  alt={activePreviewImage.title}
                  className="max-h-full max-w-full rounded-2xl object-contain shadow-sm"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
