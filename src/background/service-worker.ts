// Background Service Worker for Reels Master
console.log('Reels Master: Background service worker loaded');

const ENCODING_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function shortcodeToPk(shortcode: string): bigint {
  if (shortcode.length > 28) {
    shortcode = shortcode.slice(0, -28);
  }
  let pk = BigInt(0);
  for (const char of shortcode) {
    pk = pk * BigInt(64) + BigInt(ENCODING_CHARS.indexOf(char));
  }
  return pk;
}

function extractShortcode(url: string): string | null {
  const match = url.match(/\/(?:p|tv|reels?(?!\/audio\/))\/([^/?#&]+)/);
  return match ? match[1] : null;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Reels Master: Extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOWNLOAD_REEL') {
    handleDownload(message.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function handleDownload(reelUrl: string): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  try {
    console.log('Reels Master: Processing download for', reelUrl);

    const shortcode = extractShortcode(reelUrl);
    if (!shortcode) {
      return { success: false, error: 'Could not extract shortcode from URL' };
    }

    const pk = shortcodeToPk(shortcode);
    console.log('Reels Master: Shortcode:', shortcode, 'PK:', pk.toString());

    const apiHeaders = {
      'X-IG-App-ID': '936619743392459',
      'X-ASBD-ID': '198387',
      'X-IG-WWW-Claim': '0',
      'Origin': 'https://www.instagram.com',
      'Accept': '*/*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const apiUrl = `https://i.instagram.com/api/v1/media/${pk}/info/`;
    console.log('Reels Master: Fetching from API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: apiHeaders,
      credentials: 'include',
    });

    if (!response.ok) {
      console.log('Reels Master: API response not ok:', response.status);
      return await tryGraphQLFallback(shortcode, apiHeaders);
    }

    const data = await response.json();
    console.log('Reels Master: API response received');

    const videoUrl = extractVideoUrl(data);
    
    if (!videoUrl) {
      console.log('Reels Master: No video URL in API response, trying fallback');
      return await tryGraphQLFallback(shortcode, apiHeaders);
    }

    console.log('Reels Master: Found video URL, starting download');

    await chrome.downloads.download({
      url: videoUrl,
      filename: `reel_${shortcode}_${Date.now()}.mp4`,
    });

    return { success: true, downloadUrl: videoUrl };

  } catch (error) {
    console.error('Reels Master: Download error', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function tryGraphQLFallback(shortcode: string, headers: Record<string, string>): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  try {
    console.log('Reels Master: Trying GraphQL fallback');

    const variables = {
      shortcode: shortcode,
      child_comment_count: 3,
      fetch_comment_count: 40,
      parent_comment_count: 24,
      has_threaded_comments: true,
    };

    const graphqlUrl = `https://www.instagram.com/graphql/query/?doc_id=8845758582119845&variables=${encodeURIComponent(JSON.stringify(variables))}`;
    
    const response = await fetch(graphqlUrl, {
      method: 'GET',
      headers: {
        ...headers,
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `https://www.instagram.com/reel/${shortcode}/`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return { success: false, error: `GraphQL request failed: ${response.status}` };
    }

    const data = await response.json();
    const media = data?.data?.xdt_shortcode_media;
    
    if (!media) {
      return { success: false, error: 'No media data in GraphQL response. Try logging in to Instagram.' };
    }

    const videoUrl = media.video_url;
    if (!videoUrl) {
      return { success: false, error: 'No video URL found in response' };
    }

    await chrome.downloads.download({
      url: videoUrl,
      filename: `reel_${shortcode}_${Date.now()}.mp4`,
    });

    return { success: true, downloadUrl: videoUrl };

  } catch (error) {
    console.error('Reels Master: GraphQL fallback error', error);
    return { success: false, error: error instanceof Error ? error.message : 'GraphQL fallback failed' };
  }
}

function extractVideoUrl(data: any): string | null {
  const items = data?.items;
  if (!items || !items.length) return null;

  const item = items[0];

  if (item.video_url) {
    return item.video_url;
  }

  const videoVersions = item.video_versions;
  if (videoVersions && videoVersions.length > 0) {
    return videoVersions[0].url;
  }

  const carouselMedia = item.carousel_media;
  if (carouselMedia && carouselMedia.length > 0) {
    for (const media of carouselMedia) {
      if (media.video_versions && media.video_versions.length > 0) {
        return media.video_versions[0].url;
      }
    }
  }

  return null;
}
