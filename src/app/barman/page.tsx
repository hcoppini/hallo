'use client';

import React, { useState } from 'react';
import { LuawsHeader } from '@/components/LuawsHeader';
import { NfcReader } from '@/components/NfcReader';
import { BarmanDisplay } from '@/components/BarmanDisplay';
import { QuickSearchModal } from '@/components/QuickSearchModal';
import { usePartyStore } from '@/lib/store';
import { DrinkType, ServeDrinkResult, Guest } from '@/lib/types';

export default function BarmanPage() {
  const { serveDrink, guests } = usePartyStore();
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
    <div className="min-h-screen flex flex-col bg-white">
      <LuawsHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-black/50 block">
              bar station // single-tap regulation
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold lowercase text-black">
              barman interface
            </h1>
          </div>
        </div>

        {/* High-Contrast Drink Counter / Limit Alert Screen */}
        <div className="mb-10">
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
            modeLabel="tap guest wristband here"
          />
        </section>
      </main>

      {/* Manual Search Modal */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectGuest={handleSelectFromSearch}
      />
    </div>
  );
}
