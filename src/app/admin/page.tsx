'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GuestTable } from '@/components/GuestTable';
import { DrinkHistoryList } from '@/components/DrinkHistoryList';
import { NfcWriterModal } from '@/components/NfcWriterModal';
import { AdminPinModal } from '@/components/AdminPinModal';
import { StationLockScreen } from '@/components/StationLockScreen';
import { GuestListImportModal } from '@/components/GuestListImportModal';
import { PartyScheduleModal } from '@/components/PartyScheduleModal';
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
  Beer,
  Wine,
  Sparkles,
  CupSoda,
  Trash2,
  Edit3,
  FileSpreadsheet,
  Clock,
} from 'lucide-react';
import { soundSystem } from '@/lib/audio';
import { AdminGuestFilter, computeAdminKpis } from '@/lib/admin-utils';
import { MenuItem } from '@/lib/types';
import {
  PartyProgramSchedule,
  loadPartySchedule,
  savePartySchedule,
} from '@/lib/party-schedule-utils';

export type AdminTab = 'guests' | 'activity' | 'settings';

const menuCategoryIcons: Record<'beer' | 'cocktail' | 'shot' | 'wine' | 'soft', React.ElementType> = {
  beer: Beer,
  cocktail: Sparkles,
  shot: GlassWater,
  wine: Wine,
  soft: CupSoda,
};

