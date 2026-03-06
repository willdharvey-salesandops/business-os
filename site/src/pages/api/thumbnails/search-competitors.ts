import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

export const prerender = false;

function getYouTubeApiKey(): string {
  return import.meta.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY || '';
}

function getAnthropicApiKey(): string {
  return import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
}

interface VideoResult {
  video_id: string;
  title: string;
  channel: string;
  thumbnail_url: string;
  view_count: number;
  published_at: string;
  swap_suitability?: {
    score: number;
    reason: string;
  };
}

export const POST: APIRoute = async ({ request }) => {
  const ytKey = getYouTubeApiKey();
  if (!ytKey) {
    return new Response(JSON.stringify({ error: 'YOUTUBE_API_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { keywords, max_results = 20 } = await request.json();

  if (!keywords || (Array.isArray(keywords) && keywords.length === 0)) {
    return new Response(JSON.stringify({ error: 'keywords is required (string or array of strings)' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const searchTerms = Array.isArray(keywords) ? keywords : [keywords];

  try {
    // Search YouTube for each keyword
    const allVideoIds: string[] = [];
    const videoMap: Map<string, any> = new Map();

    for (const term of searchTerms) {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      searchUrl.searchParams.set('part', 'snippet');
      searchUrl.searchParams.set('q', term);
      searchUrl.searchParams.set('type', 'video');
      searchUrl.searchParams.set('order', 'viewCount');
      searchUrl.searchParams.set('maxResults', String(Math.min(max_results, 25)));
      searchUrl.searchParams.set('key', ytKey);

      const searchRes = await fetch(searchUrl.toString());
      if (!searchRes.ok) continue;

      const searchData = await searchRes.json();
      for (const item of searchData.items || []) {
        const vid = item.id?.videoId;
        if (vid && !videoMap.has(vid)) {
          allVideoIds.push(vid);
          videoMap.set(vid, {
            video_id: vid,
            title: item.snippet?.title || '',
            channel: item.snippet?.channelTitle || '',
            thumbnail_url: item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.medium?.url ||
              `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
            published_at: item.snippet?.publishedAt || '',
          });
        }
      }
    }

    // Get view counts for all videos
    if (allVideoIds.length > 0) {
      // Batch in groups of 50 (YouTube API limit)
      for (let i = 0; i < allVideoIds.length; i += 50) {
        const batch = allVideoIds.slice(i, i + 50);
        const statsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
        statsUrl.searchParams.set('part', 'statistics');
        statsUrl.searchParams.set('id', batch.join(','));
        statsUrl.searchParams.set('key', ytKey);

        const statsRes = await fetch(statsUrl.toString());
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          for (const item of statsData.items || []) {
            const existing = videoMap.get(item.id);
            if (existing) {
              existing.view_count = parseInt(item.statistics?.viewCount || '0', 10);
            }
          }
        }
      }
    }

    // Sort by view count descending
    let videos: VideoResult[] = Array.from(videoMap.values())
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0));

    // Use Claude to analyze thumbnail suitability for face swapping
    const anthropicKey = getAnthropicApiKey();
    if (anthropicKey && videos.length > 0) {
      const topVideos = videos.slice(0, 12); // Analyze top 12 only
      const anthropic = new Anthropic({ apiKey: anthropicKey });

      // Fetch thumbnails as base64 for Claude vision
      const thumbnailData: { video_id: string; base64: string }[] = [];
      for (const v of topVideos) {
        try {
          const res = await fetch(v.thumbnail_url);
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            thumbnailData.push({ video_id: v.video_id, base64 });
          }
        } catch {}
      }

      if (thumbnailData.length > 0) {
        try {
          const content: any[] = [
            {
              type: 'text',
              text: `Analyze these YouTube thumbnails for face/body swap suitability. For each, rate 1-10 how suitable it is for replacing the person with someone else (body swap). Consider: is there a clear person visible, good pose, not too complex background overlap with the person, etc.

Return valid JSON only (no markdown fences):
{
  "analyses": [
    { "video_id": "...", "score": 8, "reason": "Clear single person, good pose, clean separation from background" }
  ]
}`,
            },
          ];

          for (const td of thumbnailData) {
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: td.base64 },
            });
            content.push({
              type: 'text',
              text: `Video ID: ${td.video_id}`,
            });
          }

          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2000,
            messages: [{ role: 'user', content }],
          });

          const rawText = (message.content[0] as any)?.text || '';
          const cleaned = rawText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
          const parsed = JSON.parse(cleaned);

          if (parsed.analyses) {
            for (const analysis of parsed.analyses) {
              const video = videos.find(v => v.video_id === analysis.video_id);
              if (video) {
                video.swap_suitability = {
                  score: analysis.score,
                  reason: analysis.reason,
                };
              }
            }
          }
        } catch (aiErr) {
          console.error('Claude thumbnail analysis failed:', aiErr);
          // Continue without AI analysis
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      videos,
      total: videos.length,
      keywords: searchTerms,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Competitor search error:', err);
    return new Response(JSON.stringify({
      error: 'Competitor thumbnail search failed',
      detail: err?.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
