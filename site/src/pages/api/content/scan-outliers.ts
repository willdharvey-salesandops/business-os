import type { APIRoute } from 'astro';
import { google } from 'googleapis';
import { WATCHLIST_CHANNELS } from '../../../lib/business-context';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

interface VideoData {
  video_id: string;
  title: string;
  published_at: string;
  description: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  duration: string;
  outlier_score: number;
  channel_name: string;
  channel_id: string;
  median_views: number;
  thumbnail_url: string;
  url: string;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = getEnv('YOUTUBE_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'YouTube API key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let months = 6;
  let topPerChannel = 5;
  let multiplier = 3.0;

  try {
    const body = await request.json().catch(() => ({}));
    if (body.months) months = body.months;
    if (body.top_per_channel) topPerChannel = body.top_per_channel;
    if (body.multiplier) multiplier = body.multiplier;
  } catch {}

  const youtube = google.youtube({ version: 'v3', auth: apiKey });
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - months * 30);
  const cutoffISO = cutoff.toISOString();

  const allOutliers: VideoData[] = [];
  const warnings: string[] = [];

  for (const channel of WATCHLIST_CHANNELS) {
    try {
      // Get channel info and uploads playlist
      const channelRes = await youtube.channels.list({
        part: ['statistics', 'contentDetails', 'snippet'],
        id: [channel.channel_id],
      });
      const channelItem = channelRes.data.items?.[0];
      if (!channelItem) {
        warnings.push(`Channel not found: ${channel.name}`);
        continue;
      }

      const uploadsPlaylist = channelItem.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylist) {
        warnings.push(`No uploads playlist for: ${channel.name}`);
        continue;
      }

      const channelName = channelItem.snippet?.title || channel.name;

      // Get recent videos from uploads playlist
      const videos: { video_id: string; title: string; published_at: string; description: string }[] = [];
      let nextPageToken: string | undefined;

      while (true) {
        const playlistRes = await youtube.playlistItems.list({
          part: ['snippet'],
          playlistId: uploadsPlaylist,
          maxResults: 50,
          pageToken: nextPageToken,
        });

        for (const item of playlistRes.data.items || []) {
          const publishedAt = item.snippet?.publishedAt || '';
          if (publishedAt && new Date(publishedAt) < cutoff) {
            nextPageToken = undefined;
            break;
          }
          videos.push({
            video_id: item.snippet?.resourceId?.videoId || '',
            title: item.snippet?.title || '',
            published_at: publishedAt,
            description: (item.snippet?.description || '').substring(0, 200),
          });
        }

        nextPageToken = playlistRes.data.nextPageToken || undefined;
        if (!nextPageToken) break;
      }

      if (videos.length < 3) continue;

      // Get stats for all videos in batches of 50
      const videoStats: Record<string, { view_count: number; like_count: number; comment_count: number; duration: string }> = {};
      for (let i = 0; i < videos.length; i += 50) {
        const batch = videos.slice(i, i + 50).map(v => v.video_id);
        const statsRes = await youtube.videos.list({
          part: ['statistics', 'contentDetails'],
          id: batch,
        });
        for (const item of statsRes.data.items || []) {
          videoStats[item.id!] = {
            view_count: parseInt(item.statistics?.viewCount || '0', 10),
            like_count: parseInt(item.statistics?.likeCount || '0', 10),
            comment_count: parseInt(item.statistics?.commentCount || '0', 10),
            duration: item.contentDetails?.duration || '',
          };
        }
      }

      // Calculate median and find outliers
      const viewCounts = videos
        .map(v => videoStats[v.video_id]?.view_count || 0)
        .filter(c => c > 0);

      if (viewCounts.length < 3) continue;

      const medianViews = median(viewCounts);
      if (medianViews === 0) continue;

      const channelOutliers: VideoData[] = [];
      for (const video of videos) {
        const stats = videoStats[video.video_id];
        if (!stats || stats.view_count === 0) continue;

        const score = stats.view_count / medianViews;
        if (score >= multiplier) {
          channelOutliers.push({
            video_id: video.video_id,
            title: video.title,
            published_at: video.published_at,
            description: video.description,
            view_count: stats.view_count,
            like_count: stats.like_count,
            comment_count: stats.comment_count,
            duration: stats.duration,
            outlier_score: Math.round(score * 100) / 100,
            channel_name: channelName,
            channel_id: channel.channel_id,
            median_views: Math.round(medianViews),
            thumbnail_url: `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`,
            url: `https://youtube.com/watch?v=${video.video_id}`,
          });
        }
      }

      // Sort and cap per channel
      channelOutliers.sort((a, b) => b.outlier_score - a.outlier_score);
      allOutliers.push(...channelOutliers.slice(0, topPerChannel));

    } catch (err: any) {
      warnings.push(`Error scanning ${channel.name}: ${err?.message || 'Unknown error'}`);
    }
  }

  // Sort all outliers by score descending
  allOutliers.sort((a, b) => b.outlier_score - a.outlier_score);

  return new Response(JSON.stringify({
    channels_scanned: WATCHLIST_CHANNELS.length,
    total_outliers_found: allOutliers.length,
    scan_date: new Date().toISOString(),
    warnings: warnings.length > 0 ? warnings : undefined,
    outliers: allOutliers,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