export default function AdminPage() {
  const {
    settings,
    guests,
    logs,
    menu,
    importedGuests,
    isSyncing,
    isSupabaseConnected,
    updateSettings,
    exportCsv,
    resetParty,
    refresh,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleMenuItemAvailability,
    resetMenuToDefault,
  } = usePartyStore();
  const { isAuthenticated, logout } = useStaffAuth();

  // Navigation & Filter State
  const [activeTab, setActiveTab] = useState<AdminTab>('guests');
  const [guestFilter, setGuestFilter] = useState<AdminGuestFilter>('active');

  // Settings Form State
  const [defaultLimit, setDefaultLimit] = useState(settings.default_drink_limit);
  const [partyName, setPartyName] = useState(settings.party_name);
  const [adminPin, setAdminPin] = useState(settings.admin_pin);
  const [enableHardwareUid, setEnableHardwareUid] = useState(Boolean(settings.enable_hardware_uid_reading));
  const [showPin, setShowPin] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Menu Creation & Management State
  const [isCreatingDrink, setIsCreatingDrink] = useState(false);
  const [editingDrinkId, setEditingDrinkId] = useState<string | null>(null);
  const [drinkForm, setDrinkForm] = useState<{
    name: string;
    category: 'beer' | 'cocktail' | 'shot' | 'wine' | 'soft';
    description: string;
    is_available: boolean;
  }>({
    name: '',
    category: 'cocktail',
    description: '',
    is_available: true,
  });
  const [menuFeedback, setMenuFeedback] = useState<string | null>(null);

  // Modals State
  const [isWriterOpen, setIsWriterOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [partySchedule, setPartySchedule] = useState<PartyProgramSchedule>(() => loadPartySchedule());

  useEffect(() => {
    setDefaultLimit(settings.default_drink_limit);
    setPartyName(settings.party_name);
    setAdminPin(settings.admin_pin);
    setEnableHardwareUid(Boolean(settings.enable_hardware_uid_reading));
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
      enable_hardware_uid_reading: enableHardwareUid,
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

  const handleStartAddDrink = () => {
    soundSystem.vibrate(15);
    setDrinkForm({
      name: '',
      category: 'cocktail',
      description: '',
      is_available: true,
    });
    setEditingDrinkId(null);
    setIsCreatingDrink(true);
  };

  const handleStartEditDrink = (item: MenuItem) => {
    soundSystem.vibrate(15);
    setDrinkForm({
      name: item.name,
      category: item.category,
      description: item.description || '',
      is_available: item.is_available,
    });
    setEditingDrinkId(item.id);
    setIsCreatingDrink(true);
  };

  const handleCancelDrinkForm = () => {
    setIsCreatingDrink(false);
    setEditingDrinkId(null);
  };

  const handleSaveDrink = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = drinkForm.name.trim();
    if (!cleanName) return;

    if (editingDrinkId) {
      updateMenuItem(editingDrinkId, {
        name: cleanName,
        type: cleanName.toLowerCase(),
        category: drinkForm.category,
        description: drinkForm.description.trim() || undefined,
        is_available: drinkForm.is_available,
      });
      setMenuFeedback(`updated "${cleanName}" on menu!`);
    } else {
      addMenuItem({
        name: cleanName,
        type: cleanName.toLowerCase(),
        category: drinkForm.category,
        description: drinkForm.description.trim() || undefined,
        is_available: drinkForm.is_available,
      });
      setMenuFeedback(`added "${cleanName}" to party menu!`);
    }

    soundSystem.playApprovedSound();
    setIsCreatingDrink(false);
    setEditingDrinkId(null);
    setTimeout(() => setMenuFeedback(null), 3000);
  };

  const handleDeleteDrink = (id: string, name: string) => {
    soundSystem.vibrate(20);
    deleteMenuItem(id);
    setMenuFeedback(`removed "${name}" from menu.`);
    setTimeout(() => setMenuFeedback(null), 3000);
  };

  const handleToggleDrink = (id: string) => {
    soundSystem.vibrate(10);
    toggleMenuItemAvailability(id);
  };

  const handleResetMenu = () => {
    soundSystem.vibrate(25);
    resetMenuToDefault();
    soundSystem.playApprovedSound();
    setMenuFeedback('restored all standard drinks to menu!');
    setTimeout(() => setMenuFeedback(null), 3000);
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
      {/* 1. Interactive 4-Stat Live KPI Strip */}
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

      {/* 3. Segmented Tab Bar & Quick Import Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        {/* Guest Roster / CSV Import Trigger Button */}
        <button
          type="button"
          onClick={() => {
            soundSystem.vibrate(15);
            setIsImportModalOpen(true);
          }}
          className="btn-premium py-2 px-3.5 text-xs gap-2 self-start sm:self-auto cursor-pointer"
          title="Import or manage expected guest list from CSV or text"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-black" />
          <span>guest list import</span>
          {importedGuests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-black/10 text-[10px] font-mono font-bold text-black/80">
              {importedGuests.filter(g => g.is_checked_in).length}/{importedGuests.length}
            </span>
          )}
        </button>
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
                  {/* Master Bar Service Status Toggle */}
                  <div className="md:col-span-2 xl:col-span-2 p-4 rounded-2xl bg-black/[0.025] border border-black/8 flex items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-sans-clean font-bold text-black lowercase">
                        bar service status
                      </label>
                      <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-0.5">
                        {settings.is_party_active
                          ? 'active — bartenders can pour and log drinks across terminals'
                          : 'paused — drink service is temporarily halted'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleTogglePartyActive}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold lowercase flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                        settings.is_party_active
                          ? 'bg-black text-white hover:bg-black/85'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {settings.is_party_active ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>pause bar</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>resume bar</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Hardware UID (NFC Serial) Reading Toggle */}
                  <div className="md:col-span-2 xl:col-span-2 p-4 rounded-2xl bg-black/[0.025] border border-black/8 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="block text-xs font-sans-clean font-bold text-black lowercase">
                          hardware uid (nfc serial) reading
                        </label>
                        <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          enableHardwareUid ? 'bg-amber-100 text-amber-800' : 'bg-black/6 text-black/60'
                        }`}>
                          {enableHardwareUid ? 'ENABLED' : 'DISABLED (NDEF ONLY)'}
                        </span>
                      </div>
                      <span className="text-[11px] font-sans-clean text-black/50 lowercase block mt-0.5">
                        {enableHardwareUid
                          ? 'Accept raw hardware chip serials (e.g. 53B88CFF...) as wristband identifiers'
                          : 'Disabled (recommended) — strictly uses pre-encoded TAG-XXX / URLs to prevent serial overrides'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setEnableHardwareUid(prev => !prev)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold lowercase flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                        enableHardwareUid
                          ? 'bg-amber-500 text-black font-bold hover:bg-amber-400'
                          : 'bg-black text-white hover:bg-black/85'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{enableHardwareUid ? 'turn off uid' : 'enable uid'}</span>
                    </button>
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

                {/* Tool 4: Guest Roster & CSV Import */}
                <div className="p-4 rounded-2xl bg-black/[0.025] border border-black/8 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-sans-clean text-xs font-bold text-black lowercase">
                        guest roster & csv import
                      </span>
                      <FileSpreadsheet className="w-4 h-4 text-black/50" />
                    </div>
                    <p className="font-sans-clean text-[11px] text-black/55 lowercase leading-relaxed">
                      import comma-separated names ([Janek Smagiel, Ania Beta, ]) or upload csv for door check-in autofill.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="btn-premium w-full py-2.5 text-xs gap-2"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>
                      manage guest list ({importedGuests.length > 0 ? `${importedGuests.length} imported` : 'empty'})
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Party Program & Projector Timeline Schedule */}
          <div className="glass-card p-6 sm:p-7 border border-black/10 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl font-bold lowercase text-black leading-none">
                      projector party timeline
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-black/5 border border-black/10 text-[10px] font-mono font-bold text-black/60">
                      {partySchedule.checkpoints.length} milestones
                    </span>
                  </div>
                  <p className="font-sans-clean text-xs text-black/50 lowercase mt-1">
                    configure the party hours and milestone checkpoints shown on the venue projector screen
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsTimelineModalOpen(true)}
                className="btn-premium-primary text-xs py-2.5 px-5 gap-2 shrink-0"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>edit timeline checkpoints</span>
              </button>
            </div>

            {/* Timeline Overview & Checkpoints Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-black/[0.025] border border-black/8">
                <span className="font-sans-clean text-[10px] font-bold text-black/45 uppercase tracking-wider block">
                  Doors Open
                </span>
                <span className="font-mono text-xl font-bold text-black mt-0.5 block">
                  {partySchedule.startTime}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/[0.025] border border-black/8">
                <span className="font-sans-clean text-[10px] font-bold text-black/45 uppercase tracking-wider block">
                  Party Concludes
                </span>
                <span className="font-mono text-xl font-bold text-black mt-0.5 block">
                  {partySchedule.endTime}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/[0.025] border border-black/8 sm:col-span-2">
                <span className="font-sans-clean text-[10px] font-bold text-black/45 uppercase tracking-wider block">
                  Program Schedule Title
                </span>
                <span className="font-sans-clean text-sm font-semibold text-black mt-0.5 block truncate">
                  {partySchedule.title || "Tonight's Party Timeline"}
                </span>
              </div>
            </div>

            {/* Milestone Checkpoints List */}
            <div className="space-y-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-black/50 block">
                Active Milestones ({partySchedule.checkpoints.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {partySchedule.checkpoints.map(cp => (
                  <div
                    key={cp.id}
                    className="p-3 rounded-xl bg-white border border-black/10 flex items-center justify-between gap-2.5 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-black/70 bg-black/5 px-2 py-0.5 rounded-lg shrink-0">
                        {cp.time}
                      </span>
                      <span className="font-sans-clean text-xs font-semibold text-black truncate">
                        {cp.title}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card: Party Drink Menu & Custom Catalog */}
          <div className="glass-card p-6 sm:p-7 border border-black/10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
                  <GlassWater className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-2xl font-bold lowercase text-black leading-none">
                      party drink menu
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-black/5 border border-black/10 text-[10px] font-mono font-bold text-black/60">
                      {menu.length} drinks
                    </span>
                  </div>
                  <p className="font-sans-clean text-xs text-black/50 lowercase mt-1">
                    create, customize and toggle drinks available at the bar station and guest menu
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetMenu}
                  className="btn-premium py-2 px-3.5 text-xs gap-1.5"
                  title="Reset menu to default standard drinks"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>reset to defaults</span>
                </button>

                <button
                  type="button"
                  onClick={isCreatingDrink ? handleCancelDrinkForm : handleStartAddDrink}
                  className="btn-premium-primary py-2 px-3.5 text-xs gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreatingDrink ? 'cancel' : 'create drink'}</span>
                </button>
              </div>
            </div>

            {menuFeedback && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-sans-clean flex items-center gap-2 border border-emerald-200 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{menuFeedback}</span>
              </div>
            )}

            {/* Create / Edit Drink Form */}
            {isCreatingDrink && (
              <form
                onSubmit={handleSaveDrink}
                className="p-5 sm:p-6 rounded-2xl bg-black/[0.03] border border-black/12 space-y-4 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between pb-3 border-b border-black/8">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-black">
                    {editingDrinkId ? 'edit drink item' : 'create new drink for menu'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelDrinkForm}
                    className="text-xs font-sans-clean text-black/45 hover:text-black lowercase cursor-pointer"
                  >
                    cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                      drink name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aperol Spritz, Gin & Tonic, Paloma"
                      value={drinkForm.name}
                      onChange={e => setDrinkForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white border border-black/15 rounded-xl font-sans-clean text-xs font-semibold text-black outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                      category *
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {(['cocktail', 'beer', 'shot', 'wine', 'soft'] as const).map(cat => {
                        const Icon = menuCategoryIcons[cat] || GlassWater;
                        const isSelected = drinkForm.category === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setDrinkForm(prev => ({ ...prev, category: cat }))}
                            className={`py-2 px-1 rounded-xl text-[11px] font-sans-clean font-semibold capitalize flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-black text-white border-black shadow-xs'
                                : 'bg-white text-black/70 border-black/10 hover:border-black/30'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span className="text-[10px] lowercase">{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                      ingredients & description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Prosecco, Aperol, club soda, orange slice"
                      value={drinkForm.description}
                      onChange={e => setDrinkForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white border border-black/15 rounded-xl font-sans-clean text-xs text-black outline-none focus:border-black"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={drinkForm.is_available}
                        onChange={e => setDrinkForm(prev => ({ ...prev, is_available: e.target.checked }))}
                        className="w-4 h-4 accent-black rounded cursor-pointer"
                      />
                      <span className="text-xs font-sans-clean font-medium text-black lowercase">
                        available at bar station (uncheck if out of stock)
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCancelDrinkForm}
                        className="btn-premium py-2 px-4 text-xs"
                      >
                        cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-premium-primary py-2 px-5 text-xs gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{editingDrinkId ? 'update drink' : 'add to menu'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* Menu Drinks Grid (Pre-populated with all drinks on the drink selection list) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {menu.map((item, idx) => {
                const Icon = menuCategoryIcons[item.category] || GlassWater;
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      item.is_available
                        ? 'bg-white border-black/12 shadow-xs hover:border-black/30'
                        : 'bg-black/[0.02] border-black/8 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-xl bg-black/[0.04] border border-black/10 flex items-center justify-center text-black">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-black/40">
                            #{idx + 1}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase tracking-wider ${
                              item.is_available
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                            }`}
                          >
                            {item.is_available ? 'active' : 'hidden'}
                          </span>
                        </div>
                      </div>

                      <h4 className="font-sans-clean text-sm font-bold text-black lowercase leading-tight">
                        {item.name}
                      </h4>
                      <span className="font-mono text-[10px] text-black/45 uppercase tracking-wider block mt-0.5">
                        {item.category}
                      </span>
                      {item.description && (
                        <p className="font-sans-clean text-[11px] text-black/60 lowercase mt-1.5 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-black/6">
                      <button
                        type="button"
                        onClick={() => handleToggleDrink(item.id)}
                        className={`text-[10px] font-sans-clean font-semibold lowercase px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          item.is_available
                            ? 'bg-black/5 hover:bg-black/10 text-black/75'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.is_available ? 'disable' : 'enable'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditDrink(item)}
                          className="p-1.5 rounded-lg hover:bg-black/5 text-black/50 hover:text-black transition-colors cursor-pointer"
                          title="Edit drink"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDrink(item.id, item.name)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-black/40 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete from menu"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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

      {/* Guest List CSV Importer & Roster Modal */}
      <GuestListImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      {/* Projector Party Schedule & Checkpoints Modal */}
      <PartyScheduleModal
        isOpen={isTimelineModalOpen}
        onClose={() => setIsTimelineModalOpen(false)}
        schedule={partySchedule}
        onSave={updated => {
          setPartySchedule(updated);
          savePartySchedule(updated);
          setIsTimelineModalOpen(false);
          soundSystem.playApprovedSound();
        }}
        simulatedTime={null}
        onSetSimulatedTime={() => {}}
      />
    </div>
  );
}
