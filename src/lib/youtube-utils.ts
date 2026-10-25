/**
 * YouTube Embed & URL Parsing Utilities
 * Supports standard watch URLs, share links, embed links, playlists, and raw IDs.
 */

export interface QueueItem {
  id: string;
  title: string;
  artist: string;
  videoId: string;
  playlistId?: string;
}

export type YouTubePreset = QueueItem;

export const DEFAULT_PARTY_QUEUE: QueueItem[] = [
  {
    id: 'track-1',
    title: 'Thriller',
    artist: 'Michael Jackson',
    videoId: 'sOnqjkJTMaA',
  },
  {
    id: 'track-2',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    videoId: '4NRXx6U8ABQ',
  },
  {
    id: 'track-3',
    title: 'Around The World',
    artist: 'Daft Punk',
    videoId: 'K0HSD_i2DvA',
  },
  {
    id: 'track-4',
    title: 'Ghostbusters',
    artist: 'Ray Parker Jr.',
    videoId: 'm9We2XsVZfc',
  },
  {
    id: 'track-5',
    title: 'Levitating',
    artist: 'Dua Lipa',
    videoId: 'TUVcZfQe-Kw',
  },
  {
    id: 'track-6',
    title: 'Feel Good Inc.',
    artist: 'Gorillaz',
    videoId: 'HyHNuVaZJ-k',
  },
  {
    id: 'track-7',
    title: "Somebody's Watching Me",
    artist: 'Rockwell',
    videoId: '7YvAYIJSSZY',
  },
  {
    id: 'track-8',
    title: "Don't Stop 'Til You Get Enough",
    artist: 'Michael Jackson',
    videoId: 'yURRmWtbTbo',
  },
  {
    id: 'track-9',
    title: 'Heads Will Roll (A-Trak Remix)',
    artist: 'Yeah Yeah Yeahs',
    videoId: 'umAL-6-j1Ew',
  },
  {
    id: 'track-10',
    title: 'One More Time',
    artist: 'Daft Punk',
    videoId: 'FGBhQbmMxH8',
  },
];

export const PROJECTOR_PRESETS = DEFAULT_PARTY_QUEUE;

export interface YouTubeParseResult {
  videoId: string | null;
  playlistId: string | null;
  embedUrl: string;
  isValid: boolean;
  cleanInput: string;
}

/**
 * Builds YouTube iframe embed URL with appropriate loop and autoplay parameters.
 */
export function buildEmbedUrl({
  videoId,
  playlistId,
  autoplay = true,
  muted = false,
}: {
  videoId?: string | null;
  playlistId?: string | null;
  autoplay?: boolean;
  muted?: boolean;
}): string {
  const params = new URLSearchParams();

  if (autoplay) params.set('autoplay', '1');
  if (muted) params.set('mute', '1');
  params.set('controls', '1');
  params.set('rel', '0');
  params.set('modestbranding', '1');
  params.set('enablejsapi', '1');
  params.set('playsinline', '1');

  if (playlistId) {
    params.set('listType', 'playlist');
    params.set('list', playlistId);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
    }
    return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
  }

  if (videoId) {
    params.set('loop', '1');
    params.set('playlist', videoId);
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }

  // Fallback to Thriller
  return `https://www.youtube.com/embed/sOnqjkJTMaA?autoplay=1&loop=1&playlist=sOnqjkJTMaA&controls=1&enablejsapi=1`;
}

/**
 * Parses any YouTube link or ID and returns a safe embed URL.
 * Automatically enables autoplay, looping, and full video player controls.
 */
export function parseYouTubeInput(
  input: string,
  options: { autoplay?: boolean; muted?: boolean } = {}
): YouTubeParseResult {
  const { autoplay = true, muted = false } = options;
  const cleanInput = (input || '').trim();

  if (!cleanInput) {
    const defaultTrack = DEFAULT_PARTY_QUEUE[0];
    const embedUrl = buildEmbedUrl({ videoId: defaultTrack.videoId, autoplay, muted });
    return {
      videoId: defaultTrack.videoId || null,
      playlistId: null,
      embedUrl,
      isValid: false,
      cleanInput: '',
    };
  }

  let videoId: string | null = null;
  let playlistId: string | null = null;

  // 1. Check if raw video ID (11 alphanumeric / dash / underscore chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanInput)) {
    videoId = cleanInput;
  }
  // 2. Check if raw playlist ID (starts with PL, RD, OLAK, etc.)
  else if (/^(PL|RD|OLAK)[a-zA-Z0-9_-]+$/i.test(cleanInput)) {
    playlistId = cleanInput;
  }
  // 3. Parse URLs
  else {
    try {
      const urlToParse = cleanInput.startsWith('http') ? cleanInput : `https://${cleanInput}`;
      const url = new URL(urlToParse);
      const host = url.hostname.replace('www.', '');

      if (host.includes('youtube.com') || host.includes('youtu.be')) {
        // youtu.be/VIDEO_ID
        if (host === 'youtu.be') {
          videoId = url.pathname.slice(1).split('/')[0] || null;
          playlistId = url.searchParams.get('list');
        }
        // youtube.com/shorts/VIDEO_ID
        else if (url.pathname.startsWith('/shorts/')) {
          videoId = url.pathname.replace('/shorts/', '').split('/')[0] || null;
        }
        // youtube.com/embed/VIDEO_ID
        else if (url.pathname.startsWith('/embed/')) {
          videoId = url.pathname.replace('/embed/', '').split('/')[0] || null;
          playlistId = url.searchParams.get('list');
        }
        // youtube.com/watch?v=VIDEO_ID
        else if (url.pathname.startsWith('/watch')) {
          videoId = url.searchParams.get('v');
          playlistId = url.searchParams.get('list');
        }
        // youtube.com/playlist?list=PLAYLIST_ID
        else if (url.pathname.startsWith('/playlist')) {
          playlistId = url.searchParams.get('list');
        }
      }
    } catch {
      const vMatch = cleanInput.match(/(?:v=|\/embed\/|\/watch\?v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (vMatch) videoId = vMatch[1];

      const pMatch = cleanInput.match(/list=([a-zA-Z0-9_-]+)/);
      if (pMatch) playlistId = pMatch[1];
    }
  }

  const isValid = Boolean(videoId || playlistId);
  const finalVideoId = videoId || (playlistId ? null : DEFAULT_PARTY_QUEUE[0].videoId || null);
  const embedUrl = buildEmbedUrl({ videoId: finalVideoId, playlistId, autoplay, muted });

  return {
    videoId,
    playlistId,
    embedUrl,
    isValid,
    cleanInput,
  };
}
