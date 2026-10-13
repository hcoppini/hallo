'use client';

import React, { useState, useEffect } from 'react';
import { NfcReader } from '@/components/NfcReader';
import { BarmanDisplay } from '@/components/BarmanDisplay';
import { SpeedKeypad } from '@/components/SpeedKeypad';
import { QuickSearchModal } from '@/components/QuickSearchModal';
import { AdminPinModal } from '@/components/AdminPinModal';
import { usePartyStore } from '@/lib/store';
import { DrinkType, ServeDrinkResult, Guest } from '@/lib/types';
import { nfcController } from '@/lib/nfc';
import { useStaffAuth, setStaffActiveDrinkType, getStaffActiveDrinkType } from '@/lib/auth';
import { Zap, Radio, Search, Lock, LogOut, ShieldCheck } from 'lucide-react';

export default function BarmanPage() {
  const { serveDrink, settings } = usePartyStore();
  const { isAuthenticated, logout } = useStaffAuth();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>(() => {
    return (getStaffActiveDrinkType() as DrinkType) || 'cocktail';
  });
  const [lastResult, setLastResult] = useState<ServeDrinkResult | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'keypad' | 'nfc'>('keypad');

  // Auto-acquire wake lock on barman desk so screen stays awake
  useEffect(() => {
    if (isAuthenticated) {
      nfcController.requestWakeLock();
    }
    return () => {
      nfcController.releaseWakeLock();
    };
  }, [isAuthenticated]);

  // Sync drink type changes with staff session storage
  const handleDrinkTypeChange = (type: DrinkType) => {
    setSelectedDrinkType(type);
    setStaffActiveDrinkType(type);
  };

  // Handle incoming redirect from /t/[id]?tag=...
  useEffect(() => {
    if (typeof window !== 'undefined' && isAuthenticated) {
      const params = new URLSearchParams(window.location.search);
      const tagParam = params.get('tag') || params.get('served');
      if (tagParam) {
        handleManualServe(decodeURIComponent(tagParam).toUpperCase(), selectedDrinkType);
      }
    }
  }, [selectedDrinkType, isAuthenticated]);

  const handleTagScanned = async (tagId: string, hardwareUid?: string) => {
    const targetTag = tagId || hardwareUid || '';
    setActiveTagId(targetTag);
    const result = await serveDrink(targetTag, selectedDrinkType);
    setLastResult(result);
  };

  const handleManualServe = async (tagId: string, drinkType: DrinkType) => {
    setActiveTagId(tagId);
    const result = await serveDrink(tagId, drinkType);
    setLastResult(result);
  };

  const handleSelectFromSearch = async (guest: Guest) => {
    await handleManualServe(guest.tag_id, selectedDrinkType);
  };

  // If not authenticated, require the 4-digit staff PIN
  if (!isAuthenticated) {
    return (
      <div className="w-full py-12 px-4 max-w-sm mx-auto text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-black/5 flex items-center justify-center mx-auto text-black border border-black/10">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <span className="font-mono text-[10px] text-black/40 uppercase tracking-widest block mb-1">
            STAFF SECURITY LOCK
          </span>
          <h2 className="font-display text-3xl font-bold lowercase text-black">
            barman station
          </h2>
          <p className="font-sans-clean text-xs text-black/60 mt-1 max-w-xs mx-auto">
            This terminal is locked. Enter the 4-digit staff PIN to enable drink logging.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsPinModalOpen(true)}
          className="btn-premium-primary w-full py-4 text-xs gap-2"
        >
          <Lock className="w-4 h-4" />
          <span>Enter Staff PIN</span>
        </button>

        <AdminPinModal
          isOpen={isPinModalOpen}
          title="staff authorization"
          subtitle="enter 4-digit staff pin to unlock bar desk"
          onSuccess={() => setIsPinModalOpen(false)}
          onClose={() => setIsPinModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="w-full py-4 space-y-6">
      {/* Staff Status Header & Lock Button */}
      <div className="p-3 rounded-2xl bg-black text-white text-xs font-sans-clean flex items-center justify-between shadow-lg max-w-md mx-auto">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-[10px] tracking-wide uppercase">Barman Terminal Active</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3 h-3" />
          <span>Lock Station</span>
        </button>
      </div>

      {/* High-Contrast Drink Counter / Limit Alert Screen */}
      <div>
        <BarmanDisplay
          lastResult={lastResult}
          selectedDrinkType={selectedDrinkType}
          onDrinkTypeChange={handleDrinkTypeChange}
          onManualServe={handleManualServe}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      </div>

      {/* Input Mode Selector: Tactile Keypad vs NFC Tap Simulator */}
      <div className="flex items-center justify-center gap-2 p-1.5 bg-black/5 rounded-2xl max-w-sm mx-auto border border-black/10">
        <button
          type="button"
          onClick={() => setInputMode('keypad')}
          className={`flex-1 py-2.5 rounded-xl font-sans-clean text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            inputMode === 'keypad'
              ? 'bg-black text-white shadow-md'
              : 'text-black/60 hover:text-black hover:bg-black/5'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>⚡ Speed Keypad</span>
        </button>

        <button
          type="button"
          onClick={() => setInputMode('nfc')}
          className={`flex-1 py-2.5 rounded-xl font-sans-clean text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            inputMode === 'nfc'
              ? 'bg-black text-white shadow-md'
              : 'text-black/60 hover:text-black hover:bg-black/5'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>📻 NFC Scanner</span>
        </button>
      </div>

      {/* Mode 1: Fast Numeric Keypad (Insurance Policy: 0.5s per drink) */}
      {inputMode === 'keypad' && (
        <section className="animate-in fade-in duration-150">
          <SpeedKeypad
            onServe={handleManualServe}
            selectedDrinkType={selectedDrinkType}
          />
        </section>
      )}

      {/* Mode 2: Continuous NFC Tap Area (auto-starts with Screen Wake Lock) */}
      {inputMode === 'nfc' && (
        <section className="animate-in fade-in duration-150">
          <NfcReader
            onTagScanned={handleTagScanned}
            activeTagId={activeTagId}
            modeLabel="tap guest wristband"
            autoStart={true}
          />
        </section>
      )}

      {/* Manual Search Modal (Bottom Sheet on phone) */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectGuest={handleSelectFromSearch}
      />
    </div>
  );
}
