'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  Ban,
  CheckCircle,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Beer,
  GlassWater,
  Wine,
  CupSoda,
  UserCheck,
  UserX,
  Cpu,
  Trash2,
} from 'lucide-react';
import { Guest, GuestCategory, formatDrinkHistoryLabel } from '@/lib/types';
import { usePartyStore } from '@/lib/store';
import { soundSystem } from '@/lib/audio';
import {
  DrinkCategory,
  extractCleanNotes,
  extractEmbeddedUid,
  getDrinkCategory,
  mergeNotesWithUid,
} from '@/lib/admin-utils';

interface GuestEditModalProps {
  guest: Guest | null;
  isOpen: boolean;
  onClose: () => void;
}

const drinkCategoryIcons: Record<DrinkCategory, React.ElementType> = {
  cocktail: Sparkles,
  beer: Beer,
  shot: GlassWater,
  wine: Wine,
  soft: CupSoda,
};

export function GuestEditModal({ guest, isOpen, onClose }: GuestEditModalProps) {
  const { updateGuest, settings, logs, revertLastDrink } = usePartyStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<GuestCategory>('standard');
  const [customLimit, setCustomLimit] = useState<string>('');
  const [drinksConsumed, setDrinksConsumed] = useState<number>(0);
  const [isEntered, setIsEntered] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [notes, setNotes] = useState('');
  const [confirmClearSlot, setConfirmClearSlot] = useState(false);

  useEffect(() => {
    if (guest) {
      setName(guest.name || '');
      setCategory(guest.category);
      setCustomLimit(guest.custom_drink_limit !== null ? String(guest.custom_drink_limit) : '');
      setDrinksConsumed(guest.drinks_consumed);
      setIsEntered(guest.is_entered);
      setIsBlocked(guest.is_blocked);
      setNotes(extractCleanNotes(guest.notes));
      setConfirmClearSlot(false);
    }
  }, [guest]);

  const guestLogs = useMemo(() => {
    if (!guest) return [];
    return logs.filter(l => l.guest_id === guest.id);
  }, [logs, guest]);

  const hasActiveDrinkLog = useMemo(() => {
    return guestLogs.some(l => !l.is_reverted);
  }, [guestLogs]);

  if (!isOpen || !guest) return null;

  const embeddedUid = extractEmbeddedUid(guest.notes, guest.hardware_uid);

  const effectivePreviewLimit =
    category === 'vip'
      ? 999
      : category === 'driver_minor'
      ? 0
      : customLimit !== ''
      ? Math.max(0, parseInt(customLimit, 10) || 0)
      : settings.default_drink_limit;

  const isAtLimit = category !== 'vip' && drinksConsumed >= effectivePreviewLimit;
  const isNearLimit =
    category !== 'vip' &&
    effectivePreviewLimit > 1 &&
    drinksConsumed === effectivePreviewLimit - 1;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const hasName = Boolean(trimmedName);
    const shouldBeEntered = isEntered || (hasName && !guest.name);

    await updateGuest({
      id: guest.id,
      name: trimmedName || null,
      category,
      custom_drink_limit:
        customLimit !== '' && !Number.isNaN(parseInt(customLimit, 10))
          ? Math.max(0, parseInt(customLimit, 10))
          : null,
      drinks_consumed: Math.max(0, drinksConsumed),
      is_blocked: isBlocked,
      is_entered: shouldBeEntered,
      entered_at: shouldBeEntered
        ? guest.entered_at || new Date().toISOString()
        : null,
      notes: mergeNotesWithUid(notes, guest.notes),
    });
    soundSystem.playApprovedSound();
    onClose();
  };

  const handleClearSlot = async () => {
    await updateGuest({
      id: guest.id,
      name: null,
      category: 'standard',
      custom_drink_limit: null,
      drinks_consumed: 0,
      is_blocked: false,
      is_entered: false,
      entered_at: null,
      notes: null,
    });
    soundSystem.playUndoSound();
    onClose();
  };

  const handleUndoDrink = async (logId?: string) => {
    const ok = await revertLastDrink(guest.id, logId);
    if (ok) {
      setDrinksConsumed(prev => Math.max(0, prev - 1));
    }
  };

  const adjustDrinks = (delta: number) => {
    soundSystem.vibrate(15);
    setDrinksConsumed(prev => Math.max(0, Math.min(50, prev + delta)));
  };

  const adjustCustomLimit = (delta: number) => {
    soundSystem.vibrate(15);
    const current =
      customLimit !== ''
        ? parseInt(customLimit, 10)
        : settings.default_drink_limit;
    const next = Math.max(
      0,
      Math.min(50, (Number.isNaN(current) ? settings.default_drink_limit : current) + delta)
    );
    setCustomLimit(String(next));
  };

  const isAssignedSlot = Boolean(
    guest.name || guest.is_entered || guest.drinks_consumed > 0 || guest.is_blocked
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bottom-sheet max-w-xl w-full p-5 sm:p-7 relative bg-white border-t sm:border border-black/15 shadow-2xl rounded-t-[32px] sm:rounded-3xl max-h-[92dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:pb-7"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-3 sm:hidden shrink-0" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-5 pr-8">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-lg bg-black text-white font-mono text-xs font-bold tracking-wider">
              {guest.tag_id}
            </span>
            <span className="font-mono text-[11px] text-black/40 uppercase">
              {guest.id}
            </span>
            {guest.entered_at && (
              <span className="text-[11px] font-sans-clean text-black/50 lowercase">
                • entered{' '}
                {new Date(guest.entered_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
            {embeddedUid && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/5 text-black/60 font-mono text-[10px]">
                <Cpu className="w-3 h-3" />
                UID: {embeddedUid}
              </span>
            )}
          </div>
          <h3 className="font-display text-3xl font-bold lowercase text-black leading-tight">
            {isAssignedSlot ? 'guest profile & controls' : 'assign wristband slot'}
          </h3>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* 1. Guest Name & Status Row */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                guest full name or nickname
              </label>
              <input
                type="text"
                placeholder="e.g. Kasia Kowalska"
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (e.target.value.trim() && !isEntered) {
                    setIsEntered(true);
                  }
                }}
                className="w-full px-4 py-3 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-sm font-semibold text-black outline-none focus:border-black transition-colors"
              />
            </div>

            {/* Quick Status Toggles: Check-in Status & Wristband Block */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsEntered(prev => !prev)}
                className={`py-2.5 px-3 rounded-xl font-sans-clean text-xs font-bold tracking-wider lowercase transition-all flex items-center justify-center gap-1.5 border ${
                  isEntered
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-black/[0.03] text-black/60 border-black/10 hover:border-black/20'
                }`}
              >
                {isEntered ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                <span>{isEntered ? 'checked in (inside)' : 'outside / not entered'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBlocked(prev => !prev)}
                className={`py-2.5 px-3 rounded-xl font-sans-clean text-xs font-bold tracking-wider lowercase transition-all flex items-center justify-center gap-1.5 border ${
                  isBlocked
                    ? 'bg-red-50 text-red-700 border-red-300'
                    : 'bg-black/[0.03] text-black/70 border-black/10 hover:border-black/20'
                }`}
              >
                {isBlocked ? (
                  <Ban className="w-3.5 h-3.5 text-red-600" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>{isBlocked ? 'wristband blocked' : 'wristband active'}</span>
              </button>
            </div>
          </div>

          {/* 2. Tactile Drink Counter & Limit Stepper Card */}
          <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-sans-clean font-semibold uppercase tracking-wider text-black/50 block">
                  drinks consumed vs limit
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`font-display text-3xl font-bold ${
                      isBlocked || isAtLimit
                        ? 'text-red-600'
                        : isNearLimit
                        ? 'text-amber-600'
                        : 'text-black'
                    }`}
                  >
                    {drinksConsumed}
                  </span>
                  <span className="font-display text-xl text-black/40">
                    / {category === 'vip' ? '∞' : effectivePreviewLimit}
                  </span>
                  <span className="text-[11px] font-sans-clean text-black/50 lowercase ml-1">
                    {isBlocked
                      ? 'blocked'
                      : category === 'vip'
                      ? 'unlimited vip'
                      : category === 'driver_minor'
                      ? '0 alcohol allowed'
                      : isAtLimit
                      ? 'at safety limit'
                      : `${Math.max(0, effectivePreviewLimit - drinksConsumed)} remaining`}
                  </span>
                </div>
              </div>

              {/* +/- 1 Drink Steppers */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustDrinks(-1)}
                  disabled={drinksConsumed <= 0}
                  className="w-10 h-10 rounded-xl bg-white border border-black/15 flex items-center justify-center text-black hover:bg-black/5 active:scale-95 disabled:opacity-30 transition-all shadow-2xs"
                  title="Decrease drinks consumed by 1"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustDrinks(1)}
                  className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center hover:bg-black/85 active:scale-95 transition-all shadow-2xs"
                  title="Increase drinks consumed by 1"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            {category !== 'vip' && (
              <div className="w-full bg-black/10 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    isBlocked || isAtLimit
                      ? 'bg-red-600'
                      : isNearLimit
                      ? 'bg-amber-500'
                      : 'bg-black'
                  }`}
                  style={{
                    width: `${
                      effectivePreviewLimit === 0
                        ? 100
                        : Math.min(100, (drinksConsumed / effectivePreviewLimit) * 100)
                    }%`,
                  }}
                />
              </div>
            )}
          </div>

          {/* 3. Guest Category Selector */}
          <div>
            <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
              guest category & alcohol rules
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    id: 'standard',
                    label: 'standard 18+',
                    sub: `${customLimit !== '' ? customLimit : settings.default_drink_limit} drinks`,
                  },
                  {
                    id: 'driver_minor',
                    label: 'driver / minor',
                    sub: '0 alcohol',
                  },
                  {
                    id: 'vip',
                    label: 'vip / host',
                    sub: 'unlimited',
                  },
                ] as const
              ).map(tier => {
                const isSelected = category === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setCategory(tier.id)}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'bg-black text-white border-black shadow-xs'
                        : 'bg-black/[0.02] hover:bg-black/5 text-black border-black/10'
                    }`}
                  >
                    <span className="font-sans-clean text-xs font-bold block lowercase">
                      {tier.label}
                    </span>
                    <span
                      className={`text-[10px] lowercase block mt-0.5 ${
                        isSelected ? 'text-white/70' : 'text-black/50'
                      }`}
                    >
                      {tier.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Custom Limit & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-sans-clean font-semibold text-black/70 lowercase">
                  custom drink limit
                </label>
                {customLimit !== '' && category === 'standard' && (
                  <button
                    type="button"
                    onClick={() => setCustomLimit('')}
                    className="text-[10px] font-sans-clean text-black/50 hover:text-black underline"
                  >
                    use default ({settings.default_drink_limit})
                  </button>
                )}
              </div>

              {category === 'standard' ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustCustomLimit(-1)}
                    className="w-10 h-10 shrink-0 rounded-xl bg-black/5 hover:bg-black/10 border border-black/10 flex items-center justify-center text-black"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    placeholder={`default (${settings.default_drink_limit})`}
                    value={customLimit}
                    onChange={e => setCustomLimit(e.target.value)}
                    className="w-full px-3 py-2.5 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-xs text-center font-semibold text-black outline-none focus:border-black"
                  />
                  <button
                    type="button"
                    onClick={() => adjustCustomLimit(1)}
                    className="w-10 h-10 shrink-0 rounded-xl bg-black/5 hover:bg-black/10 border border-black/10 flex items-center justify-center text-black"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="px-3.5 py-2.5 bg-black/[0.03] border border-black/10 rounded-xl font-sans-clean text-xs text-black/40 lowercase">
                  {category === 'vip' ? 'vip has unlimited drinks' : 'driver/minor locked to 0 alcohol'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-sans-clean font-semibold text-black/70 lowercase mb-1.5">
                supervisor notes
              </label>
              <input
                type="text"
                placeholder="e.g. Designated driver, allergy..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/5 border border-black/15 rounded-xl font-sans-clean text-xs text-black outline-none focus:border-black"
              />
            </div>
          </div>

          {/* 5. Individual Guest Drink History */}
          {guestLogs.length > 0 && (
            <div className="pt-2 border-t border-black/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-sans-clean font-semibold text-black/70 lowercase">
                  guest drink history ({guestLogs.filter(l => !l.is_reverted).length} active)
                </span>
                {hasActiveDrinkLog && (
                  <button
                    type="button"
                    onClick={() => handleUndoDrink()}
                    className="inline-flex items-center gap-1 text-[11px] font-sans-clean font-semibold text-black/60 hover:text-black px-2 py-1 rounded-lg bg-black/5 hover:bg-black/10 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>undo last drink</span>
                  </button>
                )}
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {guestLogs.slice(0, 15).map(log => {
                  const drinkCat = getDrinkCategory(log.drink_type);
                  const Icon = drinkCategoryIcons[drinkCat] || GlassWater;
                  const time = new Date(log.served_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });
                  return (
                    <div
                      key={log.id}
                      className={`px-3 py-2 rounded-xl flex items-center justify-between text-xs font-sans-clean border ${
                        log.is_reverted
                          ? 'bg-black/[0.01] border-black/5 opacity-40 line-through'
                          : 'bg-black/[0.02] border-black/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="w-3.5 h-3.5 text-black/60 shrink-0" />
                        <span className="font-semibold text-black truncate">
                          {formatDrinkHistoryLabel(log.drink_type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[10px] text-black/50">
                          {log.is_reverted ? 'undone • ' : ''}
                          {time}
                        </span>
                        {!log.is_reverted && (
                          <button
                            type="button"
                            onClick={() => handleUndoDrink(log.id)}
                            className="p-1 rounded-md hover:bg-black/10 text-black/45 hover:text-black transition-colors"
                            title="Undo this drink"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Footer Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-black/10">
            <div>
              {isAssignedSlot && !confirmClearSlot && (
                <button
                  type="button"
                  onClick={() => setConfirmClearSlot(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-sans-clean font-semibold text-red-600/70 hover:text-red-600 py-1.5 px-2 rounded-lg hover:bg-red-50 transition-colors lowercase"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>unassign slot</span>
                </button>
              )}
              {confirmClearSlot && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearSlot}
                    className="text-[11px] font-sans-clean font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors lowercase"
                  >
                    confirm clear slot
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearSlot(false)}
                    className="text-[11px] font-sans-clean text-black/50 hover:text-black lowercase"
                  >
                    cancel
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="btn-premium py-2.5 px-5 text-xs flex-1 sm:flex-initial"
              >
                cancel
              </button>
              <button
                type="submit"
                className="btn-premium-primary py-2.5 px-6 gap-2 text-xs flex-1 sm:flex-initial"
              >
                <Save className="w-3.5 h-3.5" />
                <span>save guest</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
