'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Ban, CheckCircle, Shield, AlertTriangle } from 'lucide-react';
import { Guest, GuestCategory } from '@/lib/types';
import { usePartyStore } from '@/lib/store';
import { soundSystem } from '@/lib/audio';

interface GuestEditModalProps {
  guest: Guest | null;
  isOpen: boolean;
  onClose: () => void;
}

export function GuestEditModal({ guest, isOpen, onClose }: GuestEditModalProps) {
  const { updateGuest, settings } = usePartyStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<GuestCategory>('standard');
  const [customLimit, setCustomLimit] = useState<string>('');
  const [drinksConsumed, setDrinksConsumed] = useState<number>(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (guest) {
      setName(guest.name || '');
      setCategory(guest.category);
      setCustomLimit(guest.custom_drink_limit !== null ? String(guest.custom_drink_limit) : '');
      setDrinksConsumed(guest.drinks_consumed);
      setIsBlocked(guest.is_blocked);
      setNotes(guest.notes || '');
    }
  }, [guest]);

  if (!isOpen || !guest) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasName = Boolean(name.trim());
    await updateGuest({
      id: guest.id,
      name: name.trim() || null,
      category,
      custom_drink_limit: customLimit !== '' ? parseInt(customLimit, 10) : null,
      drinks_consumed: drinksConsumed,
      is_blocked: isBlocked,
      is_entered: hasName ? true : guest.is_entered,
      entered_at: hasName && !guest.entered_at ? new Date().toISOString() : guest.entered_at,
      notes: notes.trim() || null,
    });
    soundSystem.playApprovedSound();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bottom-sheet max-w-lg w-full p-6 sm:p-8 relative bg-white border-t sm:border border-black/15 shadow-2xl rounded-t-[32px] sm:rounded-3xl max-h-[90dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:pb-8">
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-4 sm:hidden shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <span className="font-mono text-xs text-black/50 tracking-wider uppercase block">
            {guest.id} // {guest.tag_id}
          </span>
          <h3 className="font-display text-3xl font-bold lowercase text-black">
            edit guest profile
          </h3>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
              guest name
            </label>
            <input
              type="text"
              placeholder="e.g. Kasia Kowalska"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-sm text-black outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                guest category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as GuestCategory)}
                className="w-full px-3 py-2.5 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-xs text-black outline-none focus:border-black"
              >
                <option value="standard">standard (18+)</option>
                <option value="driver_minor">driver / minor (0 alcohol)</option>
                <option value="vip">vip / host (unlimited)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                custom drink limit
              </label>
              <input
                type="number"
                min="0"
                max="50"
                placeholder={`default (${settings.default_drink_limit})`}
                value={customLimit}
                onChange={e => setCustomLimit(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-sm text-black outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                drinks consumed
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={drinksConsumed}
                onChange={e => setDrinksConsumed(parseInt(e.target.value || '0', 10))}
                className="w-full px-4 py-2.5 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-sm text-black outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                wristband status
              </label>
              <button
                type="button"
                onClick={() => setIsBlocked(prev => !prev)}
                className={`w-full py-2.5 px-3 rounded-xl font-sans-clean text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 border ${
                  isBlocked
                    ? 'bg-red-50 text-red-700 border-red-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}
              >
                {isBlocked ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                <span>{isBlocked ? 'DISABLED / BLOCKED' : 'ACTIVE'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
              notes (allergies, driver info, etc.)
            </label>
            <input
              type="text"
              placeholder="e.g. Birthday girl sister, designated driver..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-xs text-black outline-none focus:border-black"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/10">
            <button
              type="button"
              onClick={onClose}
              className="btn-premium py-2.5 px-5 text-xs"
            >
              cancel
            </button>
            <button
              type="submit"
              className="btn-premium-primary py-2.5 px-6 gap-2 text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>save changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
