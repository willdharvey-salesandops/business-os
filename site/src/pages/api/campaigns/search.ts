import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

interface ProspeoSearchResult {
  personId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string;
  seniority: string;
  companyName: string;
  companyDomain: string;
  linkedinUrl: string;
  location: string;
  industry: string;
  companySize: string;
}

export const POST: APIRoute = async ({ request }) => {
  const {
    name,
    seniority,
    job_titles,
    industries,
    headcount_ranges,
    locations,
    limit = 500,
  } = await request.json();

  const prospeoKey = getEnv('PROSPEO_API_KEY');
  if (!prospeoKey) {
    return new Response(JSON.stringify({ error: 'Prospeo API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();

  // Build Prospeo filters
  const filters: Record<string, any> = {};

  if (seniority?.length) {
    filters.person_seniority = { include: seniority };
  }
  if (job_titles?.length) {
    filters.person_job_title = { include: job_titles };
  }
  if (industries?.length) {
    filters.company_industry = { include: industries };
  }
  if (headcount_ranges?.length) {
    filters.company_headcount_range = { include: headcount_ranges };
  }
  if (locations?.length) {
    filters.person_location = { include: locations };
  }

  if (Object.keys(filters).length === 0) {
    return new Response(JSON.stringify({ error: 'At least one filter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create batch record
  const { data: batch, error: batchError } = await supabase
    .from('campaign_batches')
    .insert({
      name: name || `Search ${new Date().toISOString().slice(0, 10)}`,
      search_criteria: { seniority, job_titles, industries, headcount_ranges, locations, limit },
    })
    .select()
    .single();

  if (batchError || !batch) {
    return new Response(JSON.stringify({ error: 'Failed to create batch', detail: batchError?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const maxPages = Math.min(Math.ceil(limit / 25), 40); // 25 per page, max 1000 results
  const allResults: ProspeoSearchResult[] = [];
  const seenPersonIds = new Set<string>();
  let totalAvailable = 0;

  try {
    for (let page = 1; page <= maxPages; page++) {
      const res = await fetch('https://api.prospeo.io/search-person', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KEY': prospeoKey,
        },
        body: JSON.stringify({ page, filters }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Prospeo search page ${page} error:`, res.status, errText);
        if (page === 1) {
          return new Response(JSON.stringify({
            error: 'Prospeo search failed',
            detail: errText,
            batch_id: batch.id,
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        break;
      }

      const data = await res.json();
      if (data.error) {
        console.error(`Prospeo search page ${page} API error:`, data.error);
        if (page === 1) {
          return new Response(JSON.stringify({
            error: 'Prospeo search returned error',
            detail: data.error,
            batch_id: batch.id,
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        break;
      }

      if (page === 1) {
        totalAvailable = data.pagination?.total_count || 0;
      }

      const results = data.results || [];
      if (results.length === 0) break;

      for (const r of results) {
        const personId = r.person?.person_id || '';
        if (!personId || seenPersonIds.has(personId)) continue;
        seenPersonIds.add(personId);

        allResults.push({
          personId,
          firstName: r.person?.first_name || '',
          lastName: r.person?.last_name || '',
          fullName: r.person?.full_name || `${r.person?.first_name || ''} ${r.person?.last_name || ''}`.trim(),
          title: r.person?.current_job_title || '',
          seniority: r.person?.job_history?.[0]?.seniority || '',
          companyName: r.company?.name || r.person?.job_history?.[0]?.company_name || '',
          companyDomain: r.company?.domain || '',
          linkedinUrl: r.person?.linkedin_url || '',
          location: r.person?.location || r.company?.location || '',
          industry: r.company?.industry || '',
          companySize: r.company?.headcount_range || '',
        });

        if (allResults.length >= limit) break;
      }

      if (allResults.length >= limit) break;

      // Small delay between pages to respect rate limits
      if (page < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Check for existing prospects across all batches (dedup by person_id)
    const personIds = allResults.map(r => r.personId);
    const { data: existing } = await supabase
      .from('campaign_prospects')
      .select('prospeo_person_id')
      .in('prospeo_person_id', personIds);

    const existingIds = new Set((existing || []).map(e => e.prospeo_person_id));
    const newResults = allResults.filter(r => !existingIds.has(r.personId));
    const dupCount = allResults.length - newResults.length;

    // Insert prospects in batches of 100
    let insertedCount = 0;
    for (let i = 0; i < newResults.length; i += 100) {
      const chunk = newResults.slice(i, i + 100);
      const rows = chunk.map(r => ({
        batch_id: batch.id,
        prospeo_person_id: r.personId,
        first_name: r.firstName,
        last_name: r.lastName,
        title: r.title,
        company_name: r.companyName,
        website: r.companyDomain ? `https://${r.companyDomain}` : '',
        linkedin_url: r.linkedinUrl,
        industry: r.industry,
        company_size: r.companySize,
        location: r.location,
        pipeline_status: 'found',
      }));

      const { error: insertError } = await supabase
        .from('campaign_prospects')
        .insert(rows);

      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        insertedCount += chunk.length;
      }
    }

    // Update batch prospect count
    await supabase
      .from('campaign_batches')
      .update({ prospect_count: insertedCount })
      .eq('id', batch.id);

    return new Response(JSON.stringify({
      batch_id: batch.id,
      total_available: totalAvailable,
      fetched: allResults.length,
      duplicates_skipped: dupCount,
      inserted: insertedCount,
      pages_fetched: Math.min(Math.ceil(allResults.length / 25), maxPages),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Search error:', err);
    return new Response(JSON.stringify({
      error: 'Search failed',
      detail: err?.message,
      batch_id: batch.id,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
