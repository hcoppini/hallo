'use client';

import React, { useState, useEffect } from 'react';
import { NfcReader } from '@/components/NfcReader';
import { BarmanDisplay } from '@/components/BarmanDisplay';
import { SpeedKeypad } from '@/components/SpeedKeypad';
import { QuickSearchModal } from '@/components/QuickSearchModal';
import { usePartyStore } from '@/lib/store';
import { DrinkType, ServeDrinkResult, Guest } from '@/lib/types';
import { nfcController } from '@/lib/nfc';
import { setStaffAuthenticated, setStaffActiveDrinkType, getStaffActiveDrinkType } from '@/lib/auth';
import { Zap, Radio, Search } from 'lucide-react';

export default function BarmanPage() {
  const { serveDrink, settings } = usePartyStore();
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>(() => {
    return (getStaffActiveDrinkType() as DrinkType) || 'cocktail';
  });
  const [lastResult, setLastResult] = useState<ServeDrinkResult | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'keypad' | 'nfc'>('keypad');

  // Auto-acquire wake lock on barman desk so screen stays awake & ensure staff auth is locked in
  useEffect(() => {
    nfcController.requestWakeLock();
    setStaffAuthenticated(true);
    return () => {
      nfcController.releaseWakeLock();
    };
  }, []);

  // Sync drink type changes with staff session storage
  const handleDrinkTypeChange = (type: DrinkType) => {
    setSelectedDrinkType(type);
    setStaffActiveDrinkType(type);
  };

  // Handle incoming redirect from /t/[id]?tag=...
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tagParam = params.get('tag') || params.get('served');
      if (tagParam) {
        handleManualServe(decodeURIComponent(tagParam).toUpperCase(), selectedDrinkType);
      }
    }
  }, [selectedDrinkType]);

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

  return (
    <div className="w-full py-4 space-y-6">
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
