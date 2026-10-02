'use client';

import React, { useState } from 'react';
import { X, HelpCircle, CheckCircle2, AlertOctagon, Smartphone, ShieldCheck, GlassWater } from 'lucide-react';

interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpGuideModal({ isOpen, onClose }: HelpGuideModalProps) {
  const [activeTab, setActiveTab] = useState<'stickers' | 'door' | 'bar' | 'parents'>('stickers');

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
          simple instructions for whoever is running the system
        </p>

        {/* Tab Pills */}
        <div className="segmented-control mb-6">
          {[
            { id: 'stickers', label: '1. setup' },
            { id: 'door', label: '2. door' },
            { id: 'bar', label: '3. bar' },
            { id: 'parents', label: '4. parents' },
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
                <span className="font-bold text-black block mb-1">Step 1: Open NFC Batch Writer</span>
                <p className="text-black/70 leading-relaxed">
                  Go to <strong>Admin</strong> (PIN: <strong>1031</strong>) and tap <strong>"NFC Batch Writer"</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">Step 2: Tap stickers against phone</span>
                <p className="text-black/70 leading-relaxed">
                  Hold sticker #1 to the back of the phone. When it chimes green, write <strong>#1</strong> on the back with a pen and stick it on bracelet #1. The screen automatically moves to #2.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
                <p className="text-[11px]">
                  💡 <strong>Lazy shortcut:</strong> If both phones use Chrome on Android, you can even leave the stickers blank! The phone reads the chip number automatically.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'door' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">1. Greet Guest & Grab Bracelet</span>
                <p className="text-black/70 leading-relaxed">
                  Go to the <strong>Door</strong> tab. Pick the next bracelet in line (e.g. Bracelet #1).
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">2. Tap & Type Name</span>
                <p className="text-black/70 leading-relaxed">
                  Tap the bracelet to the phone, type the guest's name (e.g. Kasia), choose <strong>Standard 18+</strong> or <strong>Driver/Minor (0 alcohol)</strong>, and tap <strong>"Admit Guest"</strong>.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'bar' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                <span className="font-bold flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  White / Green Screen: Serve Drink
                </span>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Shows guest name and how many drinks they have left (e.g. 2 of 5). Serve the drink!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900">
                <span className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                  Flashing Red: DO NOT SERVE
                </span>
                <p className="text-[11px] text-red-800 leading-relaxed">
                  Limit is reached! Loud alarm buzzer sounds. Do not serve alcohol. Offer free water or soda instead.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">Mistake? Tap "Undo"</span>
                <p className="text-black/70 leading-relaxed">
                  If you double-tapped by accident, an orange <strong>"Undo Accidental Tap"</strong> button appears for 10 seconds to cancel it.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'parents' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">Security PIN</span>
                <p className="text-black/70 leading-relaxed">
                  The default parent PIN is <strong>1031</strong> (Halloween: Oct 31st). You can change it anytime in the Admin tab.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/5 border border-black/10">
                <span className="font-bold text-black block mb-1">Change Limits on the Fly</span>
                <p className="text-black/70 leading-relaxed">
                  In Admin, you can lower or raise the drink limit for everyone with 1 click.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800">
                <span className="font-bold block mb-1">Emergency Pause Button</span>
                <p className="text-[11px] leading-relaxed">
                  If the party gets too loud or needs a break, tap <strong>"Pause Bar Service"</strong> to freeze all drink taps across every phone.
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
