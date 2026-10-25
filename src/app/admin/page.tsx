'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GuestTable } from '@/components/GuestTable';
import { DrinkHistoryList } from '@/components/DrinkHistoryList';
import { NfcWriterModal } from '@/components/NfcWriterModal';
import { AdminPinModal } from '@/components/AdminPinModal';
import { StationLockScreen } from '@/components/StationLockScreen';
import { usePartyStore } from '@/lib/store';
import { useStaffAuth } from '@/lib/auth';
import {
  Sliders,
  Radio,
  Download,
  RotateCcw,
  Save,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Users,
  Activity,
  LogOut,
  Pause,
  Play,
  Minus,
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertTriangle,
  GlassWater,
  ShieldAlert,
  Car,
} from 'lucide-react';
import { soundSystem } from '@/lib/audio';
import { AdminGuestFilter, computeAdminKpis } from '@/lib/admin-utils';

export type AdminTab = 'guests' | 'activity' | 'settings';

export default function AdminPage() {
  const {
    settings,
    guests,
    logs,
    isSyncing,
    isSupabaseConnected,
    updateSettings,
    exportCsv,
    resetParty,
    refresh,
  } = usePartyStore();
  const { isAuthenticated, logout } = useStaffAuth();

  // Navigation & Filter State
  const [activeTab, setActiveTab] = useState<AdminTab>('guests');
  const [guestFilter, setGuestFilter] = useState<AdminGuestFilter>('active');

  // Settings Form State
  const [defaultLimit, setDefaultLimit] = useState(settings.default_drink_limit);
  const [partyName, setPartyName] = useState(settings.party_name);
  const [adminPin, setAdminPin] = useState(settings.admin_pin);
  const [showPin, setShowPin] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Modals State
  const [isWriterOpen, setIsWriterOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    setDefaultLimit(settings.default_drink_limit);
    setPartyName(settings.party_name);
    setAdminPin(settings.admin_pin);
  }, [settings]);

  const kpis = useMemo(
    () => computeAdminKpis(guests, logs, settings),
    [guests, logs, settings]
  );

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedLimit = Math.max(1, Math.min(20, Number(defaultLimit) || 5));
    await updateSettings({
      default_drink_limit: sanitizedLimit,
      party_name: partyName.trim() || 'Halloween Birthday Party 2026',
      admin_pin: adminPin.trim() || '2113',
    });
    soundSystem.playApprovedSound();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTogglePartyActive = async () => {
    soundSystem.vibrate(25);
    await updateSettings({ is_party_active: !settings.is_party_active });
    soundSystem.playApprovedSound();
  };

  const handleExport = () => {
    const csvData = exportCsv();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `halloween_party_guests_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    soundSystem.playApprovedSound();
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2500);
  };

  const handleManualSync = async () => {
    soundSystem.vibrate(15);
    await refresh();
    soundSystem.playApprovedSound();
    setSyncSuccess(true);
    setTimeout(() => setSyncSuccess(false), 2500);
  };

  const handleResetExecute = async () => {
    await resetParty(100);
    setIsResetConfirmOpen(false);
    soundSystem.playApprovedSound();
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3500);
  };

  const jumpToGuestsWithFilter = (filter: AdminGuestFilter) => {
    soundSystem.vibrate(15);
    setGuestFilter(filter);
    setActiveTab('guests');
  };

  // If not authenticated, require PIN before viewing admin controls
  if (!isAuthenticated) {
    return (
      <StationLockScreen
        stationTitle="admin panel"
        stationSubtitle="enter 4-digit supervisor pin to access rules, telemetry, and settings"
        stationBadge="SECURITY GATEWAY"
      />
    );
  }

  return (
    <div className="w-full py-4 lg:py-6 space-y-5 lg:space-y-6">
      {/* 1. Compact Supervisor Status & Master Control Header */}
      <div className="p-3 sm:p-4 rounded-2xl bg-black text-white text-xs font-sans-clean flex flex-wrap items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="truncate">
            <span className="font-bold text-[10px] tracking-wider uppercase block leading-tight">
              Supervisor Control
            </span>
            <span className="text-[10px] text-white/60 lowercase truncate block leading-tight">
              {settings.party_name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 1-Tap Party Active / Pause Master Toggle */}
          <button
            type="button"
            onClick={handleTogglePartyActive}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold lowercase flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              settings.is_party_active
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30'
                : 'bg-red-500 hover:bg-red-600 text-white shadow-xs'
            }`}
            title={
              settings.is_party_active
                ? 'Click to pause all bar drink taps'
                : 'Click to resume bar service'
            }
          >
            {settings.is_party_active ? (
              <>
                <Pause className="w-3 h-3" />
                <span>bar live (tap to pause)</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                <span>bar paused (resume)</span>
              </>
            )}
          </button>

          {/* Lock Admin Button */}
          <button
            type="button"
            onClick={logout}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Lock Admin Panel"
          >
            <LogOut className="w-3 h-3" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive 4-Stat Live KPI Strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
        {/* KPI 1: Checked-in Guests */}
        <button
          type="button"
          onClick={() => jumpToGuestsWithFilter('active')}
          className={`p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
            activeTab === 'guests' && guestFilter === 'active'
              ? 'bg-white border-black shadow-sm'
              : 'glass-card border-black/10 hover:border-black/25'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/45">
              checked in
            </span>
            <Users className="w-3.5 h-3.5 text-black/35" />
          </div>
          <div className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-black leading-none">
            {kpis.enteredCount}
            <span className="text-base sm:text-xl text-black/35 font-normal">
              /{kpis.totalSlots}
            </span>
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1.5 truncate">
            {kpis.activeCount} assigned • {kpis.enteredPercent}% inside
          </span>
        </button>

        {/* KPI 2: Drinks Served */}
        <button
          type="button"
          onClick={() => {
            soundSystem.vibrate(15);
            setActiveTab('activity');
          }}
          className={`p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
            activeTab === 'activity'
              ? 'bg-white border-black shadow-sm'
              : 'glass-card border-black/10 hover:border-black/25'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/45">
              drinks poured
            </span>
            <GlassWater className="w-3.5 h-3.5 text-black/35" />
          </div>
          <div className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-black leading-none">
            {kpis.totalAlcoholServed}
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1.5 truncate">
            alcohol • +{kpis.totalSoftServed} soft
          </span>
        </button>

        {/* KPI 3: At Safety Limit */}
        <button
          type="button"
          onClick={() => jumpToGuestsWithFilter('at_limit')}
          className={`p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
            activeTab === 'guests' && guestFilter === 'at_limit'
              ? 'bg-white border-black shadow-sm'
              : kpis.atLimitCount > 0
              ? 'bg-red-50/50 border-red-200 hover:border-red-300'
              : 'glass-card border-black/10 hover:border-black/25'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/45">
              at safety limit
            </span>
            <ShieldAlert
              className={`w-3.5 h-3.5 ${
                kpis.atLimitCount > 0 ? 'text-red-600' : 'text-black/35'
              }`}
            />
          </div>
          <div
            className={`font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-none ${
              kpis.atLimitCount > 0 ? 'text-red-600' : 'text-black'
            }`}
          >
            {kpis.atLimitCount}
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1.5 truncate">
            {kpis.atLimitCount > 0
              ? 'cut-off active'
              : kpis.nearLimitCount > 0
              ? `${kpis.nearLimitCount} on final drink`
              : `limit: ${settings.default_drink_limit} drinks`}
          </span>
        </button>

        {/* KPI 4: Drivers, Blocked & VIP */}
        <button
          type="button"
          onClick={() =>
            jumpToGuestsWithFilter(kpis.blockedCount > 0 ? 'blocked' : 'driver')
          }
          className={`p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
            activeTab === 'guests' &&
            (guestFilter === 'driver' || guestFilter === 'blocked')
              ? 'bg-white border-black shadow-sm'
              : 'glass-card border-black/10 hover:border-black/25'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-sans-clean text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/45">
              tiers & alerts
            </span>
            <Car className="w-3.5 h-3.5 text-black/35" />
          </div>
          <div className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-black leading-none">
            {kpis.driverCount}
            <span className="text-sm sm:text-base font-sans-clean font-normal text-black/40 ml-1">
              0-alc
            </span>
          </div>
          <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-1.5 truncate">
            {kpis.vipCount} vip • {kpis.blockedCount} blocked
          </span>
        </button>
      </section>

      {/* 3. Segmented Tab Bar */}
      <div className="segmented-control p-1.5 bg-black/[0.06] rounded-2xl border border-black/8 max-w-xl">
        {(
          [
            {
              id: 'guests',
              label: 'guests',
              icon: Users,
              badge: kpis.activeCount,
            },
            {
              id: 'activity',
              label: 'activity feed',
              icon: Activity,
              badge: kpis.totalActiveLogs,
            },
            {
              id: 'settings',
              label: 'settings & tools',
              icon: Sliders,
            },
          ] as const
        ).map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundSystem.vibrate(15);
                setActiveTab(tab.id);
              }}
              className={`segmented-item flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-sans-clean lowercase ${
                isActive
                  ? 'segmented-item-active font-bold text-black'
                  : 'text-black/55 hover:text-black'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
              {'badge' in tab && tab.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-black text-white'
                      : 'bg-black/8 text-black/60'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Active Tab Content */}
      {activeTab === 'guests' && (
        <section className="animate-in fade-in duration-150">
          <GuestTable
            activeFilter={guestFilter}
            onFilterChange={setGuestFilter}
          />
        </section>
      )}

      {activeTab === 'activity' && (
        <section className="animate-in fade-in duration-150">
          <DrinkHistoryList />
        </section>
      )}

      {activeTab === 'settings' && (
        <section className="animate-in fade-in duration-150 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Card 1 (7 cols on lg): Party Rules & Security */}
            <div className="lg:col-span-7 glass-card p-6 sm:p-7 border border-black/10">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-black/8">
                <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold lowercase text-black leading-none">
                    party rules & security
                  </h2>
                  <p className="font-sans-clean text-xs text-black/50 lowercase mt-1">
                    changes propagate immediately across bar and door terminals
                  </p>
                </div>
              </div>

              {saveSuccess && (
                <div className="p-3.5 mb-5 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-sans-clean flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>settings saved and broadcasted to all devices!</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-5">
                  {/* Default Drink Limit with Steppers & Presets */}
                  <div className="p-4 rounded-2xl bg-black/[0.025] border border-black/8 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-sans-clean font-bold text-black lowercase">
                          default drink limit
                        </label>
                        <span className="text-[11px] font-sans-clean text-black/50 lowercase">
                          standard 18+ wristbands before cut-off
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setDefaultLimit(prev => Math.max(1, Number(prev) - 1))
                          }
                          className="w-9 h-9 rounded-xl bg-white border border-black/15 flex items-center justify-center text-black hover:bg-black/5 active:scale-95 transition-all"
                          aria-label="Decrease default drink limit"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <input
                          type="number"
                          min="1"
                          max="20"
                          required
                          value={defaultLimit}
                          onChange={e =>
                            setDefaultLimit(
                              Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10)))
                            )
                          }
                          className="w-14 py-1.5 bg-white border border-black/15 rounded-xl font-display text-2xl font-bold text-black outline-none focus:border-black text-center"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setDefaultLimit(prev => Math.min(20, Number(prev) + 1))
                          }
                          className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center hover:bg-black/85 active:scale-95 transition-all"
                          aria-label="Increase default drink limit"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Preset Chips */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-sans-clean text-black/45 lowercase mr-1">
                        presets:
                      </span>
                      {[3, 4, 5, 6, 8, 10].map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setDefaultLimit(preset)}
                          className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all ${
                            Number(defaultLimit) === preset
                              ? 'bg-black text-white'
                              : 'bg-white border border-black/10 text-black/65 hover:border-black/30'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Party Title & Supervisor PIN */}
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                        party display title
                      </label>
                      <input
                        type="text"
                        required
                        value={partyName}
                        onChange={e => setPartyName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-xs font-semibold text-black outline-none focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                        4-digit supervisor & staff pin
                      </label>
                      <div className="relative">
                        <input
                          type={showPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={4}
                          required
                          value={adminPin}
                          onChange={e => setAdminPin(e.target.value)}
                          className="w-full px-4 py-2.5 pr-10 bg-black/5 border border-black/15 rounded-xl font-mono tracking-widest text-sm font-bold text-black outline-none focus:border-black"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(prev => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/45 hover:text-black"
                          title={showPin ? 'Hide PIN' : 'Show PIN'}
                        >
                          {showPin ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-black/8">
                  <button
                    type="submit"
                    className="btn-premium-primary py-3 px-6 text-xs gap-2 w-full sm:w-auto"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>save & apply rules</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Card 2 (5 cols on lg): Hardware & Data Tools */}
            <div className="lg:col-span-5 glass-card p-6 sm:p-7 border border-black/10">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-black/8">
                <div className="w-10 h-10 rounded-2xl bg-black/5 text-black flex items-center justify-center border border-black/10 shrink-0">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold lowercase text-black leading-none">
                    hardware & data tools
                  </h2>
                  <p className="font-sans-clean text-xs text-black/50 lowercase mt-1">
                    encode nfc stickers, export csv, and sync cloud
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-3.5">
                {/* Tool 1: NFC Sticker Batch Writer */}
                <div className="p-4 rounded-2xl bg-black/[0.025] border border-black/8 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-sans-clean text-xs font-bold text-black lowercase">
                        nfc batch writer
                      </span>
                      <Radio className="w-4 h-4 text-black/50" />
                    </div>
                    <p className="font-sans-clean text-[11px] text-black/55 lowercase leading-relaxed">
                      encode sequential URLs (/t/1 to /t/100) onto physical nfc stickers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsWriterOpen(true)}
                    className="btn-premium w-full py-2.5 text-xs gap-2"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>open nfc writer</span>
                  </button>
                </div>

                {/* Tool 2: CSV Export */}
                <div className="p-4 rounded-2xl bg-black/[0.025] border border-black/8 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-sans-clean text-xs font-bold text-black lowercase">
                        party csv report
                      </span>
                      <Download className="w-4 h-4 text-black/50" />
                    </div>
                    <p className="font-sans-clean text-[11px] text-black/55 lowercase leading-relaxed">
                      download spreadsheet of all 100 wristbands, check-in times, and drink counts.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="btn-premium w-full py-2.5 text-xs gap-2"
                  >
                    {exportSuccess ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">csv downloaded!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>export csv</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Tool 3: Cloud Sync */}
                <div className="p-4 rounded-2xl bg-black/[0.025] border border-black/8 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-sans-clean text-xs font-bold text-black lowercase">
                        cloud synchronization
                      </span>
                      {isSupabaseConnected ? (
                        <Wifi className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <WifiOff className="w-4 h-4 text-black/40" />
                      )}
                    </div>
                    <p className="font-sans-clean text-[11px] text-black/55 lowercase leading-relaxed">
                      {isSupabaseConnected
                        ? 'connected to supabase realtime cloud. pull latest state across all devices.'
                        : 'running in offline local storage mode on this device.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="btn-premium w-full py-2.5 text-xs gap-2"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {syncSuccess
                        ? 'state synced!'
                        : isSyncing
                        ? 'syncing...'
                        : 'sync now'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Danger Zone (Separated at Bottom) */}
          <div className="p-6 sm:p-7 rounded-3xl border border-red-200 bg-red-50/35 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 border border-red-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-red-700 block">
                    danger zone // irreversible action
                  </span>
                  <h3 className="font-display text-2xl font-bold lowercase text-black leading-tight">
                    factory reset party & 100 wristbands
                  </h3>
                  <p className="font-sans-clean text-xs text-black/60 lowercase mt-1 max-w-xl">
                    erases all guest names, check-in statuses, and drink history logs, restoring TAG-001 through TAG-100 to clean unassigned slots. requires supervisor pin confirmation.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="btn-premium-danger py-3 px-5 text-xs gap-2 shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>reset 100 slots</span>
              </button>
            </div>

            {resetSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-sans-clean flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>all 100 wristbands and drink logs have been reset to a clean slate.</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* NFC Batch Writer Modal */}
      <NfcWriterModal
        isOpen={isWriterOpen}
        onClose={() => setIsWriterOpen(false)}
      />

      {/* Reset Confirmation Modal */}
      <AdminPinModal
        isOpen={isResetConfirmOpen}
        title="confirm complete party reset"
        subtitle="enter supervisor pin to erase all check-ins and reset 100 wristbands"
        onSuccess={handleResetExecute}
        onClose={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
}
