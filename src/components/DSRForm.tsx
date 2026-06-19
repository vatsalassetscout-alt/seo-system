/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, ProjectWork, CustomSubmissionType, AppUser } from '../types';
import { getUserDisplayName } from '../lib/userUtils';
import {
  Calendar,
  Layers,
  Hash,
  PenTool,
  Plus,
  Image,
  CheckCircle2,
  Files,
  FileText,
  MessageSquare,
  Presentation,
  User,
  Link
} from 'lucide-react';
import { motion } from 'motion/react';

interface DSRFormProps {
  projects: Project[];
  onSubmit: (works: Omit<ProjectWork, 'id'>[], date: string) => void;
  currentUserEmail: string;
  allowedUsers?: AppUser[];
  onViewLogs?: () => void;
  customSubmissionTypes?: CustomSubmissionType[];
  onSendAdminMessage?: (message: string) => void;
  preFill?: { projectId: string; date: string } | null;
  onClearPreFill?: () => void;
}

export default function DSRForm({
  projects,
  onSubmit,
  currentUserEmail,
  allowedUsers = [],
  onViewLogs,
  customSubmissionTypes = [],
  onSendAdminMessage,
  preFill,
  onClearPreFill,
}: DSRFormProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // We support single project entry in a submission session based on user preference
  const [worksList, setWorksList] = useState<any[]>([
    {
      projectId: projects[0]?.id || '',
      projectName: projects[0]?.name || '',
      listingCount: '',
      blogCount: '',
      forumCount: '',
      pdfCount: '',
      imageCount: '',
      videoPptCount: '',
      profileCount: '',
      linkCount: '',
      blog: '',
      customValues: {},
      workTypes: ['seo_backlink'], // default to SEO backlink submission
      contentUpdates: [],
      selectedKeywords: [],
      workSummary: '',
    }
  ]);

  const [isSuccess, setIsSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (projects && projects.length > 0) {
      setWorksList((prev) =>
        prev.map((item) => {
          if (!item.projectId && projects[0]) {
            return {
              ...item,
              projectId: projects[0].id,
              projectName: projects[0].name,
            };
          }
          return item;
        })
      );
    }
  }, [projects]);

  useEffect(() => {
    if (preFill && preFill.projectId) {
      setSelectedDate(preFill.date);
      const matched = projects.find(p => p.id === preFill.projectId);
      if (matched) {
        setWorksList([{
          projectId: matched.id,
          projectName: matched.name,
          listingCount: '',
          blogCount: '',
          forumCount: '',
          pdfCount: '',
          imageCount: '',
          videoPptCount: '',
          profileCount: '',
          linkCount: '',
          blog: '',
          customValues: {},
          workTypes: ['seo_backlink'],
          contentUpdates: [],
          selectedKeywords: [],
          workSummary: '',
        }]);
      }
      if (onClearPreFill) {
        onClearPreFill();
      }
    }
  }, [preFill, projects, onClearPreFill]);

  // Update item field
  const handleUpdateWorkBlock = (index: number, updates: Partial<any>) => {
    setWorksList((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, ...updates };
        
        // If changing projectId, sync projectName and reset keywords
        if (updates.projectId) {
          const matchedProj = projects.find((p) => p.id === updates.projectId);
          if (matchedProj) {
            next.projectName = matchedProj.name;
          }
          next.selectedKeywords = [];
        }
        return next;
      })
    );
  };

  const handleResetForm = () => {
    setWorksList([
      {
        projectId: projects[0]?.id || '',
        projectName: projects[0]?.name || '',
        listingCount: '',
        blogCount: '',
        forumCount: '',
        pdfCount: '',
        imageCount: '',
        videoPptCount: '',
        profileCount: '',
        linkCount: '',
        blog: '',
        customValues: {},
        workTypes: ['seo_backlink'],
        contentUpdates: [],
        selectedKeywords: [],
        workSummary: '',
      }
    ]);
    setIsSuccess(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!selectedDate) {
      setValidationError('Please select the reporting date.');
      return;
    }

    // Validate the work entry
    const work = worksList[0];
    if (!work.projectId) {
      setValidationError(`Please select a project.`);
      return;
    }

    const workTypes = work.workTypes || [];
    if (workTypes.length === 0) {
      setValidationError('Please select at least one Work Type (SEO Backlink and/or Content Update).');
      return;
    }

    const hasSEO = workTypes.includes('seo_backlink');
    const hasContentUpdate = workTypes.includes('content_update');

    const parseVal = (val: any) => {
      if (val === undefined || val === null || val === '') return 0;
      const num = Number(val);
      if (isNaN(num)) {
        return NaN;
      }
      return num;
    };

    const listingCount = hasSEO ? parseVal(work.listingCount) : 0;
    const blogCount = hasSEO ? parseVal(work.blogCount) : 0;
    const forumCount = hasSEO ? parseVal(work.forumCount) : 0;
    const pdfCount = hasSEO ? parseVal(work.pdfCount) : 0;
    const imageCount = hasSEO ? parseVal(work.imageCount) : 0;
    const videoPptCount = hasSEO ? parseVal(work.videoPptCount) : 0;
    const profileCount = hasSEO ? parseVal(work.profileCount) : 0;
    const linkCount = hasSEO ? parseVal(work.linkCount) : 0;

    if (hasSEO && (
      isNaN(listingCount) || isNaN(blogCount) || isNaN(forumCount) || isNaN(pdfCount) ||
      isNaN(imageCount) || isNaN(videoPptCount) || isNaN(profileCount) || isNaN(linkCount)
    )) {
      setValidationError('Please enter a valid number for all count inputs under SEO Backlink Submission.');
      return;
    }

    if (hasContentUpdate && (!work.contentUpdates || work.contentUpdates.length === 0)) {
      setValidationError('Please select at least one content update option (check box).');
      return;
    }

    // Parse and validate custom submission types
    const cleanCustomValues: Record<string, any> = {};
    if (hasSEO) {
      for (const cType of customSubmissionTypes) {
        const rawVal = work.customValues?.[cType.id];
        const parsed = parseVal(rawVal);
        if (isNaN(parsed)) {
          setValidationError(`Please enter a valid number for "${cType.name}".`);
          return;
        }
        cleanCustomValues[cType.id] = parsed;
      }
    }

    // Put selectedKeywords inside customValues for flexible sheets storage if chosen
    if (work.selectedKeywords && work.selectedKeywords.length > 0) {
      cleanCustomValues['selectedKeywords'] = work.selectedKeywords;
    }

    const cleanWorksList: Omit<ProjectWork, 'id'>[] = [
      {
        projectId: work.projectId,
        projectName: work.projectName,
        listingCount,
        blogCount,
        forumCount,
        pdfCount,
        imageCount,
        videoPptCount,
        profileCount,
        linkCount,
        blog: work.blog || '',
        customValues: cleanCustomValues,
        workTypes,
        contentUpdates: work.contentUpdates || [],
        selectedKeywords: work.selectedKeywords || [],
        workSummary: work.workSummary || '',
      }
    ];

    // Call submit handler with our clean array
    onSubmit(cleanWorksList, selectedDate);

    setIsSuccess(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-8">
      {isSuccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl border border-gray-150 shadow-md text-center space-y-6 max-w-xl mx-auto py-12"
        >
          <div className="inline-flex w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 items-center justify-center">
            <CheckCircle2 size={32} className="animate-pulse text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900">Work Log Submitted Successfully!</h2>
            <p className="text-xs text-gray-500">
              Your Work Log report has been compiled and recorded under <strong>{getUserDisplayName(currentUserEmail, allowedUsers)}</strong>.
            </p>
          </div>
          <div className="border-t border-gray-100 pt-8 space-y-5">
            <p className="text-sm font-semibold text-gray-700">
              Would you like to log another entry?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Plus size={14} /> Log Another Entry
              </button>
              {onViewLogs && (
                <button
                  type="button"
                  onClick={onViewLogs}
                  className="px-6 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Files size={14} /> View Work Log History
                </button>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Date Selector Row */}
            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-gray-950 text-base flex items-center gap-2">
                    <Calendar size={18} className="text-indigo-600 animate-pulse" />
                    Reporting Period Date
                  </h3>
                  <span className="text-[9px] font-black tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase uppercase-sans">
                    Any Date Allowed
                  </span>
                </div>

              </div>
              <div className="flex items-center gap-2">
                <input
                  id="reporting-date"
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-955 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 transition text-sm cursor-pointer hover:bg-gray-100"
                />
              </div>
            </div>

            {/* Single Project Work Item Container */}
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Domain Allocation
                </span>
              </div>

              {worksList.map((work, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-3xl border border-gray-150 shadow-xs overflow-hidden relative group"
                >
                  {/* Block Header Tab */}
                  <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                        ✓
                      </span>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Domain Work Allocation Block</h4>

                      </div>
                    </div>
                  </div>

                  {/* Body Form inputs */}
                  <div className="p-6 sm:p-8 space-y-6">
                    
                    {/* Select Project block - full width at top */}
                    <div className="space-y-2">
                      <label htmlFor={`proj-select-${idx}`} className="block text-xs font-bold text-indigo-750 uppercase tracking-wider flex items-center gap-2">
                        <Layers size={14} className="text-indigo-600" />
                        Domain
                      </label>
                      <select
                        id={`proj-select-${idx}`}
                        value={work.projectId}
                        onChange={(e) => handleUpdateWorkBlock(idx, { projectId: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600 transition text-sm cursor-pointer"
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.domain || p.name}
                          </option>
                        ))}
                      </select>
                    </div>                    {/* Section: Work Type */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-gray-150 pb-3">
                        <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center">
                          <PenTool size={12} className="shrink-0" />
                        </div>
                        <h5 className="text-xs font-black text-gray-700 uppercase tracking-wider">Select Work Type</h5>
                      </div>                      {/* Work Types Toggle List - Stacked Vertically with Inline Dynamic Panels */}
                      <div className="flex flex-col gap-6">
                        
                        {/* 1. SEO Backlink block */}
                        <div className="space-y-3">
                          {/* SEO Backlink Option Card */}
                          <label
                            className={`relative flex items-start gap-3.5 p-4.5 rounded-2xl border cursor-pointer select-none transition ${
                              (work.workTypes || []).includes('seo_backlink')
                                ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={(work.workTypes || []).includes('seo_backlink')}
                              onChange={() => {
                                const current = work.workTypes || [];
                                const next = current.includes('seo_backlink')
                                  ? current.filter((t: string) => t !== 'seo_backlink')
                                  : [...current, 'seo_backlink'];
                                handleUpdateWorkBlock(idx, { workTypes: next });
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer"
                            />
                            <div className="space-y-0.5">
                              <span className="block text-xs font-bold text-gray-900">SEO Backlink Submission</span>
                              <span className="block text-[10px] text-gray-400 font-medium">Log submission counts for listings, blogs, PDFs, and images.</span>
                            </div>
                          </label>

                          {/* Dynamic Content Panel 1: SEO Backlink Submission Counts */}
                          {(work.workTypes || []).includes('seo_backlink') && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="border border-indigo-100 bg-indigo-50/10 rounded-2xl p-5 space-y-4"
                            >
                              <span className="block text-[10px] font-extrabold text-indigo-950 uppercase tracking-widest">
                                🚀 SEO Submission Quantities
                              </span>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {/* 1. Blogs / Articles count */}
                                <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-150 shadow-2xs">
                                  <label htmlFor={`blog-cnt-${idx}`} className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none">
                                    <PenTool size={13} className="text-indigo-600 shrink-0" />
                                    Blog / Article
                                  </label>
                                  <input
                                    id={`blog-cnt-${idx}`}
                                    type="number"
                                    placeholder="0"
                                    value={work.blogCount}
                                    onChange={(e) => {
                                      handleUpdateWorkBlock(idx, { blogCount: e.target.value });
                                    }}
                                    className="w-20 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-950 font-bold placeholder-gray-305 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition text-sm font-mono text-center"
                                  />
                                </div>

                                {/* 2. Listing count */}
                                <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-150 shadow-2xs">
                                  <label htmlFor={`listing-cnt-${idx}`} className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none">
                                    <Hash size={13} className="text-indigo-600 shrink-0" />
                                    Listings
                                  </label>
                                  <input
                                    id={`listing-cnt-${idx}`}
                                    type="number"
                                    placeholder="0"
                                    value={work.listingCount}
                                    onChange={(e) => {
                                      handleUpdateWorkBlock(idx, { listingCount: e.target.value });
                                    }}
                                    className="w-20 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-950 font-bold placeholder-gray-305 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition text-sm font-mono text-center"
                                  />
                                </div>

                                {/* 3. Forum count */}
                                <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-150 shadow-2xs">
                                  <label htmlFor={`forum-cnt-${idx}`} className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none">
                                    <MessageSquare size={13} className="text-indigo-600" />
                                    Forum
                                  </label>
                                  <input
                                    id={`forum-cnt-${idx}`}
                                    type="number"
                                    placeholder="0"
                                    value={work.forumCount}
                                    onChange={(e) => {
                                      handleUpdateWorkBlock(idx, { forumCount: e.target.value });
                                    }}
                                    className="w-20 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-950 font-bold placeholder-gray-305 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition text-sm font-mono text-center"
                                  />
                                </div>

                                {/* 4. PDF count */}
                                <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-150 shadow-2xs">
                                  <label htmlFor={`pdf-cnt-${idx}`} className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none text-ellipsis overflow-hidden">
                                    <FileText size={13} className="text-indigo-600 shrink-0" />
                                    PDF
                                  </label>
                                  <input
                                    id={`pdf-cnt-${idx}`}
                                    type="number"
                                    placeholder="0"
                                    value={work.pdfCount}
                                    onChange={(e) => {
                                      handleUpdateWorkBlock(idx, { pdfCount: e.target.value });
                                    }}
                                    className="w-20 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-950 font-bold placeholder-gray-305 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition text-sm font-mono text-center"
                                  />
                                </div>

                                {/* 5. Image count */}
                                <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-150 shadow-2xs">
                                  <label htmlFor={`image-cnt-${idx}`} className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none">
                                    <Image size={13} className="text-indigo-600 shrink-0" />
                                    Images
                                  </label>
                                  <input
                                    id={`image-cnt-${idx}`}
                                    type="number"
                                    placeholder="0"
                                    value={work.imageCount}
                                    onChange={(e) => {
                                      handleUpdateWorkBlock(idx, { imageCount: e.target.value });
                                    }}
                                    className="w-20 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-950 font-bold placeholder-gray-305 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition text-sm font-mono text-center"
                                  />
                                </div>

                                {/* 6. Video PPT count */}
                                <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-150 shadow-2xs">
                                  <label htmlFor={`videoppt-cnt-${idx}`} className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none">
                                    <Presentation size={13} className="text-indigo-600 shrink-0" />
                                    Video / PPT
                                  </label>
                                  <input
                                    id={`videoppt-cnt-${idx}`}
                                    type="number"
                                    placeholder="0"
                                    value={work.videoPptCount}
                                    onChange={(e) => {
                                      handleUpdateWorkBlock(idx, { videoPptCount: e.target.value });
                                    }}
                                    className="w-20 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-950 font-bold placeholder-gray-305 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition text-sm font-mono text-center"
                                  />
                                </div>

                                {/* 7. Profile count */}
                                <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-150 shadow-2xs">
                                  <label htmlFor={`profile-cnt-${idx}`} className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none">
                                    <User size={13} className="text-indigo-600 shrink-0" />
                                    Profile
                                  </label>
                                  <input
                                    id={`profile-cnt-${idx}`}
                                    type="number"
                                    placeholder="0"
                                    value={work.profileCount}
                                    onChange={(e) => {
                                      handleUpdateWorkBlock(idx, { profileCount: e.target.value });
                                    }}
                                    className="w-20 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-950 font-bold placeholder-gray-305 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition text-sm font-mono text-center"
                                  />
                                </div>

                                {/* 8. Link count */}
                                <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-150 shadow-2xs">
                                  <label htmlFor={`link-cnt-${idx}`} className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none">
                                    <Link size={13} className="text-indigo-600 shrink-0" />
                                    Links
                                  </label>
                                  <input
                                    id={`link-cnt-${idx}`}
                                    type="number"
                                    placeholder="0"
                                    value={work.linkCount}
                                    onChange={(e) => {
                                      handleUpdateWorkBlock(idx, { linkCount: e.target.value });
                                    }}
                                    className="w-20 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-950 font-bold placeholder-gray-305 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition text-sm font-mono text-center"
                                  />
                                </div>

                                {/* Custom Dynamic Submission fields */}
                                {customSubmissionTypes.map((type) => (
                                  <div key={type.id} className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-indigo-150 shadow-2xs">
                                    <label htmlFor={`custom-cnt-${type.id}-${idx}`} className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 shrink-0 select-none truncate">
                                      <Hash size={13} className="text-purple-600 shrink-0" />
                                      {type.name}
                                    </label>
                                    <input
                                      id={`custom-cnt-${type.id}-${idx}`}
                                      type="number"
                                      placeholder="0"
                                      value={work.customValues?.[type.id] !== undefined ? work.customValues[type.id] : ''}
                                      onChange={(e) => {
                                        const nextCustomValues = {
                                          ...(work.customValues || {}),
                                          [type.id]: e.target.value
                                        };
                                        handleUpdateWorkBlock(idx, { customValues: nextCustomValues });
                                      }}
                                      className="w-20 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-950 font-bold placeholder-gray-350 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition text-sm font-mono text-center"
                                    />
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>

                        {/* 2. Content Update block */}
                        <div className="space-y-3">
                          {/* Content Update Option Card */}
                          <label
                            className={`relative flex items-start gap-3.5 p-4.5 rounded-2xl border cursor-pointer select-none transition ${
                              (work.workTypes || []).includes('content_update')
                                ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600'
                                : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={(work.workTypes || []).includes('content_update')}
                              onChange={() => {
                                const current = work.workTypes || [];
                                const next = current.includes('content_update')
                                  ? current.filter((t: string) => t !== 'content_update')
                                  : [...current, 'content_update'];
                                handleUpdateWorkBlock(idx, { workTypes: next });
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer"
                            />
                            <div className="space-y-0.5">
                              <span className="block text-xs font-bold text-gray-900">Content Update</span>
                              <span className="block text-[10px] text-gray-400 font-medium">Select multiple checkboxes such as meta tags, keywords, restructure logs.</span>
                            </div>
                          </label>

                          {/* Dynamic Content Panel 2: Content Update Checkboxes */}
                          {(work.workTypes || []).includes('content_update') && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="border border-purple-100 bg-purple-50/10 rounded-2xl p-5 space-y-4"
                            >
                              <div className="space-y-0.5">
                                <span className="block text-[10px] font-extrabold text-purple-950 uppercase tracking-widest">
                                  ✍️ Content Update Checklist
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-white p-4.5 rounded-xl border border-purple-100 shadow-2xs">
                                {/* Checkbox 1: Meta Title & Description */}
                                <label className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition select-none">
                                  <input
                                    type="checkbox"
                                    checked={(work.contentUpdates || []).includes('meta_title_desc')}
                                    onChange={() => {
                                      const current = work.contentUpdates || [];
                                      const next = current.includes('meta_title_desc')
                                        ? current.filter((o: string) => o !== 'meta_title_desc')
                                        : [...current, 'meta_title_desc'];
                                      handleUpdateWorkBlock(idx, { contentUpdates: next });
                                    }}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-505 border-gray-300 cursor-pointer"
                                  />
                                  <span className="text-xs font-bold text-gray-800">Meta Title & Description</span>
                                </label>

                                {/* Checkbox 2: Keyword Update */}
                                <label className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition select-none">
                                  <input
                                    type="checkbox"
                                    checked={(work.contentUpdates || []).includes('keyword_update')}
                                    onChange={() => {
                                      const current = work.contentUpdates || [];
                                      const next = current.includes('keyword_update')
                                        ? current.filter((o: string) => o !== 'keyword_update')
                                        : [...current, 'keyword_update'];
                                      handleUpdateWorkBlock(idx, { contentUpdates: next });
                                    }}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-505 border-gray-300 cursor-pointer"
                                  />
                                  <span className="text-xs font-bold text-gray-800">Keyword Update</span>
                                </label>

                                {/* Checkbox 3: Section Update */}
                                <label className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition select-none">
                                  <input
                                    type="checkbox"
                                    checked={(work.contentUpdates || []).includes('section_update')}
                                    onChange={() => {
                                      const current = work.contentUpdates || [];
                                      const next = current.includes('section_update')
                                        ? current.filter((o: string) => o !== 'section_update')
                                        : [...current, 'section_update'];
                                      handleUpdateWorkBlock(idx, { contentUpdates: next });
                                    }}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-505 border-gray-300 cursor-pointer"
                                  />
                                  <span className="text-xs font-bold text-gray-800">Section Update</span>
                                </label>

                                {/* Checkbox 4: Restructure */}
                                <label className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg cursor-pointer transition select-none">
                                  <input
                                    type="checkbox"
                                    checked={(work.contentUpdates || []).includes('restructure')}
                                    onChange={() => {
                                      const current = work.contentUpdates || [];
                                      const next = current.includes('restructure')
                                        ? current.filter((o: string) => o !== 'restructure')
                                        : [...current, 'restructure'];
                                      handleUpdateWorkBlock(idx, { contentUpdates: next });
                                    }}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-505 border-gray-300 cursor-pointer"
                                  />
                                  <span className="text-xs font-bold text-gray-800">Restructure</span>
                                </label>
                              </div>
                            </motion.div>
                          )}
                        </div>

                      </div>

                      {/* Dynamic Keywords Multi-Select Sub-Section */}
                      {(() => {
                        const matchedProj = projects.find((p) => p.id === work.projectId);
                        const kws = (matchedProj?.keywords || []).filter(Boolean);
                        if (kws.length === 0) return null;

                        return (
                          <div id="keywords-selector-container" className="space-y-3.5 border border-amber-100 bg-amber-50/10 rounded-2xl p-5">
                            <span className="block text-[10px] font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                              📌 Keywords Selection
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-white p-4 rounded-xl border border-amber-150 shadow-2xs">
                              {kws.map((kw) => {
                                const selected = (work.selectedKeywords || []).includes(kw);
                                return (
                                  <label key={kw} className={`flex items-center gap-2.5 p-2 px-3 rounded-lg border cursor-pointer transition select-none ${
                                    selected
                                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                                      : 'hover:bg-slate-50 border-gray-100 text-gray-755'
                                  }`}>
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() => {
                                        const current = work.selectedKeywords || [];
                                        const next = current.includes(kw)
                                          ? current.filter((k: string) => k !== kw)
                                          : [...current, kw];
                                        if (next.length <= 8) {
                                          handleUpdateWorkBlock(idx, { selectedKeywords: next });
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold truncate select-none leading-none" title={kw}>
                                      {kw}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Row 3: Work Summary / Work Type note section to write anything */}
                      <div className="space-y-2">
                        <label htmlFor={`work-summary-${idx}`} className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                          📝 Work Notes / Summary
                        </label>
                        <textarea
                          id={`work-summary-${idx}`}
                          rows={3}
                          value={work.workSummary || ''}
                          placeholder="Type details or list references here..."
                          onChange={(e) => handleUpdateWorkBlock(idx, { workSummary: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 focus:border-indigo-600 focus:bg-white rounded-xl text-xs text-gray-950 font-medium placeholder-gray-400 focus:outline-none transition leading-relaxed"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>

            {validationError && (
              <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-800 rounded-r-xl text-sm font-semibold shadow-xs animate-shake">
                {validationError}
              </div>
            )}

            {/* Submit Actions Panel */}
            <div className="flex justify-end items-center gap-4 pt-4">
              <button
                id="work-log-compile-btn"
                type="submit"
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm hover:shadow-md flex items-center gap-2 cursor-pointer grow sm:grow-0 justify-center"
              >
                <CheckCircle2 size={16} />
                Submit Work Log
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
