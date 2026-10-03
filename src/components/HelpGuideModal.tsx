'use client';

import React, { useState } from 'react';
import { X, HelpCircle, CheckCircle2, AlertOctagon, Smartphone, ShieldCheck, GlassWater, Radio, UserCheck } from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpGuideModal({ isOpen, onClose }: HelpGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'stickers' | 'door' | 'bar' | 'security'>('stickers');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bottom-sheet max-w-lg w-full p-6 sm:p-8 relative bg-white border-t sm:border border-black/15 shadow-2xl rounded-t-[32px] sm:rounded-3xl max-h-[88dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:pb-8">
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-4 sm:hidden shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="w-5 h-5 text-black" />
          <h3 className="font-display text-2xl font-bold lowercase text-black">
            party helper guide
          </h3>
        </div>
        <p className="font-sans-clean text-xs text-black/50 lowercase mb-5">
          simple instructions for organizers and bar staff
        </p>

        {/* Tab Pills */}
        <div className="segmented-control mb-6">
          {[
            { id: 'stickers', label: '1. stickers' },
            { id: 'door', label: '2. door' },
            { id: 'bar', label: '3. bar' },
            { id: 'security', label: '4. security' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`segmented-item ${activeTab === tab.id ? 'segmented-item-active' : 'text-black/50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4 text-xs font-sans-clean">
          {activeTab === 'stickers' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">No Pre-Writing Required!</span>
                <p className="text-black/70 leading-relaxed">
                  Stickers can start completely blank straight out of the box. You do NOT have to program 100 stickers one-by-one beforehand.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">1-Tap Door Programming</span>
                <p className="text-black/70 leading-relaxed">
                  When a guest arrives at the door, type their name and tap <strong>"Tap & Program Sticker"</strong>. The door phone writes the wristband URL and saves the guest in the database in a single 0.5-second tap!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
                <p className="text-[11px]">
                  💡 <strong>Optional Batch Writer:</strong> If you prefer to label all wristbands before the party, open <strong>Admin &gt; NFC Batch Writer</strong> to tap-and-advance all stickers in 2 minutes.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'door' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">1. Greet Guest & Enter Name</span>
                <p className="text-black/70 leading-relaxed">
                  On the <strong>Door</strong> page, the next free tag number is suggested automatically. Type the guest&apos;s name (e.g. Kasia).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">2. Choose Category</span>
                <p className="text-black/70 leading-relaxed">
                  Select <strong>Standard 18+</strong>, <strong>Driver / Minor (0 Alcohol)</strong>, or <strong>VIP</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">3. Tap Sticker to Phone</span>
                <p className="text-black/70 leading-relaxed">
                  Touch the wristband sticker to the phone. The phone chimes green, the guest is admitted, and the tag increments automatically for the next person!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'bar' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">Station Auto-Scanning &amp; Screen Awake</span>
                <p className="text-black/70 leading-relaxed">
                  Keep the <strong>Barman</strong> station open on the bartender&apos;s phone. Screen Wake Lock keeps the phone on without going to sleep. NFC scans silently in the background without opening new browser tabs!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                <span className="font-bold flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Green / Approved Screen
                </span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Shows guest name, drinks consumed, and remaining drinks. Serve the drink!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900">
                <span className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                  Red Alert: Limit Reached
                </span>
                <p className="text-[11px] text-red-800 leading-relaxed">
                  Safety cutoff triggered! Buzzer plays. Do not serve alcohol. Offer complimentary soft drinks or water.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">Accidental Tap? 1-Click Undo</span>
                <p className="text-black/70 leading-relaxed">
                  If the bartender accidentally taps twice, tap <strong>&quot;Undo Accidental Tap&quot;</strong> (-1) to safely cancel the drink.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">Guest Phone Self-Tap Protection</span>
                <p className="text-black/70 leading-relaxed">
                  When guests tap their own wristband with their phone, they only see a read-only stats pass (drinks left, check-in time). They CANNOT serve drinks or reset their counter!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">Staff Terminal Mode</span>
                <p className="text-black/70 leading-relaxed">
                  Organizers and bartenders enter the supervisor PIN once on their device. Authorized staff phones gain instant access to logging controls and undo tools.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800">
                <span className="font-bold block mb-1">Emergency Pause Button</span>
                <p className="text-[11px] leading-relaxed">
                  Tap <strong>&quot;Pause Bar Service&quot;</strong> on the home dashboard to immediately freeze all drink logging across all devices.
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-premium-primary w-full py-3.5 text-xs mt-6"
        >
          got it, close guide
        </button>
      </div>
    </div>
  );
}
