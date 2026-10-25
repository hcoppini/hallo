'use client';

import React, { useState } from 'react';
import { Radio, X, Check, Copy, AlertCircle, ArrowRight, ArrowLeft, Smartphone, Zap } from 'lucide-react';
import { nfcController, isWebNfcSupported } from '@/lib/nfc';
import { soundSystem } from '@/lib/audio';

interface NfcWriterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTagNumber?: number;
}

export function NfcWriterModal({
  isOpen,
  onClose,
  initialTagNumber = 1,
}: NfcWriterModalProps) {
  const [currentNum, setCurrentNum] = useState(initialTagNumber);
  const [status, setStatus] = useState<'idle' | 'writing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedNotice, setCopiedNotice] = useState(false);

  if (!isOpen) return null;

  const isSupported = typeof window !== 'undefined' && isWebNfcSupported();
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const currentTagId = `TAG-${currentNum.toString().padStart(3, '0')}`;
  // Short URL (/t/1 .. /t/100) is 100% equivalent to /t/TAG-001 and much faster to edit/paste on iPhone!
  const targetShortUrl = `${baseUrl}/t/${currentNum}`;

  const handleWrite = async () => {
    if (!isSupported) {
      setErrorMsg('iOS blocks browser NFC writing. Tap "Copy /t/' + currentNum + ' & Advance" below and paste into NFC Tools on iPhone.');
      setStatus('error');
      return;
    }

    try {
      setStatus('writing');
      setErrorMsg('');
      await nfcController.writeUrl(targetShortUrl);
      soundSystem.playApprovedSound();
      setStatus('success');
      setTimeout(() => {
        setCurrentNum(prev => Math.min(100, prev + 1));
        setStatus('idle');
      }, 1000);
    } catch (err) {
      soundSystem.playErrorSound();
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Writing failed. Try again.');
    }
  };

  const copyAndAdvance = () => {
    navigator.clipboard.writeText(targetShortUrl);
    soundSystem.playApprovedSound();
    setCopiedNotice(true);
    setTimeout(() => {
      setCopiedNotice(false);
      setCurrentNum(prev => Math.min(100, prev + 1));
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bottom-sheet max-w-md w-full p-6 sm:p-8 relative bg-white border-t sm:border border-black/15 shadow-2xl rounded-t-[32px] sm:rounded-3xl max-h-[90dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:pb-8">
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-4 sm:hidden shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center mx-auto mb-3 shadow-md">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="font-display text-3xl font-bold lowercase text-black mb-1">
            iphone nfc sticker encoder
          </h3>
          <p className="font-sans-clean text-xs text-black/60 lowercase">
            ultra-short links (<code className="font-mono font-bold text-black">/t/1</code> to <code className="font-mono font-bold text-black">/t/100</code>) for fast iPhone writing
          </p>
        </div>

        {/* Current Tag Display */}
        <div className="bg-black/[0.04] rounded-2xl p-5 text-center mb-4 border border-black/10">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-black/50 mb-1">
            <span>STICKER #{currentNum} OF 100</span>
            <span>MAPS TO {currentTagId}</span>
          </div>

          <div className="font-display text-4xl font-bold text-black my-1">
            /t/{currentNum}
          </div>

          <div className="text-xs font-mono text-black/75 truncate max-w-xs mx-auto bg-white p-2.5 rounded-xl border border-black/12 flex items-center justify-between gap-2 mt-2">
            <span className="truncate select-all">{targetShortUrl}</span>
            <button
              type="button"
              onClick={copyAndAdvance}
              title="Copy URL & Advance"
              className="p-1 hover:text-black text-black/50 shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {copiedNotice && (
          <div className="p-3 rounded-2xl bg-emerald-600 text-white text-center text-xs font-sans-clean font-bold mb-4 flex items-center justify-center gap-2 shadow-md">
            <Check className="w-4 h-4" />
            <span>Copied /t/{currentNum}! Advanced to #{Math.min(100, currentNum + 1)}</span>
          </div>
        )}

        {status === 'writing' && (
          <div className="p-4 rounded-2xl bg-black text-white text-center text-xs font-sans-clean mb-4 animate-pulse">
            hold sticker against phone...
          </div>
        )}

        {status === 'success' && (
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-center text-xs font-sans-clean mb-4 flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>written successfully! advancing to next sticker...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="p-4 rounded-2xl bg-red-50 text-red-800 border border-red-200 text-center text-xs font-sans-clean mb-4 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2 mb-5">
          <button
            type="button"
            onClick={() => setCurrentNum(prev => Math.max(1, prev - 1))}
            className="btn-premium py-3.5 px-3.5 cursor-pointer"
            title="Previous sticker"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {isSupported ? (
            <button
              type="button"
              onClick={handleWrite}
              disabled={status === 'writing'}
              className="btn-premium-primary flex-1 py-3.5 gap-2 text-xs cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>write /t/{currentNum}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={copyAndAdvance}
              className="btn-premium-primary flex-1 py-3.5 gap-2 text-xs cursor-pointer shadow-lg"
            >
              <Copy className="w-4 h-4" />
              <span>copy /t/{currentNum} &amp; next (+1)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCurrentNum(prev => Math.min(100, prev + 1))}
            className="btn-premium py-3.5 px-3.5 cursor-pointer"
            title="Skip to next"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Fast iPhone Instructions */}
        <div className="space-y-2.5 text-left border-t border-black/10 pt-4">
          <div className="p-3.5 rounded-2xl bg-black/[0.03] border border-black/8 space-y-1.5">
            <div className="flex items-center gap-1.5 font-sans-clean text-xs font-bold text-black">
              <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Fastest Free iPhone Method (NFC Tools)</span>
            </div>
            <ol className="font-sans-clean text-[11px] text-black/65 space-y-1 list-decimal list-inside leading-relaxed">
              <li>
                In <strong>NFC Tools</strong> on iPhone, tap <strong>Write → Add a record → URL / URI</strong>.
              </li>
              <li>
                Paste <code className="font-mono font-bold text-black">{baseUrl}/t/1</code> and tap <strong>Write</strong> for Sticker #1.
              </li>
              <li>
                For Sticker #2, just tap the URL record in NFC Tools, backspace <code className="font-mono font-bold">1</code> to <code className="font-mono font-bold">2</code>, and tap <strong>Write</strong>! (Takes ~3 seconds per sticker).
              </li>
            </ol>
          </div>

          <div className="p-3 rounded-2xl bg-red-50/70 border border-red-200/80 text-[11px] font-sans-clean text-red-900 leading-relaxed">
            <strong>⚠️ Never type literal <code className="font-mono">/t/&#123;UID&#125;</code> in free NFC Tools:</strong> Apple blocks browsers from reading chip serial numbers, so a sticker with literal <code className="font-mono">&#123;UID&#125;</code> has no number and will open blank onboarding every tap. Always write <code className="font-mono font-bold">/t/1</code>, <code className="font-mono font-bold">/t/2</code>, <code className="font-mono font-bold">/t/4</code>!
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] font-sans-clean text-black/50 pt-3 mt-3 border-t border-black/10">
          <span>Sticker #{currentNum} of 100 ({currentTagId})</span>
          <button
            type="button"
            onClick={() => setCurrentNum(1)}
            className="hover:text-black underline cursor-pointer"
          >
            reset to #1
          </button>
        </div>
      </div>
    </div>
  );
}
