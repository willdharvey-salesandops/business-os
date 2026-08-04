-- Outreach Console shared state (one row per company). Run once in Supabase SQL editor.
create table if not exists outreach_state (
  company     text primary key,
  stage       text not null default 'companies',
  prev_stage  text,
  "trigger"   text default '',
  source      text default '',
  subject     text default 'Email production',
  contacts    jsonb not null default '[]'::jsonb,
  emails      jsonb not null default '[]'::jsonb,
  generated   boolean not null default false,
  sent_at     timestamptz,
  updated_at  timestamptz not null default now()
);
create index if not exists outreach_state_stage_idx on outreach_state (stage);
-- Routes use the service-role key (bypasses RLS). Enable RLS to block anon access:
alter table outreach_state enable row level security;
