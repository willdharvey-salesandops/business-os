# Skill: Email Verification Logic

Used by: List Builder agent

This skill defines the verification logic, status categories, and bounce thresholds used when cleaning a prospect list.

---

## Verification Status Categories

| Status | Definition | Include in main list? |
|--------|------------|----------------------|
| `valid` | Email confirmed to exist and accept mail | Yes |
| `risky` | Email may exist but could not be fully confirmed | Separate risky.csv — user decides |
| `catch-all` | Domain accepts all emails regardless of whether the address exists — impossible to fully verify | Separate risky.csv — user decides |
| `invalid` | Email definitely does not exist or domain rejects all mail | Never — remove silently, count in summary |

---

## Bounce Rate Thresholds

Before passing a list to the Researcher, flag the Orchestrator if:

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Catch-all rate | >20% of final list | Flag — high risk of bounces damaging sender reputation |
| Invalid rate | >10% of raw results | Flag — suggests ICP targeting or data quality issue |
| Combined risky + catch-all | >35% of final list | Flag — recommend manual verification before sending |

These are warnings, not automatic stops. The user decides how to proceed.

---

## Healthy List Benchmarks

A list ready to send should aim for:
- >80% valid emails
- <15% catch-all
- <5% risky
- 0% invalid (all removed)
- Bounce rate after sending: target <3%

---

## Prospeo Verification

Prospeo performs email verification during the search query. The List Builder should use Prospeo's built-in verification status field — see the `prospeo-api.md` skill for the field mapping.

If Prospeo does not return a verification status for a record:
- Treat the email as `risky`
- Flag this in the summary report
- Do not silently classify as valid

---

## Catch-All Domain Handling

Catch-all domains accept all incoming mail, meaning you cannot verify individual addresses. Options:

1. **Exclude entirely**: Safest for sender reputation. Reduces list size.
2. **Include in risky.csv**: User can decide to use them with higher tolerance for bounces.
3. **Manual check**: Some email verification tools (ZeroBounce, NeverBounce) can further filter catch-all lists — flag as an option if the catch-all rate is high.

Default recommendation: exclude from the main list, include in `risky.csv`, flag to user.

---

## Existing List Deduplication

When `dedup_check` is enabled, the List Builder cross-checks the new list against all previous lists in `/clients/[client]/lists/`.

Process:
1. Load all existing `*-list.csv` files for the client
2. Extract the `email` column from each
3. Compare against the new list
4. Remove any email that appears in a previous list
5. Count removed and include in the summary

This prevents re-contacting prospects who have already been in a campaign, which can increase unsubscribes and damage reputation.

---

## Deduplication Within Results

When Prospeo returns the same email address from multiple queries (e.g. when running multiple job title searches):
- Keep the record with more complete data
- If data is equal, keep the first occurrence
- Count deduplications in the summary
