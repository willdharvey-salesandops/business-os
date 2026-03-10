function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

const BUFFER_GRAPHQL_URL = 'https://api.buffer.com';

interface BufferPostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

/**
 * Execute a Buffer GraphQL query/mutation
 */
async function bufferGraphQL(query: string, variables?: Record<string, unknown>): Promise<any> {
  const token = getEnv('BUFFER_ACCESS_TOKEN');
  if (!token) throw new Error('Missing BUFFER_ACCESS_TOKEN');

  const res = await fetch(BUFFER_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Buffer API error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * List all connected channels (profiles) in Buffer
 */
export async function listChannels(): Promise<any[]> {
  // First get the org ID
  const acctResult = await bufferGraphQL(`
    query { account { organizations { id name } } }
  `);
  const orgs = acctResult.data?.account?.organizations || [];
  if (orgs.length === 0) return [];

  const orgId = orgs[0].id;
  const result = await bufferGraphQL(`
    query($input: ChannelsInput!) {
      channels(input: $input) { id name service type }
    }
  `, { input: { organizationId: orgId } });

  return result.data?.channels || [];
}

/**
 * Schedule a video post to a specific Buffer channel
 */
export async function scheduleVideoPost(
  channelId: string,
  caption: string,
  videoUrl: string,
  scheduledAt: string, // ISO 8601
  platform: 'youtube' | 'instagram' | 'tiktok',
  hookText?: string,
): Promise<BufferPostResult> {
  const input: any = {
    channelId,
    text: caption,
    schedulingType: 'automatic',
    mode: 'customScheduled',
    dueAt: scheduledAt,
    assets: {
      videos: [{ url: videoUrl }],
    },
  };

  // Platform-specific metadata
  if (platform === 'youtube') {
    input.metadata = {
      youtube: {
        title: hookText || caption.slice(0, 100),
        categoryId: '22', // People & Blogs
      },
    };
  } else if (platform === 'instagram') {
    input.metadata = {
      instagram: {
        type: 'reel',
      },
    };
  }

  const result = await bufferGraphQL(`
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id status }
        }
        ... on NotFoundError { message }
        ... on UnauthorizedError { message }
        ... on UnexpectedError { message }
        ... on InvalidInputError { message }
        ... on LimitReachedError { message }
      }
    }
  `, { input });

  const createPost = result.data?.createPost;
  if (createPost?.post) {
    return { success: true, postId: createPost.post.id };
  }

  const errorMsg = createPost?.message || JSON.stringify(result.errors || result.data) || 'Unknown Buffer error';
  return { success: false, error: errorMsg };
}

/**
 * Schedule a short to all 3 platforms (YouTube Shorts, Instagram Reels, TikTok)
 * Returns array of results per platform
 */
export async function scheduleShortToAllPlatforms(
  captions: { youtube: string; instagram: string; tiktok: string },
  videoUrl: string,
  scheduledAt: string,
  hookText?: string,
): Promise<{ platform: string; result: BufferPostResult }[]> {
  const ytChannelId = getEnv('BUFFER_YOUTUBE_CHANNEL_ID');
  const igChannelId = getEnv('BUFFER_INSTAGRAM_CHANNEL_ID');
  const tkChannelId = getEnv('BUFFER_TIKTOK_CHANNEL_ID');

  const results: { platform: string; result: BufferPostResult }[] = [];

  if (ytChannelId) {
    const r = await scheduleVideoPost(ytChannelId, captions.youtube, videoUrl, scheduledAt, 'youtube', hookText);
    results.push({ platform: 'youtube_shorts', result: r });
  }

  if (igChannelId) {
    const r = await scheduleVideoPost(igChannelId, captions.instagram, videoUrl, scheduledAt, 'instagram');
    results.push({ platform: 'instagram_reels', result: r });
  }

  if (tkChannelId) {
    const r = await scheduleVideoPost(tkChannelId, captions.tiktok, videoUrl, scheduledAt, 'tiktok');
    results.push({ platform: 'tiktok', result: r });
  }

  return results;
}
