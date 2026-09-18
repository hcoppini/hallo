'use client';

import React from 'react';
import { GlassWater, Beer, Wine, Sparkles, CupSoda, RotateCcw } from 'lucide-react';
import { DrinkLog, DrinkType } from '@/lib/types';
import { usePartyStore } from '@/lib/store';

const drinkIcons: Record<DrinkType, React.ElementType> = {
  cocktail: Sparkles,
  beer: Beer,
  shot: GlassWater,
  wine: Wine,
  soft: CupSoda,
};

export function DrinkHistoryList() {
  const { logs, guests, revertLastDrink } = usePartyStore();

  const getGuestName = (guestId: string) => {
    const guest = guests.find(g => g.id === guestId);
    return guest?.name || guest?.tag_id || guestId;
  };

  return (
    <div className="glass-card p-6 border border-black/10">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-black/10">
        <div>
          <h3 className="font-display text-2xl font-bold lowercase text-black">
            live drink stream
          </h3>
          <p className="font-sans-clean text-xs text-black/50 lowercase">
            real-time logs from the bar counter
          </p>
        </div>
        <span className="text-xs font-mono font-bold bg-black/5 px-2.5 py-1 rounded-full text-black/70">
          {logs.filter(l => !l.is_reverted).length} served
        </span>
      </div>

      <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
        {logs.length === 0 ? (
          <div className="py-8 text-center text-xs font-sans-clean text-black/40 lowercase">
            no drinks served yet tonight
          </div>
        ) : (
          logs.slice(0, 30).map(log => {
            const Icon = drinkIcons[log.drink_type] || GlassWater;
            const guestName = getGuestName(log.guest_id);
            const time = new Date(log.served_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={log.id}
                className={`p-3 rounded-2xl flex items-center justify-between border transition-all ${
                  log.is_reverted
                    ? 'bg-black/[0.01] border-black/5 opacity-40 line-through'
                    : 'bg-white/80 border-black/5 hover:border-black/15'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-black">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-sans-clean text-xs font-bold text-black block">
                      {guestName}
                    </span>
                    <span className="font-sans-clean text-[10px] text-black/50 lowercase">
                      {log.drink_type} • {time}
                    </span>
                  </div>
                </div>

                {!log.is_reverted && (
                  <button
                    type="button"
                    onClick={() => revertLastDrink(log.guest_id)}
                    className="p-1.5 rounded-full hover:bg-black/5 text-black/40 hover:text-black transition-colors"
                    title="Undo this drink"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
