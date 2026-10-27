'use client';

import React, { useMemo } from 'react';
import {
  Trophy,
  Flame,
  Award,
  Sparkles,
  Users,
  GlassWater,
  Heart,
  Crown,
} from 'lucide-react';
import { Guest, DrinkLog } from '@/lib/types';
import { parseTagId } from '@/lib/tag-utils';

interface PartyFunStatsWidgetProps {
  guests: Guest[];
  logs?: DrinkLog[];
}

export function PartyFunStatsWidget({ guests }: PartyFunStatsWidgetProps) {
  // 1. Entered guests
  const entered = useMemo(() => guests.filter(g => g.is_entered), [guests]);

  // 2. Top Drinkers (sorted descending)
  const topDrinkers = useMemo(() => {
    return [...entered]
      .filter(g => g.drinks_consumed > 0)
      .sort((a, b) => b.drinks_consumed - a.drinks_consumed)
      .slice(0, 4);
  }, [entered]);

  // 3. Total drinks consumed across all guests
  const totalDrinksConsumed = useMemo(() => {
    return guests.reduce((sum, g) => sum + (g.drinks_consumed || 0), 0);
  }, [guests]);

  // 4. Designated drivers / Non-drinkers
  const soberHeroes = useMemo(() => {
    return entered.filter(g => g.category === 'driver_minor' || g.custom_drink_limit === 0);
  }, [entered]);

  // 5. Turnout percentage
  const totalCapacity = guests.length || 1;
  const turnoutPct = Math.round((entered.length / totalCapacity) * 100);

  return (
    <div className="flex-1 flex flex-col justify-between space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
            PARTY LEADERBOARD & LIVE STATS
          </span>
        </div>
        <span className="font-mono text-xs text-white/50">
          {entered.length} active partygoers
        </span>
      </div>

      {/* Main Stats Grid */}
      <div className="space-y-3">
        {/* Top 3 Drink Legends Podium */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase text-white/60 tracking-wider">
              Top Drink Champions
            </span>
            <Crown className="w-3.5 h-3.5 text-amber-400" />
          </div>

          {topDrinkers.length === 0 ? (
            <p className="text-xs text-white/40 font-sans-clean py-2 lowercase text-center">
              No drinks served yet. Bar is open and waiting for first round!
            </p>
          ) : (
            <div className="space-y-1.5">
              {topDrinkers.map((drinker, idx) => {
                const tag = parseTagId(drinker.tag_id).tagNumber;
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️';

                return (
                  <div
                    key={drinker.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                      idx === 0
                        ? 'bg-amber-400/15 border-amber-400/40 text-amber-300 shadow-xs'
                        : 'bg-white/[0.02] border-white/5 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm shrink-0">{medal}</span>
                      <span className="font-mono text-[11px] opacity-60 shrink-0">
                        {tag ? `#${tag.toString().padStart(3, '0')}` : drinker.tag_id}
                      </span>
                      <span className="font-display text-lg font-bold lowercase truncate">
                        {drinker.name || `Guest ${drinker.tag_id}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-sm font-bold">
                        {drinker.drinks_consumed}
                      </span>
                      <span className="font-sans-clean text-[10px] opacity-60 lowercase">
                        drinks
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fun Venue Highlights Grid */}
        <div className="grid grid-cols-3 gap-2">
          {/* Total Drinks Poured */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center flex flex-col justify-center">
            <div className="w-7 h-7 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto mb-1">
              <GlassWater className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-xl sm:text-2xl font-bold text-white">
              {totalDrinksConsumed}
            </span>
            <span className="font-sans-clean text-[10px] text-white/50 lowercase">
              total drinks poured
            </span>
          </div>

          {/* Turnout Percentage */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center flex flex-col justify-center">
            <div className="w-7 h-7 rounded-lg bg-emerald-400/10 text-emerald-400 flex items-center justify-center mx-auto mb-1">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-xl sm:text-2xl font-bold text-emerald-400">
              {turnoutPct}%
            </span>
            <span className="font-sans-clean text-[10px] text-white/50 lowercase">
              venue turnout
            </span>
          </div>

          {/* Sober Champions / Drivers */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-center flex flex-col justify-center">
            <div className="w-7 h-7 rounded-lg bg-blue-400/10 text-blue-400 flex items-center justify-center mx-auto mb-1">
              <Heart className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-xl sm:text-2xl font-bold text-white">
              {soberHeroes.length}
            </span>
            <span className="font-sans-clean text-[10px] text-white/50 lowercase">
              sober drivers
            </span>
          </div>
        </div>
      </div>

      {/* Footer Milestone */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50">
        <span className="flex items-center gap-1.5 lowercase">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Realtime data synced with Barman Station</span>
        </span>
        <span className="font-mono text-[10px]">
          {entered.length === totalCapacity ? '🎉 100% full house' : `${totalCapacity - entered.length} remaining`}
        </span>
      </div>
    </div>
  );
}
