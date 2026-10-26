import { NextRequest, NextResponse } from 'next/server';

export interface ExtractedPlaylistItem {
  id: string;
  title: string;
  artist: string;
  videoId: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const playlistId = searchParams.get('list') || searchParams.get('playlistId');

  if (!playlistId || !/^[a-zA-Z0-9_-]+$/.test(playlistId)) {
    return NextResponse.json({ success: false, error: 'Invalid playlist ID' }, { status: 400 });
  }

  try {
    const ytUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
    const res = await fetch(ytUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 300 }, // Cache 5 min
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch playlist from YouTube' }, { status: 502 });
    }

    const html = await res.text();

    // Extract playlist title
    let playlistTitle = 'YouTube Playlist';
    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/) || html.match(/<title>(.+?) - YouTube<\/title>/);
    if (titleMatch && titleMatch[1] && titleMatch[1] !== 'undefined') {
      playlistTitle = titleMatch[1];
    }

    const items: ExtractedPlaylistItem[] = [];
    const seen = new Set<string>();

    // Pattern 1: Modern YouTube lockup / accessibilityContext
    const regex1 = /"contentId":"([a-zA-Z0-9_-]{11})"[\s\S]{1,600}?"accessibilityContext":\{"label":"([^"]+)"\}/g;
    for (const match of html.matchAll(regex1)) {
      const videoId = match[1];
      let rawLabel = match[2];
      try {
        rawLabel = JSON.parse(`"${rawLabel}"`);
      } catch {}

      if (!seen.has(videoId)) {
        seen.add(videoId);
        const cleanLabel = rawLabel.replace(/\s+\d+\s+(?:minutes?|hours?|seconds?).*$/i, '').trim();

        // Split artist and title if "Artist - Title" format
        let artist = 'Music Video';
        let title = cleanLabel;
        if (cleanLabel.includes(' - ')) {
          const parts = cleanLabel.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        } else if (cleanLabel.includes(' – ')) {
          const parts = cleanLabel.split(' – ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' – ').trim();
        }

        items.push({
          id: `pl-${playlistId}-${videoId}-${items.length}`,
          videoId,
          title,
          artist,
        });
      }
    }

    // Pattern 2 fallback: standard videoId list
    if (items.length === 0) {
      const vidRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
      for (const m of html.matchAll(vidRegex)) {
        const videoId = m[1];
        if (!seen.has(videoId) && items.length < 50) {
          seen.add(videoId);
          items.push({
            id: `pl-${playlistId}-${videoId}-${items.length}`,
            videoId,
            title: `Track ${items.length + 1}`,
            artist: playlistTitle,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      playlistId,
      playlistTitle,
      count: items.length,
      items,
    });
  } catch (err: any) {
    console.error('Error in playlist parser route:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Server error parsing playlist' }, { status: 500 });
  }
}
