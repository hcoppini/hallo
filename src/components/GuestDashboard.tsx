'use client';

import React, { useMemo } from 'react';
import {
  Beer,
  Sparkles,
  GlassWater,
  Wine,
  CupSoda,
  Clock,
  Flame,
  Snowflake,
  Radio,
  Shield,
  Lock,
  DoorOpen,
  History,
  Trophy,
} from 'lucide-react';
import { Guest, PartySettings, DrinkLog, formatDrinkHistoryLabel } from '@/lib/types';
import { DrinkCategory, getDrinkCategory } from '@/lib/admin-utils';
import { computeGuestDashboardStats } from '@/lib/guest-dashboard-utils';

interface GuestDashboardProps {
  assignedGuest: Guest | null;
  tagLabel: string;
  guests: Guest[];
  logs: DrinkLog[];
  settings: PartySettings;
  onSecretTap: () => void;
  onOpenStaffPin: () => void;
}

const drinkCategoryIcons: Record<DrinkCategory, React.ElementType> = {
  beer: Beer,
  cocktail: Sparkles,
  shot: GlassWater,
  wine: Wine,
  soft: CupSoda,
};

function formatTime24h(isoString: string | null | undefined): string {
  if (!isoString) return '--:--';
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--';
  }
}

export function GuestDashboard({
  assignedGuest,
  tagLabel,
  guests,
  logs,
  settings,
  onSecretTap,
  onOpenStaffPin,
}: GuestDashboardProps) {
  const stats = useMemo(
    () => computeGuestDashboardStats(guests, logs, settings, assignedGuest),
    [guests, logs, settings, assignedGuest]
  );

  const isVip = assignedGuest?.category === 'vip';
  const isDriver = assignedGuest?.category === 'driver_minor';

  const LastOrderIcon = stats.lastOrder
    ? drinkCategoryIcons[stats.lastOrder.drinkCategory] || GlassWater
    : GlassWater;

  const TopDrinkIcon = stats.topDrink
    ? drinkCategoryIcons[stats.topDrink.drinkCategory] || Sparkles
    : Sparkles;

  return (
    <div className="w-full space-y-4 pb-6 animate-in fade-in duration-200">
      {/* ================================================================ */}
      {/* 1. PERSONAL WRISTBAND PASS CARD                                  */}
      {/* ================================================================ */}
      {assignedGuest ? (
        <div className="glass-card p-6 sm:p-7 border border-black/15 shadow-xl space-y-5">
          {/* Top Row: Tag Pill & Tier / Cooldown Status */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-black/55 font-bold bg-black/[0.04] px-2.5 py-1 rounded-full border border-black/8">
              {tagLabel}
            </span>

            <div className="flex items-center gap-1.5">
              {stats.isGuestOnCooldown && (
                <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                  <Snowflake className="w-3 h-3" />
                  <span>On Cooldown</span>
                </span>
              )}
              {isVip ? (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  VIP Host
                </span>
              ) : isDriver ? (
                <span className="bg-blue-100 text-blue-900 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  Driver / 0 Alc
                </span>
              ) : (
                <span className="bg-black/5 text-black/70 text-[10px] font-semibold px-2.5 py-1 rounded-full lowercase">
                  standard (18+)
                </span>
              )}
            </div>
          </div>

          {/* Guest Identity & Drink Counter */}
          <div className="text-center">
            <span
              onClick={onSecretTap}
              className="font-mono text-[10px] text-black/40 uppercase tracking-widest block mb-1 cursor-pointer select-none"
            >
              GUEST PARTY DASHBOARD
            </span>
            <h1 className="font-display text-4xl sm:text-5xl font-bold lowercase text-black leading-none mb-2">
              {assignedGuest.name}
            </h1>

            <div className="font-display text-6xl font-bold text-black my-2 leading-none">
              {assignedGuest.drinks_consumed}
              <span className="text-3xl text-black/25 font-normal">
                /{isVip ? '∞' : stats.effectiveLimit}
              </span>
            </div>

            <span className="font-sans-clean text-xs font-semibold text-black/60 lowercase block">
              {isVip
                ? 'unlimited drinks unlocked'
                : isDriver
                ? 'non-alcoholic pass (soft drinks only)'
                : stats.isGuestOnCooldown
                ? 'on cooldown — max drink limit reached'
                : `${stats.remainingDrinks} ${stats.remainingDrinks === 1 ? 'drink' : 'drinks'} remaining tonight`}
            </span>

            {/* Monochrome Progress Bar */}
            <div className="w-full max-w-xs mx-auto h-3 rounded-full bg-black/[0.05] border border-black/20 p-0.5 mt-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.isGuestOnCooldown ? 'bg-red-600' : 'bg-black'
                }`}
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>

            {assignedGuest.entered_at && (
              <div className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-sans-clean text-black/45">
                <Clock className="w-3 h-3" />
                <span>checked in at {formatTime24h(assignedGuest.entered_at)}</span>
              </div>
            )}
          </div>

          {/* Cooldown Notice Banner if Guest Hit Limit */}
          {stats.isGuestOnCooldown && (
            <div className="p-4 rounded-2xl bg-red-600 text-white text-center shadow-md space-y-1">
              <div className="flex items-center justify-center gap-1.5 font-display text-xl font-bold lowercase">
                <Snowflake className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                <span>you are on cooldown</span>
              </div>
              <p className="font-sans-clean text-xs text-white/90">
                You’ve hit your drink limit for tonight. Grab a water or soft drink at the bar!
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Unassigned Wristband Card (still lets guest see live party stats below!) */
        <div className="glass-card p-7 text-center border border-black/15 shadow-xl space-y-3.5">
          <div
            onClick={onSecretTap}
            className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center mx-auto text-black border border-black/10 cursor-pointer select-none"
          >
            <DoorOpen className="w-6 h-6" />
          </div>
          <span
            onClick={onSecretTap}
            className="font-mono text-[10px] text-black/40 uppercase tracking-widest block cursor-pointer select-none"
          >
            HALLOWEEN PARTY PASS
          </span>
          <h1 className="font-display text-3xl font-bold lowercase text-black">
            wristband not active
          </h1>
          <div className="inline-block px-3.5 py-1 rounded-full bg-black/5 font-mono text-xs font-bold text-black">
            {tagLabel}
          </div>
          <p className="font-sans-clean text-xs text-black/60 leading-relaxed max-w-xs mx-auto">
            Present this wristband at the front door reception to link your name and activate your pass.
          </p>
        </div>
      )}

      {/* ================================================================ */}
      {/* 2. LAST ORDER AT THE BAR (LIVE SPOTLIGHT)                        */}
      {/* ================================================================ */}
      <div className="glass-card p-5 border border-black/12 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/50">
              LAST ORDER AT THE BAR
            </span>
          </div>
          {stats.lastOrder && (
            <span className="font-mono text-[11px] font-semibold text-black/45">
              {formatTime24h(stats.lastOrder.servedAt)}
            </span>
          )}
        </div>

        {stats.lastOrder ? (
          <div className="flex items-center justify-between gap-3 bg-black/[0.03] border border-black/8 rounded-2xl p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
                <LastOrderIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-2xl font-bold lowercase text-black leading-none truncate">
                  {stats.lastOrder.drinkLabel.toLowerCase()}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-sans-clean text-black/60 mt-1 truncate">
                  <span>ordered by</span>
                  <span className="font-bold text-black truncate">
                    {assignedGuest && stats.lastOrder.log.guest_id === assignedGuest.id
                      ? `${stats.lastOrder.guestName} (you)`
                      : stats.lastOrder.guestName}
                  </span>
                  {stats.lastOrder.tagLabel && (
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/8 text-black/70 shrink-0">
                      {stats.lastOrder.tagLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/6 text-center">
            <p className="font-sans-clean text-xs text-black/45 lowercase">
              no drinks ordered yet tonight — be the first at the bar!
            </p>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* 3. LIVE PARTY PULSE & TOP DRINK TONIGHT                          */}
      {/* ================================================================ */}
      <div className="grid grid-cols-2 gap-3">
        {/* Live Party Pulse */}
        <div className="glass-card p-4 border border-black/12 flex flex-col justify-between">
          <div className="flex items-center justify-between text-black/45 mb-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
              PARTY PULSE
            </span>
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <div className="font-display text-3xl font-bold text-black leading-none">
              {stats.partyPulse.totalDrinksPoured}
            </div>
            <span className="font-sans-clean text-[11px] font-semibold text-black/55 lowercase block mt-1">
              drinks poured • {stats.partyPulse.guestsCheckedIn} guests in
            </span>
          </div>
        </div>

        {/* Most Popular Drink */}
        <div className="glass-card p-4 border border-black/12 flex flex-col justify-between">
          <div className="flex items-center justify-between text-black/45 mb-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
              TOP DRINK
            </span>
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
          </div>
          {stats.topDrink ? (
            <div>
              <div className="flex items-center gap-1.5">
                <TopDrinkIcon className="w-4 h-4 text-black shrink-0" />
                <span className="font-display text-xl font-bold lowercase text-black leading-tight truncate">
                  {stats.topDrink.drinkType}
                </span>
              </div>
              <span className="font-sans-clean text-[11px] font-semibold text-black/55 lowercase block mt-1">
                {stats.topDrink.count} ordered ({stats.topDrink.sharePercent}%)
              </span>
            </div>
          ) : (
            <div>
              <div className="font-display text-xl font-bold lowercase text-black/35 leading-none">
                tbd
              </div>
              <span className="font-sans-clean text-[11px] text-black/45 lowercase block mt-1">
                waiting for first pour
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* 4. WHO'S ALREADY ON COOLDOWN                                     */}
      {/* ================================================================ */}
      <div className="glass-card p-5 border border-black/12 shadow-md">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-black/8">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-black" />
            <div>
              <h2 className="font-display text-2xl font-bold lowercase text-black leading-none">
                who’s on cooldown
              </h2>
              <p className="font-sans-clean text-[11px] text-black/50 lowercase mt-0.5">
                guests who maxed out their pass tonight
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-black/6 text-black/75">
            {stats.cooldownGuests.length}
          </span>
        </div>

        {stats.cooldownGuests.length === 0 ? (
          <div className="py-5 text-center space-y-1">
            <Snowflake className="w-5 h-5 text-black/30 mx-auto" />
            <p className="font-sans-clean text-xs text-black/50 lowercase">
              nobody is on cooldown yet — everyone is still pacing themselves!
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            {stats.cooldownGuests.map(item => {
              const isCurrentGuest = Boolean(assignedGuest && item.guest.id === assignedGuest.id);
              return (
                <div
                  key={item.guest.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isCurrentGuest
                      ? 'bg-black text-white border-black shadow-sm'
                      : 'bg-black/[0.025] border-black/8 text-black'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                        isCurrentGuest ? 'bg-white/20 text-white' : 'bg-black/8 text-black/70'
                      }`}
                    >
                      {item.tagLabel}
                    </span>
                    <span className="font-sans-clean text-xs font-bold truncate">
                      {item.displayName}
                      {isCurrentGuest ? ' (you)' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.lastDrinkAt && (
                      <span
                        className={`font-mono text-[10px] ${
                          isCurrentGuest ? 'text-white/70' : 'text-black/45'
                        }`}
                      >
                        {formatTime24h(item.lastDrinkAt)}
                      </span>
                    )}
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isCurrentGuest
                          ? 'bg-red-500 text-white'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {item.drinksConsumed}/{item.effectiveLimit} MAX
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* 5. PERSONAL DRINK HISTORY                                        */}
      {/* ================================================================ */}
      {assignedGuest && (
        <div className="glass-card p-5 border border-black/12 shadow-md">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-black/8">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-black" />
              <div>
                <h2 className="font-display text-2xl font-bold lowercase text-black leading-none">
                  your history
                </h2>
                <p className="font-sans-clean text-[11px] text-black/50 lowercase mt-0.5">
                  personal log for {assignedGuest.name}
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-black/6 text-black/75">
              {stats.personalLogs.length} {stats.personalLogs.length === 1 ? 'order' : 'orders'}
            </span>
          </div>

          {stats.personalLogs.length === 0 && !assignedGuest.entered_at ? (
            <p className="font-sans-clean text-xs text-black/45 lowercase py-4 text-center">
              no orders recorded on your wristband yet tonight.
            </p>
          ) : (
            <div className="divide-y divide-black/[0.06]">
              {stats.personalLogs.map((log, index) => {
                const cat = getDrinkCategory(log.drink_type);
                const Icon = drinkCategoryIcons[cat] || GlassWater;
                const orderNumber = stats.personalLogs.length - index;

                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2.5 text-xs font-sans-clean text-black"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-black/5 flex items-center justify-center shrink-0 text-black/75">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-black lowercase block truncate">
                          {formatDrinkHistoryLabel(log.drink_type)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/5 text-black/55">
                        #{orderNumber}
                      </span>
                      <span className="font-mono text-xs font-semibold text-black/50 tabular-nums w-11 text-right">
                        {formatTime24h(log.served_at)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {assignedGuest.entered_at && (
                <div className="flex items-center justify-between py-2.5 text-xs font-sans-clean text-black/60">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-black/[0.03] flex items-center justify-center shrink-0 text-black/45">
                      <DoorOpen className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium lowercase">checked in at reception</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-black/40 tabular-nums w-11 text-right">
                    {formatTime24h(assignedGuest.entered_at)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* 6. FOOTER INFO & SUBTLE STAFF UNLOCK                             */}
      {/* ================================================================ */}
      <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/10 text-center space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-black font-sans-clean font-semibold text-xs">
          <Shield className="w-3.5 h-3.5 text-black/60" />
          <span>drinks are logged by staff at the bar</span>
        </div>
        <p className="font-sans-clean text-[11px] text-black/50 leading-relaxed max-w-xs mx-auto">
          Tap your wristband at the bar to order your next drink. Have an unforgettable night!
        </p>
        <div className="pt-2 border-t border-black/8">
          <button
            type="button"
            onClick={onOpenStaffPin}
            className="inline-flex items-center gap-1.5 text-[11px] font-sans-clean font-semibold text-black/40 hover:text-black transition-colors py-1 px-3 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <Lock className="w-3 h-3" />
            <span>Bartender / Staff? Unlock Terminal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
