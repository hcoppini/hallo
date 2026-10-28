'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Maximize2,
  Minimize2,
  Users,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Shuffle,
  Plus,
  DoorOpen,
  Monitor,
  ListMusic,
  Trash2,
  Music2,
  X,
  Loader2,
  Trophy,
  QrCode,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { usePartyStore } from '@/lib/store';
import { parseTagId } from '@/lib/tag-utils';
import { soundSystem } from '@/lib/audio';
import {
  DEFAULT_PARTY_QUEUE,
  QueueItem,
  parseYouTubeInput,
  buildEmbedUrl,
} from '@/lib/youtube-utils';
import {
  getEnteredGuestsSorted,
  calculateProjectorStats,
  formatWallClockTime,
  formatRelativeTime,
} from '@/lib/projector-utils';
import { PartyProgressBar } from './PartyProgressBar';
import { PokerWidget } from './PokerWidget';
import { PartyFunStatsWidget } from './PartyFunStatsWidget';
import { PartyQrHubWidget } from './PartyQrHubWidget';
import {
  PartyProgramSchedule,
  loadPartySchedule,
  PARTY_SCHEDULE_STORAGE_KEY,
} from '@/lib/party-schedule-utils';

export type SidebarTab = 'arrivals' | 'poker' | 'stats' | 'qrs';

