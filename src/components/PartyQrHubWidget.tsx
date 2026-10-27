'use client';

import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Music,
  Camera,
  Wifi,
  Plus,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import {
  PartyCustomQr,
  loadPartyQrs,
  savePartyQrs,
  DEFAULT_PARTY_QRS,
} from '@/lib/poker-utils';
import { generateQrDataUrl } from '@/lib/qr-utils';

export function PartyQrHubWidget() {
  const [qrs, setQrs] = useState<PartyCustomQr[]>(DEFAULT_PARTY_QRS);
  const [activeQrIndex, setActiveQrIndex] = useState(0);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});

  useEffect(() => {
    const loaded = loadPartyQrs();
    setQrs(loaded);
  }, []);

  const activeQr = qrs[activeQrIndex] || qrs[0] || DEFAULT_PARTY_QRS[0];

  useEffect(() => {
    let active = true;
    generateQrDataUrl(activeQr.url, {
      width: 220,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(dataUrl => {
      if (active) {
        setQrImages(prev => ({ ...prev, [activeQr.id]: dataUrl }));
      }
    });
    return () => {
      active = false;
    };
  }, [activeQr]);

  const renderIcon = (icon: PartyCustomQr['icon']) => {
    switch (icon) {
      case 'music':
        return <Music className="w-4 h-4 text-amber-400" />;
      case 'camera':
        return <Camera className="w-4 h-4 text-emerald-400" />;
      case 'wifi':
        return <Wifi className="w-4 h-4 text-blue-400" />;
      default:
        return <QrCode className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between space-y-4">
      {/* Top Selector Ribbon */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {qrs.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveQrIndex(idx)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-sans-clean flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
              activeQrIndex === idx
                ? 'bg-amber-400 text-black font-bold border-amber-400 shadow-sm'
                : 'bg-white/[0.04] border-white/10 text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            {renderIcon(item.icon)}
            <span>{item.title}</span>
          </button>
        ))}
      </div>

      {/* Active QR Card */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/[0.03] p-4 rounded-2xl border border-white/10">
        <div className="p-2 bg-white rounded-2xl shadow-xl shrink-0">
          {qrImages[activeQr.id] ? (
            <img
              src={qrImages[activeQr.id]}
              alt={activeQr.title}
              className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl object-contain"
            />
          ) : (
            <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center bg-neutral-100 rounded-xl">
              <QrCode className="w-8 h-8 text-black/40 animate-pulse" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
          <span className="font-mono text-[10px] uppercase font-bold text-amber-400 tracking-wider">
            SCANNABLE PARTY QR
          </span>
          <h4 className="font-display text-2xl font-bold lowercase text-white">
            {activeQr.title}
          </h4>
          <p className="font-sans-clean text-xs text-white/60 lowercase">
            {activeQr.subtitle}
          </p>

          <a
            href={activeQr.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-amber-300 hover:underline pt-1"
          >
            <span className="truncate max-w-[200px]">{activeQr.url}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
      </div>

      {/* Footer Helper */}
      <div className="pt-2 border-t border-white/10 text-center sm:text-left text-[11px] text-white/40">
        Switch tabs above to display different QR codes for guests on the venue projector.
      </div>
    </div>
  );
}
