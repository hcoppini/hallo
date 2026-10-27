'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Ban,
  CheckCircle,
  UserPlus,
  X,
  ArrowUpDown,
  ChevronRight,
  SlidersHorizontal,
  Sparkles,
  ShieldAlert,
  Car,
  Users,
  LayoutGrid,
  Table2,
  FileSpreadsheet,
} from 'lucide-react';
import { Guest } from '@/lib/types';
import { usePartyStore } from '@/lib/store';
import { calculateEffectiveLimit } from '@/lib/party-engine';
import {
  AdminGuestFilter,
  AdminGuestSort,
  computeAdminKpis,
  extractCleanNotes,
  filterAndSortGuests,
  isGuestActiveOrAssigned,
} from '@/lib/admin-utils';
import { GuestEditModal } from './GuestEditModal';
import { GuestListImportModal } from './GuestListImportModal';

interface GuestTableProps {
  activeFilter?: AdminGuestFilter;
  onFilterChange?: (filter: AdminGuestFilter) => void;
}

const INITIAL_VISIBLE_COUNT = 30;

export function GuestTable({ activeFilter, onFilterChange }: GuestTableProps) {
  const { guests, logs, settings, importedGuests } = usePartyStore();
  const [search, setSearch] = useState('');
  const [internalFilter, setInternalFilter] = useState<AdminGuestFilter>('active');
  const [sortBy, setSortBy] = useState<AdminGuestSort>('tag_asc');
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const [desktopViewMode, setDesktopViewMode] = useState<'cards' | 'table'>('cards');

  const currentFilter = activeFilter ?? internalFilter;

  const setFilter = (next: AdminGuestFilter) => {
    setInternalFilter(next);
    setShowAllRows(false);
    onFilterChange?.(next);
  };

  useEffect(() => {
    setShowAllRows(false);
  }, [currentFilter, search, sortBy]);

  const kpis = useMemo(
    () => computeAdminKpis(guests, logs, settings),
    [guests, logs, settings]
  );

  const filteredGuests = useMemo(
    () =>
      filterAndSortGuests(guests, settings, {
        search,
        filter: currentFilter,
        sort: sortBy,
      }),
    [guests, settings, search, currentFilter, sortBy]
  );

  const nextUnassignedGuest = useMemo(
    () => guests.find(g => !isGuestActiveOrAssigned(g)) || null,
    [guests]
  );

  const visibleGuests = useMemo(() => {
    if (showAllRows || search.trim().length > 0) {
      return filteredGuests;
    }
    return filteredGuests.slice(0, INITIAL_VISIBLE_COUNT);
  }, [filteredGuests, showAllRows, search]);

  // Keep editingGuest synced with latest store updates while modal is open
  const liveEditingGuest = useMemo(() => {
    if (!editingGuest) return null;
    return guests.find(g => g.id === editingGuest.id) || editingGuest;
  }, [guests, editingGuest]);

  const filterTabs: Array<{
    id: AdminGuestFilter;
    label: string;
    count: number;
    accent?: 'danger' | 'amber' | 'blue';
  }> = [
    { id: 'active', label: 'checked in', count: kpis.activeCount },
    {
      id: 'at_limit',
      label: 'at limit',
      count: kpis.atLimitCount,
      accent: kpis.atLimitCount > 0 ? 'danger' : undefined,
    },
    { id: 'vip', label: 'vip', count: kpis.vipCount, accent: 'amber' },
    { id: 'driver', label: 'drivers / 0 alc', count: kpis.driverCount, accent: 'blue' },
    {
      id: 'blocked',
      label: 'blocked',
      count: kpis.blockedCount,
      accent: kpis.blockedCount > 0 ? 'danger' : undefined,
    },
    { id: 'unassigned', label: 'unassigned', count: kpis.unassignedCount },
    { id: 'all', label: 'all slots', count: kpis.totalSlots },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Top Search, Sort, View Mode & Quick Assign Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Search guest name, tag (e.g. 14 or TAG-014), notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-white border border-black/12 rounded-2xl text-xs font-sans-clean text-black outline-none focus:border-black shadow-2xs transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-black/40 hover:text-black hover:bg-black/5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort, Desktop View Toggle & Quick Assign Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/45 pointer-events-none" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as AdminGuestSort)}
              aria-label="Sort guests"
              className="w-full sm:w-auto pl-8 pr-7 py-2.5 bg-white border border-black/12 rounded-2xl text-xs font-sans-clean font-semibold text-black/75 lowercase outline-none focus:border-black cursor-pointer shadow-2xs"
            >
              <option value="tag_asc">sort: tag #</option>
              <option value="drinks_desc">sort: most drinks</option>
              <option value="recent_entry">sort: recent entry</option>
              <option value="name_asc">sort: name a–z</option>
            </select>
          </div>

          {/* Desktop View Mode Toggle (Cards vs Table) on md+ */}
          <div className="hidden md:flex items-center p-1 rounded-2xl bg-black/[0.05] border border-black/10">
            <button
              type="button"
              onClick={() => setDesktopViewMode('cards')}
              title="Card Grid View"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-sans-clean font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                desktopViewMode === 'cards'
                  ? 'bg-white text-black shadow-xs'
                  : 'text-black/50 hover:text-black'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">cards</span>
            </button>
            <button
              type="button"
              onClick={() => setDesktopViewMode('table')}
              title="High-Density Table View"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-sans-clean font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                desktopViewMode === 'table'
                  ? 'bg-white text-black shadow-xs'
                  : 'text-black/50 hover:text-black'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">table</span>
            </button>
          </div>

          {/* Guest List CSV Importer Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="btn-premium py-2.5 px-3.5 text-xs gap-1.5 shrink-0"
            title="Import or manage expected guest roster"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">guest list</span>
            {importedGuests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-black/8 text-[10px] font-mono font-bold">
                {importedGuests.filter(g => g.is_checked_in).length}/{importedGuests.length}
              </span>
            )}
          </button>

          {nextUnassignedGuest && (
            <button
              type="button"
              onClick={() => setEditingGuest(nextUnassignedGuest)}
              className="btn-premium-primary py-2.5 px-4 text-xs gap-1.5 shrink-0"
              title={`Assign next available wristband (${nextUnassignedGuest.tag_id})`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>assign {nextUnassignedGuest.tag_id}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {filterTabs.map(tab => {
          const isSelected = currentFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-sans-clean font-semibold tracking-wide lowercase transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                isSelected
                  ? 'bg-black text-white border-black shadow-xs'
                  : tab.accent === 'danger' && tab.count > 0
                  ? 'bg-red-50 hover:bg-red-100 text-red-800 border-red-200'
                  : 'bg-white/80 hover:bg-black/5 text-black/65 border-black/10'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : tab.accent === 'danger' && tab.count > 0
                    ? 'bg-red-200/70 text-red-900'
                    : 'bg-black/6 text-black/60'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Guest List: Responsive 1/2/3-Column Card Grid OR Desktop Spreadsheet Table */}
      {filteredGuests.length === 0 ? (
        <div className="glass-card p-10 text-center border border-black/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mx-auto text-black/40">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-display text-2xl font-bold lowercase text-black">
              {currentFilter === 'active' && !search
                ? 'no guests checked in yet'
                : 'no matching wristbands'}
            </h3>
            <p className="font-sans-clean text-xs text-black/50 lowercase max-w-sm mx-auto mt-1">
              {currentFilter === 'active' && !search
                ? 'unassigned wristband slots are hidden by default to keep your view uncluttered.'
                : 'try clearing your search query or switching to a different filter pill above.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {currentFilter === 'active' && !search && nextUnassignedGuest && (
              <button
                type="button"
                onClick={() => setEditingGuest(nextUnassignedGuest)}
                className="btn-premium-primary py-2.5 px-4 text-xs gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>assign first guest ({nextUnassignedGuest.tag_id})</span>
              </button>
            )}
            {currentFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="btn-premium py-2.5 px-4 text-xs gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>view all {kpis.totalSlots} slots</span>
              </button>
            )}
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="btn-premium py-2.5 px-4 text-xs"
              >
                clear search
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop High-Density Table View (only when selected on md+ screens) */}
          {desktopViewMode === 'table' && (
            <div className="hidden md:block glass-card border border-black/12 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 bg-black/[0.025] font-mono text-[10px] font-bold uppercase tracking-wider text-black/50">
                      <th className="py-3.5 px-4">Wristband</th>
                      <th className="py-3.5 px-4">Guest Name</th>
                      <th className="py-3.5 px-4">Tier</th>
                      <th className="py-3.5 px-4">Status &amp; Entry</th>
                      <th className="py-3.5 px-4">Drinks / Limit</th>
                      <th className="py-3.5 px-4">Notes</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06] font-sans-clean text-xs">
                    {visibleGuests.map(guest => {
                      const limit = calculateEffectiveLimit(guest, settings);
                      const isAssigned = isGuestActiveOrAssigned(guest);
                      const isAtLimit =
                        guest.category !== 'vip' &&
                        guest.category !== 'driver_minor' &&
                        limit > 0 &&
                        guest.drinks_consumed >= limit;
                      const isNearLimit =
                        guest.category !== 'vip' &&
                        guest.category !== 'driver_minor' &&
                        limit > 1 &&
                        guest.drinks_consumed === limit - 1;
                      const cleanNotes = extractCleanNotes(guest.notes);

                      return (
                        <tr
                          key={guest.id}
                          onClick={() => setEditingGuest(guest)}
                          className={`transition-colors cursor-pointer ${
                            guest.is_blocked || isAtLimit
                              ? 'bg-red-50/35 hover:bg-red-50/70'
                              : 'hover:bg-black/[0.025]'
                          }`}
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold ${
                                guest.is_blocked
                                  ? 'bg-red-600 text-white'
                                  : isAssigned
                                  ? 'bg-black text-white'
                                  : 'bg-black/6 text-black/60'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  guest.is_blocked
                                    ? 'bg-white'
                                    : guest.is_entered
                                    ? 'bg-emerald-400'
                                    : 'bg-black/25'
                                }`}
                              />
                              {guest.tag_id}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-black">
                            {guest.name ? (
                              guest.name
                            ) : (
                              <span className="font-normal italic text-black/35">
                                unassigned slot
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {guest.category === 'vip' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 uppercase">
                                <Sparkles className="w-2.5 h-2.5" />
                                VIP
                              </span>
                            ) : guest.category === 'driver_minor' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 uppercase">
                                <Car className="w-2.5 h-2.5" />
                                0 ALC
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-black/5 text-black/65 lowercase">
                                standard
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {guest.is_blocked ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 uppercase">
                                <Ban className="w-2.5 h-2.5" />
                                blocked
                              </span>
                            ) : isAtLimit ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 uppercase">
                                <ShieldAlert className="w-2.5 h-2.5" />
                                at limit
                              </span>
                            ) : guest.is_entered ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 lowercase">
                                <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                {guest.entered_at
                                  ? new Date(guest.entered_at).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'inside'}
                              </span>
                            ) : (
                              <span className="text-[11px] text-black/35 lowercase">
                                not entered
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`font-display text-lg font-bold w-10 ${
                                  guest.is_blocked || isAtLimit
                                    ? 'text-red-600'
                                    : isNearLimit
                                    ? 'text-amber-600'
                                    : 'text-black'
                                }`}
                              >
                                {guest.drinks_consumed}
                                <span className="text-xs font-normal text-black/35">
                                  /{guest.category === 'vip' ? '∞' : limit}
                                </span>
                              </span>
                              {guest.category !== 'vip' && (
                                <div className="w-16 bg-black/10 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      guest.is_blocked || isAtLimit
                                        ? 'bg-red-600'
                                        : isNearLimit
                                        ? 'bg-amber-500'
                                        : 'bg-black'
                                    }`}
                                    style={{
                                      width: `${
                                        limit === 0
                                          ? guest.is_entered
                                            ? 100
                                            : 0
                                          : Math.min(100, (guest.drinks_consumed / limit) * 100)
                                      }%`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-[200px] truncate text-black/55">
                            {cleanNotes || '—'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/5 hover:bg-black hover:text-white text-[11px] font-semibold lowercase transition-colors">
                              <span>edit</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Responsive Card Grid (Always on mobile, and on desktop when desktopViewMode === 'cards') */}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 lg:gap-3.5 ${
              desktopViewMode === 'table' ? 'md:hidden' : ''
            }`}
          >
            {visibleGuests.map(guest => {
              const limit = calculateEffectiveLimit(guest, settings);
              const isAssigned = isGuestActiveOrAssigned(guest);
              const isAtLimit =
                guest.category !== 'vip' &&
                guest.category !== 'driver_minor' &&
                limit > 0 &&
                guest.drinks_consumed >= limit;
              const isNearLimit =
                guest.category !== 'vip' &&
                guest.category !== 'driver_minor' &&
                limit > 1 &&
                guest.drinks_consumed === limit - 1;
              const cleanNotes = extractCleanNotes(guest.notes);

              return (
                <button
                  key={guest.id}
                  type="button"
                  onClick={() => setEditingGuest(guest)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 group cursor-pointer active:scale-[0.99] ${
                    guest.is_blocked
                      ? 'bg-red-50/40 border-red-200 hover:border-red-300'
                      : isAtLimit
                      ? 'bg-red-50/25 border-red-200/80 hover:border-red-300'
                      : isAssigned
                      ? 'bg-white/90 border-black/10 hover:border-black/25 shadow-2xs'
                      : 'bg-white/50 border-black/8 hover:bg-white/80 hover:border-black/15'
                  }`}
                >
                  {/* Left Info Column */}
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Top Row: Tag Pill + Name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold shrink-0 ${
                          guest.is_blocked
                            ? 'bg-red-600 text-white'
                            : isAssigned
                            ? 'bg-black text-white'
                            : 'bg-black/6 text-black/60'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            guest.is_blocked
                              ? 'bg-white'
                              : guest.is_entered
                              ? 'bg-emerald-400'
                              : 'bg-black/25'
                          }`}
                        />
                        {guest.tag_id}
                      </span>

                      <span
                        className={`font-sans-clean text-sm truncate ${
                          guest.name
                            ? 'font-bold text-black'
                            : 'font-normal italic text-black/35'
                        }`}
                      >
                        {guest.name || 'unassigned slot'}
                      </span>
                    </div>

                    {/* Sub Row: Category, Status & Notes */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Category Badge */}
                      {guest.category === 'vip' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-sans-clean font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 uppercase">
                          <Sparkles className="w-2.5 h-2.5" />
                          VIP
                        </span>
                      )}
                      {guest.category === 'driver_minor' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-sans-clean font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 uppercase">
                          <Car className="w-2.5 h-2.5" />
                          0 ALC
                        </span>
                      )}
                      {guest.category === 'standard' && isAssigned && (
                        <span className="inline-flex items-center text-[10px] font-sans-clean font-medium px-2 py-0.5 rounded-full bg-black/5 text-black/60 lowercase">
                          standard
                        </span>
                      )}

                      {/* Custom Limit Indicator */}
                      {guest.custom_drink_limit !== null && guest.category === 'standard' && (
                        <span className="inline-flex items-center text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-black/5 text-black/70">
                          limit: {guest.custom_drink_limit}
                        </span>
                      )}

                      {/* Status Badges */}
                      {guest.is_blocked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-sans-clean font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 uppercase">
                          <Ban className="w-2.5 h-2.5" />
                          blocked
                        </span>
                      ) : isAtLimit ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-sans-clean font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 uppercase">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          at limit
                        </span>
                      ) : guest.is_entered ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-sans-clean font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 lowercase">
                          <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                          {guest.entered_at
                            ? new Date(guest.entered_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'inside'}
                        </span>
                      ) : null}

                      {/* Clean Notes Preview */}
                      {cleanNotes && (
                        <span className="text-[11px] font-sans-clean text-black/50 truncate max-w-[180px]">
                          • {cleanNotes}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Drink Counter & Progress Column */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div
                        className={`font-display text-xl font-bold leading-none ${
                          guest.is_blocked || isAtLimit
                            ? 'text-red-600'
                            : isNearLimit
                            ? 'text-amber-600'
                            : isAssigned
                            ? 'text-black'
                            : 'text-black/35'
                        }`}
                      >
                        {guest.drinks_consumed}
                        <span className="text-sm font-normal text-black/35">
                          /{guest.category === 'vip' ? '∞' : limit}
                        </span>
                      </div>

                      {guest.category !== 'vip' ? (
                        <div className="w-14 bg-black/10 rounded-full h-1.5 overflow-hidden mt-1.5 ml-auto">
                          <div
                            className={`h-full rounded-full transition-all ${
                              guest.is_blocked || isAtLimit
                                ? 'bg-red-600'
                                : isNearLimit
                                ? 'bg-amber-500'
                                : 'bg-black'
                            }`}
                            style={{
                              width: `${
                                limit === 0
                                  ? guest.is_entered
                                    ? 100
                                    : 0
                                  : Math.min(100, (guest.drinks_consumed / limit) * 100)
                              }%`,
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-[9px] font-mono uppercase tracking-wider text-amber-700 block mt-1">
                          unlimited
                        </span>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-black/25 group-hover:text-black/60 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Progressive Show All Footer */}
          {filteredGuests.length > visibleGuests.length && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowAllRows(true)}
                className="btn-premium py-2.5 px-6 text-xs"
              >
                show all {filteredGuests.length} wristbands ({filteredGuests.length - visibleGuests.length} more)
              </button>
            </div>
          )}
        </>
      )}

      {/* Enhanced Guest Profile / Edit Modal */}
      <GuestEditModal
        guest={liveEditingGuest}
        isOpen={Boolean(liveEditingGuest)}
        onClose={() => setEditingGuest(null)}
      />

      {/* Guest List CSV Importer & Roster Modal */}
      <GuestListImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}
