'use client';

import React, { useState } from 'react';
import { NfcReader } from '@/components/NfcReader';
import { BarmanDisplay } from '@/components/BarmanDisplay';
import { QuickSearchModal } from '@/components/QuickSearchModal';
import { usePartyStore } from '@/lib/store';
import { DrinkType, ServeDrinkResult, Guest } from '@/lib/types';

export default function BarmanPage() {
  const { serveDrink } = usePartyStore();
  const [selectedDrinkType, setSelectedDrinkType] = useState<DrinkType>('cocktail');
  const [lastResult, setLastResult] = useState<ServeDrinkResult | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleTagScanned = async (tagId: string) => {
    setActiveTagId(tagId);
    const result = await serveDrink(tagId, selectedDrinkType);
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

      {/* NFC Tap Area & Simulator */}
      <section>
        <NfcReader
          onTagScanned={handleTagScanned}
          activeTagId={activeTagId}
          modeLabel="tap guest wristband"
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
