import { describe, it, expect } from 'vitest';
import { GET } from '../app/api/youtube/playlist/route';
import { NextRequest } from 'next/server';

describe('YouTube Playlist API Route', () => {
  it('rejects missing or invalid playlist ID', async () => {
    const req = new NextRequest('http://localhost:3000/api/youtube/playlist');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('parses a real public playlist and returns array of tracks', async () => {
    const req = new NextRequest('http://localhost:3000/api/youtube/playlist?list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBeGreaterThan(10);
    expect(json.items[0]).toHaveProperty('videoId');
    expect(json.items[0]).toHaveProperty('title');
    expect(json.items[0]).toHaveProperty('artist');
  }, 15000);
});
