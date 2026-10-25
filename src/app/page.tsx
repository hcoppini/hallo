'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  GlassWater,
  DoorOpen,
  Settings,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Tag,
  Activity,
  Search,
  RotateCcw,
  Snowflake,
  Wifi,
  Users,
  Flame,
} from 'lucide-react';
import { usePartyStore } from '@/lib/store';
import { getNextFreeTagId, parseTagId } from '@/lib/tag-utils';
import { formatDrinkHistoryLabel, BAR_DRINKS } from '@/lib/types';
import { AdminPinModal } from '@/components/AdminPinModal';
import { HelpGuideModal } from '@/components/HelpGuideModal';
import { QuickSearchModal } from '@/components/QuickSearchModal';

export default function HomePage() {
  const {
    settings,
    guests,
    logs,
    isSupabaseConnected,
    updateSettings,
    revertLastDrink,
    setSelectedGuestId,
  } = usePartyStore();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const enteredGuests = useMemo(() => guests.filter(g => g.is_entered), [guests]);
  const enteredCount = enteredGuests.length;
  const enteredPercent = Math.round((enteredCount / (guests.length || 1)) * 100);
  const totalDrinksServed = useMemo(
    () => logs.filter(l => !l.is_reverted && l.drink_type !== 'soft').length,
    [logs]
  );

  const atLimitGuests = useMemo(() => {
    return guests.filter(g => {
      const limit = g.custom_drink_limit ?? settings.default_drink_limit;
      return g.category !== 'vip' && g.category !== 'driver_minor' && g.drinks_consumed >= limit;
    });
  }, [guests, settings]);

  const nextFreeTag = useMemo(() => getNextFreeTagId(guests), [guests]);
  const nextFreeNum = parseTagId(nextFreeTag).tagNumber ?? nextFreeTag;

  // Recent 6 active logs for the live activity ticker
  const recentLogs = useMemo(() => {
    return logs
      .filter(l => !l.is_reverted)
      .slice(0, 6)
      .map(log => {
        const guest = guests.find(g => g.id === log.guest_id);
        const drinkMeta = BAR_DRINKS.find(d => d.type === log.drink_type);
        return {
          log,
          guestName: guest?.name || guest?.tag_id || 'Guest',
          tagId: guest?.tag_id || log.guest_id,
          drinkLabel: drinkMeta?.label || formatDrinkHistoryLabel(log.drink_type),
          servedAt: log.served_at,
        };
      });
  }, [logs, guests]);

  const togglePartyActive = () => {
    setIsPinModalOpen(true);
  };

  const handlePinSuccess = async () => {
    await updateSettings({ is_party_active: !settings.is_party_active });
    setIsPinModalOpen(false);
  };

  return (
    <div className="w-full py-4 sm:py-6 lg:py-8 space-y-6 lg:space-y-8 animate-in fade-in duration-200">
      {/* ================================================================ */}
      {/* 1. TOP COMMAND BAR & VENUE TELEMETRY HEADER                      */}
      {/* ================================================================ */}
      <section className="glass-card p-6 sm:p-8 border border-black/12 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/10 bg-black/[0.03] text-[11px] font-sans-clean font-semibold tracking-widest lowercase text-black/70">
                <Sparkles className="w-3.5 h-3.5 text-black" />
                <span>halloween celebration // nfc drink orchestrator</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-bold uppercase">
                <Wifi className="w-3 h-3 text-emerald-600" />
                <span>{isSupabaseConnected ? 'cloud realtime synced' : 'local mode'}</span>
              </span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-black lowercase leading-none">
              party command center.
            </h1>
            <p className="font-sans-clean text-xs sm:text-sm text-black/60 lowercase leading-relaxed">
              central orchestrator for 100 wristbands. tap physical bands on mobile or operate rapid numeric workstations on laptop terminals.
            </p>
          </div>

          {/* Quick Action Tools */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="btn-premium py-2.5 px-4 text-xs gap-1.5 cursor-pointer"
              title="Search guest (Hotkey: /)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>search guest</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-black/8 font-mono text-[10px]">
                /
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              className="btn-premium py-2.5 px-4 text-xs gap-1.5 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>setup guide</span>
            </button>

            <button
              type="button"
              onClick={togglePartyActive}
              className={`py-2.5 px-4 rounded-xl text-xs font-sans-clean font-bold tracking-wider lowercase transition-all cursor-pointer flex items-center gap-2 ${
                settings.is_party_active
                  ? 'btn-premium-danger'
                  : 'btn-premium-primary'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  settings.is_party_active ? 'bg-red-300' : 'bg-emerald-300'
                }`}
              />
              <span>{settings.is_party_active ? 'pause bar' : 'resume bar'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 2. 4-STAT EXECUTIVE KPI RIBBON                                   */}
      {/* ================================================================ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Metric 1: Guests Inside */}
        <div className="glass-card p-5 sm:p-6 border border-black/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-black/45 mb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                GUESTS INSIDE
              </span>
              <Users className="w-4 h-4 text-black/50" />
            </div>
            <div className="font-display text-4xl sm:text-5xl font-bold text-black leading-none">
              {enteredCount}
              <span className="text-xl text-black/30 font-normal">/{guests.length}</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full h-2 rounded-full bg-black/[0.06] overflow-hidden p-0.5 border border-black/8 mb-1.5">
              <div
                className="h-full bg-black rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, enteredPercent)}%` }}
              />
            </div>
            <span className="text-[11px] font-sans-clean text-black/50 lowercase">
              {enteredPercent}% venue capacity reached
            </span>
          </div>
        </div>

        {/* Metric 2: Drinks Poured */}
        <div className="glass-card p-5 sm:p-6 border border-black/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-black/45 mb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                DRINKS POURED
              </span>
              <GlassWater className="w-4 h-4 text-black/50" />
            </div>
            <div className="font-display text-4xl sm:text-5xl font-bold text-black leading-none">
              {totalDrinksServed}
            </div>
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase mt-3">
            logged across all bartender stations
          </span>
        </div>

        {/* Metric 3: Default Drink Limit */}
        <div className="glass-card p-5 sm:p-6 border border-black/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-black/45 mb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                DEFAULT LIMIT
              </span>
              <ShieldCheck className="w-4 h-4 text-black/50" />
            </div>
            <div className="font-display text-4xl sm:text-5xl font-bold text-black leading-none">
              {settings.default_drink_limit}
            </div>
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase mt-3">
            standard max drinks per adult
          </span>
        </div>

        {/* Metric 4: Guests At Limit */}
        <div className="glass-card p-5 sm:p-6 border border-black/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-black/45 mb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                SAFETY CUTOFF
              </span>
              <Flame
                className={`w-4 h-4 ${
                  atLimitGuests.length > 0 ? 'text-red-600' : 'text-black/40'
                }`}
              />
            </div>
            <div
              className={`font-display text-4xl sm:text-5xl font-bold leading-none ${
                atLimitGuests.length > 0 ? 'text-red-600' : 'text-black'
              }`}
            >
              {atLimitGuests.length}
            </div>
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase mt-3">
            {atLimitGuests.length > 0
              ? 'cut off from alcoholic service'
              : 'all guests safely within limits'}
          </span>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 3. WORKSPACE 12-COLUMN SPLIT: STATIONS & LIVE STREAMS            */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* ================================================================ */}
        {/* LEFT COLUMN (8 cols): 3 STATIONS + LIVE DRINK STREAM             */}
        {/* ================================================================ */}
        <div className="lg:col-span-8 space-y-6">
          {/* Station Launch Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-2xl font-bold lowercase text-black">
                operational stations
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-widest text-black/45">
                3 STATIONS READY
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Barman Station */}
              <Link
                href="/barman"
                className="glass-card p-5 group flex flex-col justify-between border border-black/10 hover:border-black/30 hover:shadow-md transition-all bg-white"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                      <GlassWater className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      LIVE
                    </span>
                  </div>
                  <span className="font-sans-clean text-[10px] font-bold uppercase tracking-widest text-black/45 block mb-0.5">
                    POS TERMINAL
                  </span>
                  <h4 className="font-display text-2xl font-bold lowercase text-black mb-1">
                    barman station
                  </h4>
                  <p className="font-sans-clean text-xs text-black/60 lowercase leading-relaxed mb-4">
                    numpad #1–100 dial, tactile drink POS buttons, and instant limit cutoffs.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 font-sans-clean text-xs font-bold text-black group-hover:translate-x-1 transition-transform pt-2 border-t border-black/6">
                  <span>open bar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>

              {/* Card 2: Door Check-in */}
              <Link
                href="/door"
                className="glass-card p-5 group flex flex-col justify-between border border-black/10 hover:border-black/30 hover:shadow-md transition-all bg-white"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-black/5 text-black flex items-center justify-center group-hover:scale-105 transition-transform border border-black/10">
                      <DoorOpen className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-black/70">
                      #{nextFreeNum} NEXT
                    </span>
                  </div>
                  <span className="font-sans-clean text-[10px] font-bold uppercase tracking-widest text-black/45 block mb-0.5">
                    GUEST RECEPTION
                  </span>
                  <h4 className="font-display text-2xl font-bold lowercase text-black mb-1">
                    door check-in
                  </h4>
                  <p className="font-sans-clean text-xs text-black/60 lowercase leading-relaxed mb-4">
                    onboard arrivals, assign categories, and sync physical nfc wristbands.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 font-sans-clean text-xs font-bold text-black group-hover:translate-x-1 transition-transform pt-2 border-t border-black/6">
                  <span>open door</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>

              {/* Card 3: Admin Panel */}
              <Link
                href="/admin"
                className="glass-card p-5 group flex flex-col justify-between border border-black/10 hover:border-black/30 hover:shadow-md transition-all bg-white"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-black/5 text-black flex items-center justify-center group-hover:scale-105 transition-transform border border-black/10">
                      <Settings className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-black/70">
                      CONFIG
                    </span>
                  </div>
                  <span className="font-sans-clean text-[10px] font-bold uppercase tracking-widest text-black/45 block mb-0.5">
                    SUPERVISOR
                  </span>
                  <h4 className="font-display text-2xl font-bold lowercase text-black mb-1">
                    admin panel
                  </h4>
                  <p className="font-sans-clean text-xs text-black/60 lowercase leading-relaxed mb-4">
                    manage guest spreadsheet, export CSV party reports, and adjust limits.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 font-sans-clean text-xs font-bold text-black group-hover:translate-x-1 transition-transform pt-2 border-t border-black/6">
                  <span>open admin</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          </div>

          {/* Live Activity Stream (Recent Drink Pours) */}
          <div className="glass-card p-6 border border-black/12 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/8">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-display text-2xl font-bold lowercase text-black leading-none">
                  live bar activity stream
                </h3>
              </div>
              <span className="font-mono text-xs text-black/45 font-semibold">
                {recentLogs.length} recent orders
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <div className="py-10 text-center text-xs font-sans-clean text-black/40 lowercase">
                no drinks ordered yet tonight — party is ready for its first pour!
              </div>
            ) : (
              <div className="divide-y divide-black/[0.06]">
                {recentLogs.map(({ log, guestName, tagId, drinkLabel, servedAt }) => (
                  <div
                    key={log.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs font-sans-clean"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center shrink-0 text-black">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-black lowercase truncate">
                            {guestName}
                          </span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/6 text-black/70">
                            {tagId}
                          </span>
                        </div>
                        <span className="text-[11px] text-black/55 lowercase block">
                          ordered {drinkLabel.toLowerCase()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs text-black/45 tabular-nums">
                        {new Date(servedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => revertLastDrink(log.guest_id, log.id)}
                        className="p-1.5 rounded-lg hover:bg-black/5 text-black/40 hover:text-black transition-colors"
                        title="Revert this order"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* RIGHT COLUMN (4 cols): WATCHLIST & FAST ACTION TOOLS             */}
        {/* ================================================================ */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card 1: Cutoff & Pacing Watchlist */}
          <div className="glass-card p-6 border border-black/12 shadow-md space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-black/60" />
                <h3 className="font-display text-xl font-bold lowercase text-black leading-none">
                  cooldown watchlist
                </h3>
              </div>
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                {atLimitGuests.length} maxed
              </span>
            </div>

            {atLimitGuests.length === 0 ? (
              <p className="py-6 text-center text-xs font-sans-clean text-black/45 lowercase">
                no guests on cooldown yet — everyone is pacing themselves responsibly!
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                {atLimitGuests.map(g => {
                  const slotNum = parseTagId(g.tag_id).tagNumber ?? g.tag_id;
                  return (
                    <div
                      key={g.id}
                      className="p-2.5 rounded-xl bg-black/[0.03] border border-black/8 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-bold lowercase block truncate">
                          {g.name || g.tag_id}
                        </span>
                        <span className="font-mono text-[10px] text-black/50">
                          #{slotNum} • {g.drinks_consumed} drinks
                        </span>
                      </div>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white shrink-0 uppercase">
                        LIMIT
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 2: Next Available Wristband Slot */}
          <div className="glass-card p-6 border border-black/12 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                NEXT FREE WRISTBAND
              </span>
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
            </div>

            <div className="flex items-baseline justify-between">
              <div className="font-mono text-3xl font-bold text-black">
                #{nextFreeNum}
              </div>
              <span className="font-mono text-xs text-black/55">{nextFreeTag}</span>
            </div>

            <p className="font-sans-clean text-xs text-black/60 lowercase leading-relaxed">
              ready to be assigned to the next arriving guest at the door.
            </p>

            <Link
              href="/door"
              className="btn-premium-primary w-full py-2.5 text-xs gap-1.5 flex items-center justify-center"
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>admit next guest</span>
            </Link>
          </div>

          {/* Card 3: Quick Guest Directory Jump */}
          <div className="p-5 rounded-2xl bg-black/[0.03] border border-black/10 space-y-2.5 text-center">
            <h4 className="font-display text-xl font-bold lowercase text-black leading-none">
              fast guest lookup
            </h4>
            <p className="font-sans-clean text-xs text-black/55 lowercase">
              search any guest by name, tag, or inspect their pass on laptop.
            </p>
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="btn-premium w-full py-2.5 text-xs gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>open search modal (press /)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin PIN Confirmation Modal for Party Master Control */}
      <AdminPinModal
        isOpen={isPinModalOpen}
        title={settings.is_party_active ? 'pause party service' : 'resume party service'}
        subtitle="enter parent pin to change party state"
        onSuccess={handlePinSuccess}
        onClose={() => setIsPinModalOpen(false)}
      />

      {/* In-App Helper Guide Modal */}
      <HelpGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Global Quick Search Modal */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectGuest={g => setSelectedGuestId(g.id)}
      />
    </div>
  );
}
