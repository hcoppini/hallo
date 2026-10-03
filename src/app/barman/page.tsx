'use client';

import React, { useState, useEffect } from 'react';
import { NfcReader } from '@/components/NfcReader';
import { BarmanDisplay } from '@/components/BarmanDisplay';
import { QuickSearchModal } from '@/components/QuickSearchModal';
import { usePartyStore } from '@/lib/store';
import { DrinkType, ServeDrinkResult, Guest } from '@/lib/types';
import { nfcController } from '@/lib/nfc';
import { authenticateStaff } from '@/lib/auth';

export default function BarmanPage() {
  const { serveDrink, settings } = usePartyStore();
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>('cocktail');
  const [lastResult, setLastResult] = useState<ServeDrinkResult | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Auto-acquire wake lock on barman desk so screen stays awake
  useEffect(() => {
    nfcController.requestWakeLock();
    // Unlock staff session on barman desk
    if (settings.admin_pin) {
      authenticateStaff(settings.admin_pin, settings.admin_pin);
    }
    return () => {
      nfcController.releaseWakeLock();
    };
  }, [settings.admin_pin]);

  // Handle incoming redirect from /t/[id]?tag=...
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tagParam = params.get('tag') || params.get('served');
      if (tagParam) {
        handleManualServe(decodeURIComponent(tagParam).toUpperCase(), 'cocktail');
      }
    }
  }, []);

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
          onDrinkTypeChange={setSelectedDrinkType}
          onManualServe={handleManualServe}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      </div>

      {/* Continuous NFC Tap Area (auto-starts with Screen Wake Lock) */}
      <section>
        <NfcReader
          onTagScanned={handleTagScanned}
          activeTagId={activeTagId}
          modeLabel="tap guest wristband"
          autoStart={true}
        />
      </section>

      {/* Manual Search Modal (Bottom Sheet on phone) */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectGuest={handleSelectFromSearch}
      />
    </div>
  );
}
