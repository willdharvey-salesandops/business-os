import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

interface PlaceResult {
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  id?: string;
  types?: string[];
}

export const POST: APIRoute = async ({ request }) => {
  const { company_type, region } = await request.json();

  if (!company_type || !region) {
    return new Response(JSON.stringify({ error: 'company_type and region are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = getEnv('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Google Maps API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Google Maps Places API (New) - Text Search with pagination
    const searchQuery = `${company_type} in ${region}`;
    const allPlaces: PlaceResult[] = [];
    let pageToken: string | undefined;
    const MAX_PAGES = 3; // Up to 60 results (20 per page)

    for (let page = 0; page < MAX_PAGES; page++) {
      const requestBody: Record<string, any> = {
        textQuery: searchQuery,
        maxResultCount: 20,
        languageCode: 'en',
        regionCode: 'GB',
      };
      if (pageToken) requestBody.pageToken = pageToken;

      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.id,places.types,nextPageToken',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Google Maps API error:', response.status, errorBody);
        if (allPlaces.length === 0) {
          return new Response(JSON.stringify({ error: 'Google Maps API error', detail: errorBody }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        break; // Use whatever we got so far
      }

      const data = await response.json();
      const pagePlaces: PlaceResult[] = data.places || [];
      allPlaces.push(...pagePlaces);

      if (!data.nextPageToken) break; // No more pages
      pageToken = data.nextPageToken;
    }

    if (allPlaces.length === 0) {
      return new Response(JSON.stringify({ error: 'No businesses found for that search' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabase();

    // Deduplicate: check which place_ids already exist in any campaign
    const placeIds = allPlaces.map(p => p.id).filter(Boolean) as string[];
    const existingPlaceIds = new Set<string>();

    // Query in batches of 100 (Supabase .in() limit)
    for (let i = 0; i < placeIds.length; i += 100) {
      const batch = placeIds.slice(i, i + 100);
      const { data: existing } = await supabase
        .from('outreach_prospects')
        .select('place_id')
        .in('place_id', batch);
      if (existing) {
        existing.forEach((row: { place_id: string }) => existingPlaceIds.add(row.place_id));
      }
    }

    // Filter out non-UK results (regionCode is a bias, not a hard filter)
    const ukPlaces = allPlaces.filter(p => {
      const addr = (p.formattedAddress || '').toUpperCase();
      return addr.includes('UK') || addr.includes('UNITED KINGDOM') || addr.includes('ENGLAND') || addr.includes('SCOTLAND') || addr.includes('WALES') || addr.includes('NORTHERN IRELAND');
    });

    // Filter to only new businesses
    const newPlaces = ukPlaces.filter(p => !p.id || !existingPlaceIds.has(p.id));
    const skippedNonUK = allPlaces.length - ukPlaces.length;
    const skippedCount = ukPlaces.length - newPlaces.length;

    if (newPlaces.length === 0) {
      const reason = ukPlaces.length === 0
        ? `Found ${allPlaces.length} results but none were UK businesses. Try a more specific UK region.`
        : `All ${ukPlaces.length} UK businesses found have already been processed in previous campaigns. Try a different region or company type.`;
      return new Response(JSON.stringify({
        error: reason,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('outreach_campaigns')
      .insert({ company_type, region, prospect_count: newPlaces.length })
      .select('id')
      .single();

    if (campaignError) {
      console.error('Supabase campaign error:', campaignError);
      return new Response(JSON.stringify({ error: 'Failed to create campaign', detail: campaignError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Insert only new prospects
    const prospects = newPlaces.map((place) => ({
      campaign_id: campaign.id,
      company_name: place.displayName?.text || 'Unknown',
      address: place.formattedAddress || '',
      phone: place.nationalPhoneNumber || '',
      website: place.websiteUri || '',
      google_rating: place.rating || null,
      place_id: place.id || '',
      pipeline_status: 'discovered',
    }));

    const { error: prospectError } = await supabase
      .from('outreach_prospects')
      .insert(prospects);

    if (prospectError) {
      console.error('Supabase prospect error:', prospectError);
      return new Response(JSON.stringify({ error: 'Failed to save prospects', detail: prospectError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      campaign_id: campaign.id,
      company_type,
      region,
      prospect_count: newPlaces.length,
      skipped_duplicates: skippedCount,
      skipped_non_uk: skippedNonUK,
      prospects: prospects.map(p => ({
        company_name: p.company_name,
        website: p.website,
        google_rating: p.google_rating,
      })),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Discover error:', err);
    return new Response(JSON.stringify({ error: 'Discovery failed', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
