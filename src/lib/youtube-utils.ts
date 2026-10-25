/**
 * YouTube Embed & URL Parsing Utilities
 * Supports standard watch URLs, share links, embed links, playlists, and raw IDs.
 */

export interface YouTubePreset {
  id: string;
  label: string;
  artist: string;
  description: string;
  videoId?: string;
  playlistId?: string;
}

export const PROJECTOR_PRESETS: YouTubePreset[] = [
  {
    id: 'thriller',
    label: 'Michael Jackson – Thriller',
    artist: 'Michael Jackson',
    description: 'Official Music Video',
    videoId: 'sOnqjkJTMaA',
  },
  {
    id: 'blinding-lights',
    label: 'The Weeknd – Blinding Lights',
    artist: 'The Weeknd',
    description: 'Official Music Video',
    videoId: '4NRXx6U8ABQ',
  },
  {
    id: 'daft-punk',
    label: 'Daft Punk – Around The World',
    artist: 'Daft Punk',
    description: 'Official Music Video',
    videoId: 'K0HSD_i2DvA',
  },
  {
    id: 'ghostbusters',
    label: 'Ray Parker Jr. – Ghostbusters',
    artist: 'Ray Parker Jr.',
    description: 'Official Music Video',
    videoId: 'm9We2XsVZfc',
  },
  {
    id: 'dua-lipa',
    label: 'Dua Lipa – Levitating',
    artist: 'Dua Lipa',
    description: 'Official Music Video',
    videoId: 'TUVcZfQe-Kw',
  },
  {
    id: 'gorillaz',
    label: 'Gorillaz – Feel Good Inc.',
    artist: 'Gorillaz',
    description: 'Official Music Video',
    videoId: 'HyHNuVaZJ-k',
  },
];

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
  return `https://www.youtube.com/embed/sOnqjkJTMaA?autoplay=1&loop=1&playlist=sOnqjkJTMaA&controls=1`;
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
    const defaultPreset = PROJECTOR_PRESETS[0];
    const embedUrl = buildEmbedUrl({ videoId: defaultPreset.videoId, autoplay, muted });
    return {
      videoId: defaultPreset.videoId || null,
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
  const finalVideoId = videoId || (playlistId ? null : PROJECTOR_PRESETS[0].videoId || null);
  const embedUrl = buildEmbedUrl({ videoId: finalVideoId, playlistId, autoplay, muted });

  return {
    videoId,
    playlistId,
    embedUrl,
    isValid,
    cleanInput,
  };
}