export function ProjectorDisplay() {
  const { guests, checkIn, refresh } = usePartyStore();

  const stageContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Responsive PC detection
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [forcePcMode, setForcePcMode] = useState(false);

  // Projector Stage State
  const [isCinemaMode] = useState(true);
  const [splitRatio] = useState<'65_35' | '50_50' | '75_25'>('65_35');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playChimeOnArrival, setPlayChimeOnArrival] = useState(false);

  // Music Queue & Playback State
  const [queue, setQueue] = useState<QueueItem[]>(DEFAULT_PARTY_QUEUE);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isShuffleOn, setIsShuffleOn] = useState(false);

  // Custom Input State
  const [customInputUrl, setCustomInputUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [addUrlError, setAddUrlError] = useState<string | null>(null);

  // Guest Feed State
  const [lastAnnouncedGuestId, setLastAnnouncedGuestId] = useState<string | null>(null);
  const [newArrivalHighlightId, setNewArrivalHighlightId] = useState<string | null>(null);

  // Party Program Progress Bar State
  const [partySchedule, setPartySchedule] = useState<PartyProgramSchedule>(() => loadPartySchedule());
  const [simulatedTime] = useState<string | null>(null);

  // Arrivals Feed & Lounge Widget Unified Tab State
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('arrivals');
  const [collapsedArrivalToast, setCollapsedArrivalToast] = useState<string | null>(null);

  // Sync party schedule across admin changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === PARTY_SCHEDULE_STORAGE_KEY) {
        setPartySchedule(loadPartySchedule());
      }
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(() => {
      setPartySchedule(loadPartySchedule());
    }, 3000);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const currentTrack: QueueItem = queue[currentTrackIndex] || queue[0] || DEFAULT_PARTY_QUEUE[0];
  const upcomingQueue = useMemo(() => {
    return queue.slice(currentTrackIndex + 1);
  }, [queue, currentTrackIndex]);

  // Embed URL for active video
  const activeEmbedUrl = useMemo(() => {
    return buildEmbedUrl({
      videoId: currentTrack.videoId,
      autoplay: true,
      muted: false,
    });
  }, [currentTrack]);

  // Detect screen size on client
  useEffect(() => {
    const checkViewport = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Send command to YouTube iframe via postMessage
  const postIframeCommand = (command: string, args: any[] = []) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: command, args }),
        '*'
      );
    }
  };

  // Skip to next track in queue
  const handleNextTrack = () => {
    if (currentTrackIndex < queue.length - 1) {
      setCurrentTrackIndex(prev => prev + 1);
      setIsPlaying(true);
    } else {
      // Loop back to start of queue
      setCurrentTrackIndex(0);
      setIsPlaying(true);
    }
  };

  // Go back to previous track in queue
  const handlePrevTrack = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(prev => prev - 1);
      setIsPlaying(true);
    } else {
      setCurrentTrackIndex(queue.length - 1);
      setIsPlaying(true);
    }
  };

  // Toggle play/pause
  const handleTogglePlay = () => {
    if (isPlaying) {
      postIframeCommand('pauseVideo');
      setIsPlaying(false);
    } else {
      postIframeCommand('playVideo');
      setIsPlaying(true);
    }
  };

  // Shuffle array helper (Fisher-Yates)
  const shuffleArray = <T,>(arr: T[]): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  // Toggle shuffle & shuffle upcoming queue
  const handleToggleShuffle = () => {
    const nextShuffleState = !isShuffleOn;
    setIsShuffleOn(nextShuffleState);

    if (nextShuffleState) {
      // Shuffle all upcoming tracks in the queue
      const current = queue[currentTrackIndex];
      const past = queue.slice(0, currentTrackIndex);
      const upcoming = queue.slice(currentTrackIndex + 1);
      const shuffledUpcoming = shuffleArray(upcoming);

      setQueue([...past, current, ...shuffledUpcoming]);
    }
  };

  // Dedicated Shuffle Queue button
  const handleShuffleUpcomingQueue = () => {
    setIsShuffleOn(true);
    const current = queue[currentTrackIndex];
    const past = queue.slice(0, currentTrackIndex);
    const upcoming = queue.slice(currentTrackIndex + 1);
    const shuffledUpcoming = shuffleArray(upcoming);

    setQueue([...past, current, ...shuffledUpcoming]);
    soundSystem.vibrate(20);
  };

  // Auto-advance when video finishes
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.event === 'onStateChange' && data?.info === 0) {
          // YT.PlayerState.ENDED (0) -> auto advance to next song in queue
          handleNextTrack();
        }
      } catch {}
    };
    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [currentTrackIndex, queue]);

  // Remove track from queue
  const handleRemoveTrack = (indexToRemove: number) => {
    setQueue(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (indexToRemove < currentTrackIndex) {
      setCurrentTrackIndex(prev => Math.max(0, prev - 1));
    }
  };

  // Jump directly to track in queue
  const handlePlayQueueItem = (targetIndex: number) => {
    setCurrentTrackIndex(targetIndex);
    setIsPlaying(true);
  };

  // Add custom URL / playlist to queue
  const handleAddCustomTrack = async (e: React.FormEvent, shouldShuffle = false) => {
    e.preventDefault();
    if (!customInputUrl.trim()) return;

    const parsed = parseYouTubeInput(customInputUrl, { autoplay: true, muted: false });
    if (!parsed.isValid) {
      setAddUrlError('Please enter a valid YouTube video or playlist URL.');
      return;
    }

    setAddUrlError(null);

    // If it is a playlist, fetch its actual queue of videos!
    if (parsed.playlistId) {
      setIsLoadingPlaylist(true);
      try {
        const res = await fetch(`/api/youtube/playlist?list=${encodeURIComponent(parsed.playlistId)}`);
        const data = await res.json();

        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          const playlistItems: QueueItem[] = data.items.map((it: any, index: number) => ({
            id: `pl-${parsed.playlistId}-${it.videoId}-${index}`,
            title: it.title || `Track ${index + 1}`,
            artist: it.artist || data.playlistTitle || 'Playlist',
            videoId: it.videoId,
            playlistId: parsed.playlistId || undefined,
          }));

          let finalQueue = playlistItems;
          let targetIndex = 0;

          if (shouldShuffle) {
            finalQueue = shuffleArray(playlistItems);
            setIsShuffleOn(true);
          } else if (parsed.videoId) {
            // If URL was a specific video in a playlist, start from that video
            const foundIdx = playlistItems.findIndex(it => it.videoId === parsed.videoId);
            if (foundIdx >= 0) targetIndex = foundIdx;
          }

          setQueue(finalQueue);
          setCurrentTrackIndex(targetIndex);
          setIsPlaying(true);

          setCustomInputUrl('');
          setCustomTitle('');
          setCustomArtist('');
          setIsAddModalOpen(false);
          setIsLoadingPlaylist(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to load playlist items via API:', err);
      } finally {
        setIsLoadingPlaylist(false);
      }
    }

    // Single video addition
    const newTrack: QueueItem = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim() || 'Custom Music Video',
      artist: customArtist.trim() || 'Guest Queue',
      videoId: parsed.videoId || 'sOnqjkJTMaA',
      playlistId: parsed.playlistId || undefined,
    };

    setQueue(prev => [...prev, newTrack]);
    setCustomInputUrl('');
    setCustomTitle('');
    setCustomArtist('');
    setAddUrlError(null);
    setIsAddModalOpen(false);
  };

  // Fast background poll (every 2.5s) to guarantee zero latency even if WebSockets drop
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 2500);
    return () => clearInterval(interval);
  }, [refresh]);

  // Filter and sort entered guests
  const enteredGuests = useMemo(() => getEnteredGuestsSorted(guests), [guests]);
  const stats = useMemo(() => calculateProjectorStats(guests), [guests]);
  const latestGuest = enteredGuests[0] || null;

  // Realtime guest arrival detection with celebration animation + confetti
  useEffect(() => {
    if (!latestGuest) return;

    if (lastAnnouncedGuestId && latestGuest.id !== lastAnnouncedGuestId) {
      // NEW GUEST ARRIVED!
      setNewArrivalHighlightId(latestGuest.id);

      // Fire celebratory confetti on projector wall!
      try {
        confetti({
          particleCount: 75,
          spread: 80,
          origin: { y: 0.25 },
          colors: ['#ffffff', '#fbbf24', '#f59e0b', '#dc2626'],
        });
      } catch {}

      if (playChimeOnArrival) {
        soundSystem.playCelebrationSound();
      }

      if (activeSidebarTab !== 'arrivals') {
        setCollapsedArrivalToast(`${latestGuest.name || `Guest ${latestGuest.tag_id}`} just arrived!`);
        setTimeout(() => setCollapsedArrivalToast(null), 8000);
      }

      const timer = setTimeout(() => {
        setNewArrivalHighlightId(null);
      }, 9000);
      return () => clearTimeout(timer);
    }

    setLastAnnouncedGuestId(latestGuest.id);
  }, [latestGuest, lastAnnouncedGuestId, playChimeOnArrival, activeSidebarTab]);

  // Fullscreen Stage toggle
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (stageContainerRef.current) {
          await stageContainerRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen request failed:', err);
    }
  };

  // Demo simulator: admits the next unadmitted guest for instant testing
  const handleSimulateCheckIn = async () => {
    const unadmitted = guests.find(g => !g.is_entered);
    if (!unadmitted) return;

    const demoNames = ['Maya', 'Aleksander', 'Kasia', 'Liam', 'Zuzanna', 'Piotr', 'Marta', 'Mateusz'];
    const chosenName = demoNames[Math.floor(Math.random() * demoNames.length)];

    await checkIn({
      tag_id: unadmitted.tag_id,
      name: chosenName,
      category: 'standard',
    });
  };

  // If user is on a small screen and hasn't forced PC mode
  if (isMobileScreen && !forcePcMode) {
    return (
      <div className="w-full max-w-xl mx-auto py-12 px-4 text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-black/5 border border-black/10 mx-auto flex items-center justify-center text-black">
          <Monitor className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-bold lowercase text-black">
            projector widescreen view.
          </h1>
          <p className="font-sans-clean text-xs sm:text-sm text-black/60 lowercase leading-relaxed max-w-md mx-auto">
            this music video station is built for laptops connected to 1080p / 4k venue projectors to project youtube music videos alongside live guest arrivals.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link href="/" className="btn-premium w-full sm:w-auto">
            <span>back to party hub</span>
          </Link>
          <button
            type="button"
            onClick={() => setForcePcMode(true)}
            className="btn-premium-primary w-full sm:w-auto gap-2"
          >
            <Monitor className="w-4 h-4" />
            <span>preview pc view anyway</span>
          </button>
        </div>
      </div>
    );
  }

  // Split layout classes
  const splitClasses = {
    '65_35': {
      video: 'lg:w-[65%]',
      feed: 'lg:w-[35%]',
    },
    '50_50': {
      video: 'lg:w-[50%]',
      feed: 'lg:w-[50%]',
    },
    '75_25': {
      video: 'lg:w-[75%]',
      feed: 'lg:w-[25%]',
    },
  }[splitRatio];

  const themeClasses = isCinemaMode
    ? 'bg-[#060606] text-white border-white/10'
    : 'bg-[#FAFAFA] text-black border-black/10';

  const cardThemeClasses = isCinemaMode
    ? 'bg-[#0f0f0f] border-white/10 text-white shadow-2xl'
    : 'bg-white border-black/10 text-black shadow-lg';

  return (
    <div
      ref={stageContainerRef}
      className={`w-full h-screen max-h-screen ${themeClasses} transition-colors duration-300 flex flex-col p-2.5 sm:p-3.5 space-y-2.5 overflow-hidden`}
    >
      {/* ================================================================ */}
      {/* 1. UNIFIED TOP BAR: PROGRESS BAR + ATTENDANCE + STAGE CONTROLS   */}
      {/* ================================================================ */}
      <header
        className={`w-full rounded-2xl px-4 py-2 flex items-center justify-between gap-4 border ${cardThemeClasses} shrink-0`}
      >
        {/* Left: Party Program Progress Bar */}
        <PartyProgressBar
          schedule={partySchedule}
          simulatedTime={simulatedTime}
          className="flex-1 min-w-0"
        />

        {/* Right: Ambient Venue Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Door Entry Sound Chime */}
          <button
            type="button"
            onClick={() => setPlayChimeOnArrival(prev => !prev)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              playChimeOnArrival
                ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                : 'border-white/10 text-white/50 hover:text-white hover:bg-white/[0.05]'
            }`}
            title={playChimeOnArrival ? 'Arrival Chime Enabled' : 'Arrival Chime Muted'}
          >
            {playChimeOnArrival ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Fullscreen Stage Mode */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/15 hover:bg-white/10 text-xs font-sans-clean font-medium tracking-wider lowercase transition-all cursor-pointer text-white/90 hover:text-white"
            title="Toggle Fullscreen Projector Canvas"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'exit' : 'stage'}</span>
          </button>
        </div>
      </header>

      {/* ================================================================ */}
      {/* 2. DUAL SPLIT WORKSPACE: YOUTUBE MUSIC VIDEO + LIVE GUEST FEED    */}
      {/* ================================================================ */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-hidden">
        {/* ============================================================== */}
        {/* LEFT VIEW: YOUTUBE MUSIC VIDEO PLAYER + QUEUE WORKSPACE        */}
        {/* ============================================================== */}
        <section className={`flex flex-col gap-2 h-full min-h-0 ${splitClasses.video} transition-all duration-300`}>
          {/* Music Video Canvas */}
          <div
            className={`relative flex-1 min-h-0 rounded-2xl overflow-hidden border ${cardThemeClasses} flex flex-col`}
          >
            {/* Embedded YouTube Player */}
            <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center min-h-0">
              <iframe
                ref={iframeRef}
                title="YouTube Music Video Player"
                src={activeEmbedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-none"
              />
            </div>

            {/* Playback Controls & Action Ribbon */}
            <div className="px-3.5 py-2 border-t border-white/10 flex items-center justify-between gap-3 bg-[#0a0a0a] shrink-0">
              {/* Transport Controls: Prev, Play/Pause, Next, Shuffle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevTrack}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                  title="Previous Track"
                >
                  <SkipBack className="w-3.5 h-3.5 fill-white" />
                </button>

                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="p-2.5 rounded-full bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer active:scale-95 shadow-md"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-black ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                  title="Next Track"
                >
                  <SkipForward className="w-3.5 h-3.5 fill-white" />
                </button>

                <button
                  type="button"
                  onClick={handleToggleShuffle}
                  className={`p-2 rounded-full transition-all cursor-pointer active:scale-95 ${
                    isShuffleOn
                      ? 'bg-amber-400 text-black font-bold shadow-md'
                      : 'bg-white/10 hover:bg-white/20 text-white opacity-70 hover:opacity-100'
                  }`}
                  title={isShuffleOn ? 'Shuffle Mode On' : 'Shuffle Queue'}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* High-Contrast "+ Add Video or Playlist" Button */}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-1.5 rounded-full font-sans-clean font-bold text-xs tracking-wider lowercase transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 bg-white text-black hover:bg-neutral-200 border border-white shadow-lg"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>add video or playlist</span>
              </button>
            </div>
          </div>

          {/* UP NEXT ON QUEUE BAR */}
          <div className={`p-2 px-3 rounded-xl border ${cardThemeClasses} shrink-0 space-y-1`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListMusic className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-white/90">
                  UP NEXT ({upcomingQueue.length})
                </span>
                {upcomingQueue.length > 1 && (
                  <button
                    type="button"
                    onClick={handleShuffleUpcomingQueue}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 font-mono text-[9px] font-bold transition-all cursor-pointer"
                    title="Randomly shuffle all upcoming songs in queue"
                  >
                    <Shuffle className="w-2.5 h-2.5" />
                    <span>shuffle</span>
                  </button>
                )}
              </div>
              <span className="font-mono text-[10px] text-white/50">
                Track {currentTrackIndex + 1} of {queue.length}
              </span>
            </div>

            {/* Upcoming Track Strip */}
            {upcomingQueue.length === 0 ? (
              <div className="py-1 text-xs text-white/40 font-sans-clean">
                End of queue reached. Click &quot;+ Add Video or Playlist&quot; to queue more.
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {upcomingQueue.map((track, relativeIdx) => {
                  const absoluteIdx = currentTrackIndex + 1 + relativeIdx;
                  return (
                    <div
                      key={track.id}
                      className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 flex items-center gap-2 shrink-0 transition-all group"
                    >
                      <button
                        type="button"
                        onClick={() => handlePlayQueueItem(absoluteIdx)}
                        className="text-left cursor-pointer max-w-[160px]"
                        title="Play Track Now"
                      >
                        <span className="font-sans-clean text-xs font-bold text-white block leading-tight group-hover:text-amber-300 truncate">
                          {track.title}
                        </span>
                        <span className="font-sans-clean text-[10px] text-white/50 block leading-tight mt-0.5 truncate">
                          {track.artist}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveTrack(absoluteIdx)}
                        className="p-1 rounded-md text-white/30 hover:text-red-400 hover:bg-white/10 transition-colors ml-0.5 cursor-pointer"
                        title="Remove from Queue"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* RIGHT VIEW: LIVE GUEST ARRIVALS & PARTY HUB LOUNGE            */}
        {/* ============================================================== */}
        <section className={`flex flex-col gap-4 ${splitClasses.feed} transition-all duration-300`}>
          <div className={`flex-1 rounded-3xl border ${cardThemeClasses} p-5 flex flex-col overflow-hidden`}>
            {/* 1. Sleek Header: Dynamic View Title + ONE Low-Key Attendance Counter */}
            <div className="pb-3.5 border-b border-white/10 shrink-0 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-2xl sm:text-3xl font-bold lowercase tracking-tight leading-none text-white truncate">
                  {activeSidebarTab === 'arrivals' && 'live guest arrivals'}
                  {activeSidebarTab === 'poker' && 'poker table'}
                  {activeSidebarTab === 'stats' && 'party leaderboard'}
                  {activeSidebarTab === 'qrs' && 'guest qr station'}
                </h2>

                {/* The ONE Low-Key Attendance Counter */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-xs font-semibold text-white/90">
                    {stats.totalEntered}
                  </span>
                  <span className="font-sans-clean text-[11px] text-white/40 lowercase">
                    / {stats.totalCapacity} inside
                  </span>
                </div>
              </div>

              {/* Segmented View Switcher Ribbon (Replaces broken dropdown) */}
              <div className="flex items-center p-1 rounded-2xl bg-white/[0.04] border border-white/10 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab('arrivals')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-sans-clean font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeSidebarTab === 'arrivals'
                      ? 'bg-white text-black shadow-sm font-bold'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>arrivals</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSidebarTab('poker')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-sans-clean font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeSidebarTab === 'poker'
                      ? 'bg-white text-black shadow-sm font-bold'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>poker table</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSidebarTab('stats')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-sans-clean font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeSidebarTab === 'stats'
                      ? 'bg-white text-black shadow-sm font-bold'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>fun stats</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSidebarTab('qrs')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-sans-clean font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeSidebarTab === 'qrs'
                      ? 'bg-white text-black shadow-sm font-bold'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>qr hub</span>
                </button>
              </div>

              {/* Discrete New Arrival Banner if active tab is NOT arrivals */}
              {activeSidebarTab !== 'arrivals' && collapsedArrivalToast && (
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab('arrivals')}
                  className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-sans-clean flex items-center justify-between cursor-pointer hover:bg-white/15 transition-all animate-in fade-in slide-in-from-top-1"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">{collapsedArrivalToast}</span>
                  </span>
                  <span className="text-[11px] font-mono text-white/60 underline shrink-0 ml-2">
                    view feed ➔
                  </span>
                </button>
              )}
            </div>

            {/* TAB CONTENT */}
            {activeSidebarTab === 'arrivals' && (
              <>
                {/* Scrollable Guest Feed with Sleek Custom Scrollbar (No redundant spotlight card) */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1.5 my-1">
                  {enteredGuests.length === 0 ? (
                    <div className="h-44 flex flex-col items-center justify-center text-center p-4 space-y-2 opacity-50">
                      <DoorOpen className="w-7 h-7 opacity-40 text-white" />
                      <p className="font-sans-clean text-xs lowercase text-white/70">
                        Waiting for first guest admission...
                      </p>
                    </div>
                  ) : (
                    enteredGuests.map((guest, idx) => {
                      const tagNumber = parseTagId(guest.tag_id).tagNumber;
                      const tagDisplay = tagNumber ? `#${tagNumber.toString().padStart(3, '0')}` : guest.tag_id;
                      const isNewArrival = newArrivalHighlightId === guest.id;

                      return (
                        <div
                          key={guest.id}
                          className={`p-3 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 ${
                            isNewArrival
                              ? 'border-amber-300/60 bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.2)] ring-1 ring-amber-300/30'
                              : idx === 0
                              ? 'border-white/15 bg-white/[0.04]'
                              : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono text-xs font-bold text-white/60 w-12 text-left shrink-0">
                              {tagDisplay}
                            </span>
                            <div className="min-w-0">
                              <span className="font-display text-xl sm:text-2xl font-bold lowercase leading-tight text-white block truncate">
                                {guest.name || `Guest ${guest.tag_id}`}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono text-xs font-medium block text-white/80">
                              {formatWallClockTime(guest.entered_at)}
                            </span>
                            <span className="font-sans-clean text-[10px] text-white/40 lowercase">
                              {formatRelativeTime(guest.entered_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer with Low-Key Simulation */}
                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-white/50 shrink-0">
                  <span className="font-sans-clean text-[11px]">
                    Live Venue Stream
                  </span>
                  <button
                    type="button"
                    onClick={handleSimulateCheckIn}
                    className="hover:text-white underline decoration-white/30 text-[11px] font-sans-clean lowercase cursor-pointer"
                    title="Simulate instant guest admission"
                  >
                    + test check-in
                  </button>
                </div>
              </>
            )}

            {activeSidebarTab === 'poker' && (
              <div className="flex-1 min-h-0 pt-2 animate-in fade-in duration-200">
                <PokerWidget onExpandFeed={() => setActiveSidebarTab('arrivals')} />
              </div>
            )}

            {activeSidebarTab === 'stats' && (
              <div className="flex-1 min-h-0 pt-2 animate-in fade-in duration-200">
                <PartyFunStatsWidget guests={guests} />
              </div>
            )}

            {activeSidebarTab === 'qrs' && (
              <div className="flex-1 min-h-0 pt-2 animate-in fade-in duration-200">
                <PartyQrHubWidget />
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ================================================================ */}
      {/* 3. ADD VIDEO / PLAYLIST MODAL                                    */}
      {/* ================================================================ */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#141414] border border-white/20 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Music2 className="w-5 h-5 text-amber-400" />
                <h3 className="font-display text-2xl font-bold lowercase text-white">
                  add video or playlist
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={e => handleAddCustomTrack(e, false)} className="space-y-4">
              <div>
                <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                  YouTube Video or Playlist URL *
                </label>
                <input
                  type="text"
                  required
                  value={customInputUrl}
                  onChange={e => setCustomInputUrl(e.target.value)}
                  placeholder="https://www.youtube.com/playlist?list=... or watch?v=..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-sans-clean focus:outline-none focus:border-white"
                />
                <p className="text-[11px] text-white/50 mt-1">
                  Tip: Pasting a playlist URL loads all tracks directly into the &quot;Up Next&quot; queue!
                </p>
              </div>

              {!customInputUrl.includes('list=') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                      Song Title (optional)
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={e => setCustomTitle(e.target.value)}
                      placeholder="e.g. Bohemian Rhapsody"
                      className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-sans-clean focus:outline-none focus:border-white"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase font-bold text-white/60 block mb-1">
                      Artist (optional)
                    </label>
                    <input
                      type="text"
                      value={customArtist}
                      onChange={e => setCustomArtist(e.target.value)}
                      placeholder="e.g. Queen"
                      className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/20 text-white text-xs font-sans-clean focus:outline-none focus:border-white"
                    />
                  </div>
                </div>
              )}

              {addUrlError && (
                <p className="text-xs text-red-400 font-sans-clean">
                  {addUrlError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-sans-clean font-semibold text-white/70 hover:text-white"
                >
                  cancel
                </button>

                {customInputUrl.includes('list=') && (
                  <button
                    type="button"
                    disabled={isLoadingPlaylist}
                    onClick={e => handleAddCustomTrack(e, true)}
                    className="px-4 py-2 rounded-full text-xs font-sans-clean font-bold bg-amber-400 text-black hover:bg-amber-300 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    {isLoadingPlaylist ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Shuffle className="w-3.5 h-3.5" />
                    )}
                    <span>shuffle & play</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isLoadingPlaylist}
                  className="px-5 py-2 rounded-full text-xs font-sans-clean font-bold bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {isLoadingPlaylist ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>loading playlist...</span>
                    </>
                  ) : (
                    <span>{customInputUrl.includes('list=') ? 'load playlist queue' : 'add to queue'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
