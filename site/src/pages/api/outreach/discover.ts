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
    // Google Maps Places API (New) - Text Search
    const searchQuery = `${company_type} in ${region}`;
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.id,places.types',
      },
      body: JSON.stringify({
        textQuery: searchQuery,
        maxResultCount: 20,
        languageCode: 'en',
        regionCode: 'GB',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google Maps API error:', response.status, errorBody);
      return new Response(JSON.stringify({ error: 'Google Maps API error', detail: errorBody }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const places: PlaceResult[] = data.places || [];

    if (places.length === 0) {
      return new Response(JSON.stringify({ error: 'No businesses found for that search' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create campaign
    const supabase = getSupabase();
    const { data: campaign, error: campaignError } = await supabase
      .from('outreach_campaigns')
      .insert({ company_type, region, prospect_count: places.length })
      .select('id')
      .single();

    if (campaignError) {
      console.error('Supabase campaign error:', campaignError);
      return new Response(JSON.stringify({ error: 'Failed to create campaign', detail: campaignError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Insert prospects
    const prospects = places.map((place) => ({
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
      prospect_count: places.length,
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
