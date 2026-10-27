'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Users,
  UserCheck,
  Clock,
  Download,
  Trash2,
  Plus,
  Search,
  Sparkles,
  Car,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { soundSystem } from '@/lib/audio';
import { parseGuestCsv, cleanGuestName } from '@/lib/guest-import-utils';
import { GuestCategory, ImportedGuest } from '@/lib/types';

interface GuestListImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GuestListImportModal({ isOpen, onClose }: GuestListImportModalProps) {
  const {
    guests,
    importedGuests,
    importGuestList,
    addImportedGuest,
    removeImportedGuest,
    clearImportedGuests,
    exportImportedGuestsCsv,
  } = usePartyStore();

  const [activeTab, setActiveTab] = useState<'import' | 'roster'>('import');
  const [inputText, setInputText] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<'all' | 'pending' | 'checked_in'>('all');
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestCategory, setNewGuestCategory] = useState<GuestCategory>('standard');
  const [isAddingSingle, setIsAddingSingle] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live parsing preview of input text
  const parseResult = useMemo(() => {
    return parseGuestCsv(inputText, guests);
  }, [inputText, guests]);

  // Telemetry for the roster
  const rosterStats = useMemo(() => {
    const total = importedGuests.length;
    const checkedIn = importedGuests.filter(g => g.is_checked_in).length;
    const pending = total - checkedIn;
    const checkedInPercent = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    return { total, checkedIn, pending, checkedInPercent };
  }, [importedGuests]);

  // Filtered roster for the roster tab
  const filteredRoster = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return importedGuests.filter(g => {
      if (rosterFilter === 'pending' && g.is_checked_in) return false;
      if (rosterFilter === 'checked_in' && !g.is_checked_in) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [importedGuests, rosterFilter, rosterSearch]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      if (content) {
        setInputText(content);
        soundSystem.playApprovedSound();
        setFeedback({
          type: 'success',
          message: `Loaded "${file.name}" (${file.size} bytes). Review the preview below.`,
        });
      }
    };
    reader.onerror = () => {
      setFeedback({ type: 'error', message: 'Failed to read uploaded file.' });
      soundSystem.playErrorSound();
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    if (parseResult.guests.length === 0) {
      setFeedback({ type: 'error', message: 'No valid guest names found to import.' });
      soundSystem.playErrorSound();
      return;
    }

    importGuestList(parseResult.guests, importMode);
    soundSystem.playApprovedSound();
    soundSystem.vibrate(25);
    setFeedback({
      type: 'success',
      message: `Successfully imported ${parseResult.guests.length} guests into expected roster!`,
    });
    setInputText('');
    setActiveTab('roster');
  };

  const handleAddSingleGuest = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newGuestName.trim();
    if (!clean) return;

    addImportedGuest({
      name: clean,
      category: newGuestCategory,
    });
    soundSystem.playApprovedSound();
    setNewGuestName('');
    setIsAddingSingle(false);
  };

  const handleExportRoster = () => {
    const csv = exportImportedGuestsCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `party_expected_guest_roster_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    soundSystem.playApprovedSound();
  };

  const handleClearAll = () => {
    clearImportedGuests();
    setIsConfirmClearOpen(false);
    soundSystem.playApprovedSound();
  };

  const loadSampleData = () => {
    setInputText('[Janek Smagiel, Ania Beta, Michał Wiśniewski, Kasia Kowalska, Bartek Nowak, Ola Zielińska]');
    soundSystem.playApprovedSound();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-black/15 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-black/10 flex items-center justify-between gap-3 bg-black/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-xl sm:text-2xl font-bold lowercase text-black leading-none">
                  guest list & csv import
                </h2>
                {importedGuests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-black/5 border border-black/10 text-[10px] font-mono font-bold text-black/70">
                    {rosterStats.checkedIn}/{rosterStats.total} arrived
                  </span>
                )}
              </div>
              <p className="font-sans-clean text-xs text-black/50 lowercase mt-0.5">
                import invited names for instant door check-in autofill
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-black/40 hover:text-black hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 pb-2 border-b border-black/8 flex items-center gap-2 bg-black/[0.01]">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-xl text-xs font-sans-clean font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'bg-black text-white shadow-sm'
                : 'text-black/60 hover:text-black hover:bg-black/5'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>import / paste csv</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-xl text-xs font-sans-clean font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'roster'
                ? 'bg-black text-white shadow-sm'
                : 'text-black/60 hover:text-black hover:bg-black/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>current roster ({importedGuests.length})</span>
          </button>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`mx-5 mt-3 p-3 rounded-2xl text-xs font-sans-clean flex items-center justify-between gap-2 border animate-in fade-in duration-100 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="p-1 hover:opacity-70"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'import' ? (
            <div className="space-y-4">
              {/* File Upload & Helper Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-premium py-2 px-3.5 text-xs gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>upload .csv file</span>
                </button>

                <button
                  type="button"
                  onClick={loadSampleData}
                  className="text-xs font-sans-clean font-semibold text-black/60 hover:text-black underline cursor-pointer"
                >
                  load example [Janek Smagiel, Ania Beta, ...]
                </button>
              </div>

              {/* Text Input Area */}
              <div>
                <label className="block text-xs font-sans-clean font-bold text-black lowercase mb-1.5">
                  paste comma-separated names or csv text:
                </label>
                <textarea
                  rows={5}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="[Janek Smagiel, Ania Beta, Michał Wiśniewski, ]&#10;or multi-line list / CSV format"
                  className="w-full p-3.5 bg-black/[0.03] border border-black/15 rounded-2xl font-mono text-xs text-black placeholder:text-black/35 outline-none focus:bg-white focus:border-black transition-colors"
                />
                <span className="text-[11px] font-sans-clean text-black/45 lowercase block mt-1">
                  supports bracketed lists `[Janek Smagiel, Ania Beta, ]`, plain comma lists, and multi-line CSVs.
                </span>
              </div>

              {/* Live Parser Preview */}
              {parseResult.guests.length > 0 && (
                <div className="p-4 rounded-2xl bg-black/[0.025] border border-black/10 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="font-sans-clean text-xs font-bold text-black lowercase flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      detected {parseResult.guests.length} guest
                      {parseResult.guests.length === 1 ? '' : 's'}
                    </span>
                    {parseResult.duplicatesRemoved > 0 && (
                      <span className="text-[10px] font-sans-clean text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        {parseResult.duplicatesRemoved} duplicate
                        {parseResult.duplicatesRemoved === 1 ? '' : 's'} stripped
                      </span>
                    )}
                  </div>

                  {/* Parsed names preview tags */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                    {parseResult.guests.map((g, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-sans-clean font-semibold border ${
                          g.is_checked_in
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-white text-black/80 border-black/10'
                        }`}
                      >
                        <span>{g.name}</span>
                        {g.category === 'vip' && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-900 font-bold uppercase">
                            vip
                          </span>
                        )}
                        {g.category === 'driver_minor' && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 text-blue-900 font-bold uppercase">
                            driver
                          </span>
                        )}
                        {g.is_checked_in && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-600 text-white font-bold">
                            arrived
                          </span>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* Import Mode Radio Toggle */}
                  <div className="pt-2 border-t border-black/8 flex items-center gap-4 text-xs font-sans-clean">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-black accent-black"
                      />
                      <span>replace entire roster</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="append"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="text-black accent-black"
                      />
                      <span>merge / add to existing roster</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                {inputText && (
                  <button
                    type="button"
                    onClick={() => setInputText('')}
                    className="py-2.5 px-4 text-xs font-sans-clean text-black/50 hover:text-black cursor-pointer"
                  >
                    clear text
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={parseResult.guests.length === 0}
                  className="btn-premium-primary py-3 px-6 text-xs gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>
                    confirm & import {parseResult.guests.length > 0 ? `${parseResult.guests.length} guests` : ''}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Current Roster View */
            <div className="space-y-4">
              {/* Telemetry Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-black/[0.03] border border-black/8 text-center">
                  <span className="text-[10px] font-sans-clean uppercase tracking-wider text-black/45 block font-bold">
                    total invited
                  </span>
                  <span className="font-display text-2xl sm:text-3xl font-bold text-black">
                    {rosterStats.total}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[10px] font-sans-clean uppercase tracking-wider text-emerald-800 block font-bold">
                    arrived
                  </span>
                  <span className="font-display text-2xl sm:text-3xl font-bold text-emerald-700">
                    {rosterStats.checkedIn}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                  <span className="text-[10px] font-sans-clean uppercase tracking-wider text-amber-800 block font-bold">
                    awaiting
                  </span>
                  <span className="font-display text-2xl sm:text-3xl font-bold text-amber-700">
                    {rosterStats.pending}
                  </span>
                </div>
              </div>

              {/* Search, Filter & Quick Add Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search invited guests..."
                    value={rosterSearch}
                    onChange={e => setRosterSearch(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 bg-black/[0.03] border border-black/15 rounded-xl text-xs font-sans-clean text-black outline-none focus:bg-white focus:border-black"
                  />
                  {rosterSearch && (
                    <button
                      type="button"
                      onClick={() => setRosterSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-black/40 hover:text-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-black/[0.04] p-1 rounded-xl">
                  {(
                    [
                      { id: 'all', label: 'all' },
                      { id: 'pending', label: 'awaiting' },
                      { id: 'checked_in', label: 'arrived' },
                    ] as const
                  ).map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setRosterFilter(t.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-sans-clean font-semibold lowercase transition-all cursor-pointer ${
                        rosterFilter === t.id
                          ? 'bg-white text-black shadow-2xs font-bold'
                          : 'text-black/50 hover:text-black'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Single Add Toggle */}
                <button
                  type="button"
                  onClick={() => setIsAddingSingle(prev => !prev)}
                  className="btn-premium py-2 px-3 text-xs gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>add guest</span>
                </button>
              </div>

              {/* Single Guest Add Form */}
              {isAddingSingle && (
                <form
                  onSubmit={handleAddSingleGuest}
                  className="p-3 rounded-2xl bg-black/[0.03] border border-black/10 flex flex-wrap items-center gap-2 animate-in fade-in duration-100"
                >
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Guest name or nickname..."
                    value={newGuestName}
                    onChange={e => setNewGuestName(e.target.value)}
                    className="flex-1 min-w-[180px] px-3 py-1.5 bg-white border border-black/15 rounded-xl text-xs font-sans-clean text-black outline-none focus:border-black"
                  />
                  <select
                    value={newGuestCategory}
                    onChange={e => setNewGuestCategory(e.target.value as GuestCategory)}
                    className="px-2.5 py-1.5 bg-white border border-black/15 rounded-xl text-xs font-sans-clean text-black outline-none cursor-pointer"
                  >
                    <option value="standard">Standard</option>
                    <option value="vip">VIP</option>
                    <option value="driver_minor">Driver (0-alc)</option>
                  </select>
                  <button
                    type="submit"
                    className="btn-premium-primary py-1.5 px-3.5 text-xs font-sans-clean cursor-pointer"
                  >
                    save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingSingle(false)}
                    className="p-1.5 text-black/40 hover:text-black cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Roster List Table / Cards */}
              {filteredRoster.length === 0 ? (
                <div className="p-8 text-center bg-black/[0.015] rounded-2xl border border-black/8 space-y-1">
                  <p className="font-sans-clean text-xs font-semibold text-black/60 lowercase">
                    {importedGuests.length === 0
                      ? 'no guests in expected roster yet'
                      : 'no matching guests found'}
                  </p>
                  <p className="font-sans-clean text-[11px] text-black/40 lowercase">
                    {importedGuests.length === 0
                      ? 'switch to the "import / paste csv" tab to upload or paste your list.'
                      : 'try clearing your search or filter.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-black/8 border border-black/10 rounded-2xl overflow-hidden max-h-72 overflow-y-auto bg-white">
                  {filteredRoster.map(g => (
                    <div
                      key={g.id}
                      className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-black/[0.015] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            g.is_checked_in ? 'bg-emerald-500' : 'bg-amber-400'
                          }`}
                        />
                        <div className="min-w-0">
                          <span className="font-sans-clean text-xs sm:text-sm font-bold text-black truncate block">
                            {g.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {g.category === 'vip' && (
                              <span className="text-[10px] font-sans-clean px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold uppercase">
                                vip
                              </span>
                            )}
                            {g.category === 'driver_minor' && (
                              <span className="text-[10px] font-sans-clean px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-bold uppercase">
                                driver
                              </span>
                            )}
                            {g.notes && (
                              <span className="text-[11px] font-sans-clean text-black/45 truncate max-w-[160px]">
                                {g.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {g.is_checked_in ? (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-mono font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{g.checked_in_tag_id || 'Arrived'}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-black/5 text-black/50 text-[10px] font-sans-clean lowercase">
                            awaiting
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => removeImportedGuest(g.id)}
                          className="p-1 rounded-lg text-black/30 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remove from roster"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Roster Bottom Actions */}
              {importedGuests.length > 0 && (
                <div className="pt-2 border-t border-black/8 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleExportRoster}
                    className="btn-premium py-2 px-3 text-xs gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>export roster csv</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsConfirmClearOpen(true)}
                    className="text-xs font-sans-clean text-red-600 hover:text-red-800 underline cursor-pointer"
                  >
                    clear entire roster
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clear Confirmation Dialog */}
        {isConfirmClearOpen && (
          <div className="p-4 bg-red-50 border-t border-red-200 flex items-center justify-between gap-3 animate-in fade-in duration-100">
            <div className="flex items-center gap-2 text-xs font-sans-clean text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Are you sure you want to clear the entire guest roster?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmClearOpen(false)}
                className="py-1 px-2.5 rounded-lg text-xs font-sans-clean text-black/60 hover:text-black cursor-pointer"
              >
                cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="py-1 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-sans-clean font-bold cursor-pointer"
              >
                yes, clear all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
