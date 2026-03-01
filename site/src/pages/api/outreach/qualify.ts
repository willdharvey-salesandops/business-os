import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function getEnv(key: string): string {
  return (import.meta.env[key] || process.env[key] || '') as string;
}

function getSupabase() {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));
}

// Revenue proxy based on Companies House accounts type
const QUALIFIED_ACCOUNT_TYPES = ['small', 'full', 'medium', 'group', 'unaudited-abridged'];
const DISQUALIFIED_ACCOUNT_TYPES = ['micro-entity', 'dormant', 'null'];

interface CompanySearchResult {
  company_number: string;
  title: string;
  address_snippet?: string;
  company_status?: string;
}

interface CompanyProfile {
  company_number: string;
  company_name: string;
  company_status: string;
  type: string;
  sic_codes?: string[];
  date_of_creation?: string;
  accounts?: {
    accounting_reference_date?: { month: string; day: string };
    last_accounts?: { type: string; made_up_to: string };
  };
}

interface Officer {
  name: string;
  officer_role: string;
  appointed_on?: string;
  resigned_on?: string;
}

export const POST: APIRoute = async ({ request }) => {
  const { prospect_id } = await request.json();

  if (!prospect_id) {
    return new Response(JSON.stringify({ error: 'prospect_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const chApiKey = getEnv('COMPANIES_HOUSE_API_KEY');
  if (!chApiKey) {
    return new Response(JSON.stringify({ error: 'Companies House API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = getSupabase();

  // Read prospect
  const { data: prospect, error: readError } = await supabase
    .from('outreach_prospects')
    .select('*')
    .eq('id', prospect_id)
    .single();

  if (readError || !prospect) {
    return new Response(JSON.stringify({ error: 'Prospect not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = 'Basic ' + btoa(chApiKey + ':');

  try {
    // Search Companies House by company name
    const searchResponse = await fetch(
      `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(prospect.company_name)}&items_per_page=5`,
      { headers: { Authorization: authHeader } }
    );

    if (!searchResponse.ok) {
      // Company not found on Companies House (might be sole trader)
      await supabase
        .from('outreach_prospects')
        .update({
          pipeline_status: 'qualified',
          accounts_type: 'unregistered',
        })
        .eq('id', prospect_id);

      return new Response(JSON.stringify({
        prospect_id,
        status: 'qualified',
        note: 'Not found on Companies House. May be a sole trader. Proceeding anyway.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const searchData = await searchResponse.json();
    const results: CompanySearchResult[] = searchData.items || [];

    if (results.length === 0) {
      await supabase
        .from('outreach_prospects')
        .update({
          pipeline_status: 'qualified',
          accounts_type: 'unregistered',
        })
        .eq('id', prospect_id);

      return new Response(JSON.stringify({
        prospect_id,
        status: 'qualified',
        note: 'No Companies House match found. Proceeding as unregistered.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pick the best match (first active company)
    const activeMatch = results.find(r => r.company_status === 'active') || results[0];
    const companyNumber = activeMatch.company_number;

    // Get full company profile
    const profileResponse = await fetch(
      `https://api.company-information.service.gov.uk/company/${companyNumber}`,
      { headers: { Authorization: authHeader } }
    );

    let profile: CompanyProfile | null = null;
    if (profileResponse.ok) {
      profile = await profileResponse.json();
    }

    // Get officers (directors)
    const officersResponse = await fetch(
      `https://api.company-information.service.gov.uk/company/${companyNumber}/officers?items_per_page=10`,
      { headers: { Authorization: authHeader } }
    );

    let officers: Officer[] = [];
    if (officersResponse.ok) {
      const officersData = await officersResponse.json();
      officers = (officersData.items || []).filter((o: Officer) => !o.resigned_on);
    }

    // Find director/owner
    const director = officers.find(o => o.officer_role === 'director') || officers[0];
    const ownerName = director?.name || '';
    const ownerRole = director?.officer_role || '';

    // Check accounts type for revenue proxy
    const accountsType = profile?.accounts?.last_accounts?.type?.toLowerCase() || '';
    const companyStatus = profile?.company_status || '';

    // Disqualify dormant or dissolved companies
    if (companyStatus === 'dissolved' || companyStatus === 'liquidation') {
      await supabase
        .from('outreach_prospects')
        .update({
          pipeline_status: 'disqualified',
          company_number: companyNumber,
          accounts_type: accountsType || companyStatus,
          company_status: companyStatus,
          sic_codes: profile?.sic_codes || [],
          owner_name: formatName(ownerName),
          owner_role: ownerRole,
        })
        .eq('id', prospect_id);

      return new Response(JSON.stringify({
        prospect_id,
        status: 'disqualified',
        reason: `Company is ${companyStatus}`,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Disqualify micro-entities (too small, under £632k)
    if (accountsType === 'micro-entity') {
      await supabase
        .from('outreach_prospects')
        .update({
          pipeline_status: 'disqualified',
          company_number: companyNumber,
          accounts_type: accountsType,
          company_status: companyStatus,
          sic_codes: profile?.sic_codes || [],
          incorporation_date: profile?.date_of_creation || null,
          owner_name: formatName(ownerName),
          owner_role: ownerRole,
        })
        .eq('id', prospect_id);

      return new Response(JSON.stringify({
        prospect_id,
        status: 'disqualified',
        reason: 'Micro-entity (turnover under £632k)',
        accounts_type: accountsType,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Qualified
    await supabase
      .from('outreach_prospects')
      .update({
        pipeline_status: 'qualified',
        company_number: companyNumber,
        accounts_type: accountsType || 'unknown',
        company_status: companyStatus,
        sic_codes: profile?.sic_codes || [],
        incorporation_date: profile?.date_of_creation || null,
        owner_name: formatName(ownerName),
        owner_role: ownerRole,
      })
      .eq('id', prospect_id);

    return new Response(JSON.stringify({
      prospect_id,
      status: 'qualified',
      company_number: companyNumber,
      accounts_type: accountsType || 'unknown',
      sic_codes: profile?.sic_codes || [],
      owner_name: formatName(ownerName),
      owner_role: ownerRole,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Qualify error:', err);
    return new Response(JSON.stringify({ error: 'Qualification failed', detail: err?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Companies House returns names as "SURNAME, Firstname" - convert to "Firstname Surname"
function formatName(name: string): string {
  if (!name) return '';
  const parts = name.split(',').map(p => p.trim());
  if (parts.length === 2) {
    const surname = parts[0].charAt(0) + parts[0].slice(1).toLowerCase();
    const firstName = parts[1];
    return `${firstName} ${surname}`;
  }
  return name;
}
