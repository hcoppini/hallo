'use client';

import React, { useState, useEffect } from 'react';
import { Radio, X, Check, Copy, AlertCircle, ArrowRight } from 'lucide-react';
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
  const [baseUrl, setBaseUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'writing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(isWebNfcSupported());
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, []);

  if (!isOpen) return null;

  const currentTagId = `TAG-${currentNum.toString().padStart(3, '0')}`;
  const targetUrl = `${baseUrl}/t/${currentTagId}`;

  const handleWrite = async () => {
    if (!isSupported) {
      setErrorMsg('Web NFC writing requires Chrome on an Android phone.');
      setStatus('error');
      return;
    }

    try {
      setStatus('writing');
      setErrorMsg('');
      await nfcController.writeUrl(targetUrl);
      soundSystem.playApprovedSound();
      setStatus('success');
      // Auto advance to next tag after 1.2 seconds
      setTimeout(() => {
        setCurrentNum(prev => prev + 1);
        setStatus('idle');
      }, 1200);
    } catch (err) {
      soundSystem.playErrorSound();
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Writing failed. Try again.');
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(targetUrl);
    soundSystem.playApprovedSound();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bottom-sheet max-w-md w-full p-6 sm:p-8 relative bg-white border-t sm:border border-black/15 shadow-2xl rounded-t-[32px] sm:rounded-3xl pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:pb-8">
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-4 sm:hidden shrink-0" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mx-auto mb-4 border border-black/10">
            <Radio className="w-5 h-5 text-black" />
          </div>
          <h3 className="font-display text-3xl font-bold lowercase text-black mb-1">
            nfc sticker batch writer
          </h3>
          <p className="font-sans-clean text-xs text-black/60 lowercase">
            program physical stickers into wristbands in seconds
          </p>
        </div>

        {/* Current Tag Display */}
        <div className="bg-black/5 rounded-2xl p-6 text-center mb-6 border border-black/10">
          <span className="text-[11px] font-sans-clean text-black/50 uppercase tracking-wider block mb-1">
            ready to write sticker
          </span>
          <div className="font-mono text-3xl font-bold text-black mb-2">
            {currentTagId}
          </div>
          <div className="text-xs font-mono text-black/60 truncate max-w-xs mx-auto bg-white/80 p-2 rounded-lg border border-black/10 flex items-center justify-between gap-2">
            <span className="truncate">{targetUrl}</span>
            <button
              type="button"
              onClick={copyUrl}
              title="Copy URL"
              className="p-1 hover:text-black text-black/50"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Status Message */}
        {status === 'writing' && (
          <div className="p-4 rounded-2xl bg-black text-white text-center text-xs font-sans-clean mb-6 animate-pulse">
            hold sticker against back of phone...
          </div>
        )}

        {status === 'success' && (
          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-center text-xs font-sans-clean mb-6 flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>written successfully! advancing to next sticker...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="p-4 rounded-2xl bg-red-50 text-red-800 border border-red-200 text-center text-xs font-sans-clean mb-6 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={handleWrite}
            disabled={status === 'writing'}
            className="btn-premium-primary flex-1 py-3.5 gap-2"
          >
            <Radio className="w-4 h-4" />
            <span>write {currentTagId}</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentNum(prev => prev + 1)}
            className="btn-premium py-3.5 px-4"
            title="Skip to next"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] font-sans-clean text-black/50 pt-3 border-t border-black/10">
          <span>Sticker #{currentNum} of 100</span>
          <button
            type="button"
            onClick={() => setCurrentNum(1)}
            className="hover:text-black underline"
          >
            reset to #1
          </button>
        </div>
      </div>
    </div>
  );
}
