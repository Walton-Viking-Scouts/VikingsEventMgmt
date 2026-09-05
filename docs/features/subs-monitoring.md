# Subs monitoring (OSM online payments)

Read-only tab that shows, per section, whether subscription schemes are set up
for the previous, current and next term, how many young people (YP) are in
each subs scheme, how many YP are in none, and what is unpaid. A section
drills down to names and per-payment status.

Backend: `VikingsEventMgmtAPI` v1.4.1+ (`/get-payment-schemes`,
`/get-payment-status`, `/get-payment-schedule`). Query names are `sectionid`,
`schemeid`, `termid`; always send `payload=1` to `/get-payment-status`.
Response shapes are documented in the backend's `docs/api/osm-proxy.md`.

## Hard rules

- **OSM is sensitive to bad calls.** One load per user action. No polling, no
  background refresh, no automatic retry. On the first failed call, stop the
  whole load and surface the error. Never call a payment endpoint for a
  section whose finance permission is below 10.
- Cache every payment response in the generic `CACHE_DATA` IndexedDB store
  (`viking_payment_schemes_<sectionId>`,
  `viking_payment_status_<sectionId>_<schemeId>_<termId>`) with a 30 minute
  TTL and `_cacheTimestamp`, exactly like `getProgramme` in
  `src/shared/services/api/api/programme.js`. No new stores or tables.
- The finance OAuth scope is read from the token itself: decode the JWT
  payload's `scopes` array. Never call `/validate-token` (it always 401s for
  web logins). Tokens issued before 2026-09-04 lack `section:finance:read`;
  the pages show a sign-in card instead of loading.
- Fixtures must be anonymised. Real captures live in the workspace-level
  `scripts/out/` (outside git) and contain names, dates of birth and photo ids.

## Terminology and derivations

- **Subs scheme**: a scheme whose `require_all` is `1` (everyone is expected
  to pay). Schemes with `require_all` `0` (e.g. "Camps and Activities") are
  listed as *other schemes* and never loaded.
- **YP**: cached section members whose `person_type` is `'Young People'`
  (see `src/features/water-rota/hooks/useSectionYPCounts.js` for the
  membership lookup). Members in the status response are matched to cached
  members by `scoutid`.
- **Term buckets**: previous / current / next come from the shared terms
  helpers, never from the per-section `terms` store (its `sectionid` index is
  number-typed and misses string lookups). The section's term list is
  `getTerms(token)[String(sectionId)]` (one shared fetch per summary run);
  current is `CurrentActiveTermsService.getCurrentActiveTerm(sectionId)` when
  a record exists, else the term containing today, else the most recently
  ended term if it ended within 120 days, else none (the section is reported
  as having no current term and is skipped). Previous is the term with the
  latest end date before current's start, next the earliest starting after
  current's end. A payment belongs to a bucket when its `date` falls inside
  that term's `startdate`..`enddate`.
- **Scheme covers a term** when it has at least one payment in that bucket.
  **Section subs coverage** for a bucket is true when any subs scheme covers it.
- **Per-payment state** for a member, from the per-payment object in the
  `payload=1` response (`status` history is newest first; the entry with
  `latest === '1'` is current, fall back to index 0):
  - `not-applicable`: `active === false` or `defaulton === false`
  - `paid`: latest status is `Paid`, `Received` or `Paid manually`
  - `not-required`: latest status is `Payment not required`
  - `in-progress`: latest status is `Initiated` or `Submitted`
  - `required`: latest status is `Payment required`
  - `not-started`: empty history
  - anything else: `unknown` (kept, surfaced as-is)
- **Unpaid** (per scheme, current term): applicable payments dated on or
  before today whose state is `required` or `not-started`. Count members and
  sum `amount`. `in-progress` is reported separately as *pending*.
- **YP not set up**: YP not present in any subs scheme's member list for the
  current term. Reported separately: members present but with
  `directdebit !== 'Active'` (*no direct debit*).
- `amount_overdue` from `/get-payment-schemes` is shown as OSM's own overdue
  figure per scheme; it is not recomputed.

## Data contract

`src/features/subs/services/subsService.js` exports:

```js
/**
 * Every cached section in store order, flagged with whether the user may view
 * its finance data (permissions.finance >= 10). It does not filter; callers
 * must skip canView === false rather than calling loadSectionSubs for it.
 */
export async function getSubsSections(): Promise<Array<{ sectionId: string, sectionName: string, financePermission: number, canView: boolean }>>

/**
 * Loads one section: schemes, then one status call per subs scheme for the
 * current term, sequentially. Stops on the first failure. Uses the cache
 * unless forceRefresh. Throws on failure. Every thrown error carries
 * err.code ('UNKNOWN_SECTION' | 'NO_ACCESS' | 'NO_CURRENT_TERM' |
 * 'DEMO_MODE' | 'NEEDS_AUTH' | 'LOAD_FAILED'), a readable err.message,
 * err.localOnly === true when it was raised before any network call (the
 * first four), and err.needsAuth === true for 401/expired-token.
 */
export async function loadSectionSubs(sectionId, { token, forceRefresh = false }): Promise<SectionSubsSummary>
```

`src/shared/services/auth/tokenScopes.js` exports:

```js
export function decodeTokenScopes(token): string[]        // [] if not a decodable JWT
export function hasFinanceScope(token): boolean            // includes 'section:finance:read'
```

`SectionSubsSummary` (pure output of `buildSectionSubsSummary` in
`src/features/subs/services/subsModel.js`):

```js
{
  sectionId: '49097',
  sectionName: 'Thursday Beavers',
  loadedAt: 1757030400000,                 // ms epoch of the newest response used
  fromCache: false,
  terms: {                                  // each null when unknown
    previous: { termId, name, startDate, endDate } | null,
    current:  { termId, name, startDate, endDate } | null,
    next:     { termId, name, startDate, endDate } | null,
  },
  ypCount: 24,                              // cached YP in the section
  subsCoverage: { previous: true, current: true, next: false },
  schemes: [                                // subs schemes only, in OSM order
    {
      schemeId: '60604',
      name: 'Beavers Subs',
      amountOverdue: 0,                     // Number(amount_overdue)
      memberCount: 20,                      // members in the status response
      ypCount: 19,                          // of which are cached YP
      noDirectDebitCount: 1,
      payments: [                           // all payments OSM returned, sorted by date
        { paymentId: '1259480', date: '2026-09-15', amount: 26, bucket: 'current' | 'previous' | 'next' | null },
      ],
      coverage: { previous: true, current: true, next: false },
      termStats: {                          // per term bucket; payments in that bucket only; SAME shape for all three
        previous: TermBucketStats, current: TermBucketStats, next: TermBucketStats,
      },
      members: [                            // for drill-down, sorted by lastName, firstName
        {
          scoutId: '2111171',
          firstName: 'A', lastName: 'B',
          patrolId: '119078',
          isYP: true | false | null,        // null when not in cached members
          directDebit: 'Active' | 'Inactive' | string,
          payments: {
            '1259480': { state: 'paid', latestStatus: 'Received', latestAt: '2025-04-08 11:58:00', amount: 26, date: '2026-09-15', bucket: 'current' },
          },
        },
      ],
    },
  ],
  otherSchemes: [ { schemeId: '31715', name: 'Camps and Activities', amountOverdue: 0 } ],
  ypInSubsCount: 22,                        // YP present in at least one subs scheme
  ypNotInSubs: [ { scoutId, firstName, lastName, patrolId } ],   // YP in no subs scheme
  termTotals: {                             // across subs schemes, members deduplicated; same TermBucketStats shape
    previous: TermBucketStats, current: TermBucketStats, next: TermBucketStats,
  },
  members: [                                // one row per (member, subs scheme), sorted by lastName, firstName, schemeName
    {
      scoutId: '2111171', firstName: 'A', lastName: 'B', patrolId: '119078', isYP: true,
      directDebit: 'Active',
      schemeId: '60604', schemeName: 'Beavers Subs',
      buckets: {                            // payments of this scheme in each term bucket, sorted by date
        previous: [ { paymentId, date, amount, state, latestStatus, latestAt } ],
        current:  [ ... ],
        next:     [ ... ],
      },
      nextSetUp: 'ready' | 'no-direct-debit' | 'not-applicable' | 'not-scheduled',
    },
  ],
}
```

`TermBucketStats` (one shape for every bucket; members are counted once even
with several payments in the bucket, amounts sum the payments):

```js
{
  paymentIds: ['1259480'],
  scheduled: true,                          // the scheme has at least one payment in this bucket
  due:     { members: 20, amount: 520 },    // applicable payments (active && defaulton), any date
  paid:    { members: 16, amount: 416 },    // state paid (not-required is settled but not counted here)
  unpaid:  { members: 4, amount: 104 },     // applicable, state required or not-started, ANY date
  overdue: { members: 3, amount: 78 },      // the unpaid subset whose date is on or before today
  pending: { members: 1, amount: 26 },      // state in-progress
  readyMembers: 17, noDirectDebitMembers: 2, notApplicableMembers: 1,   // set-up view (see nextSetUp)
}
```

So for the next term `due` is what is scheduled, `paid` counts parents who have
paid early, `unpaid` is the rest, and `overdue` stays 0 until the due date;
for the previous term `unpaid` and `overdue` normally coincide.

`nextSetUp` answers "will next term's subs be collected for this member":
`paid` when the member's next-term payment is already paid (parents can pay
early; this counts as set up regardless of mandate); `ready` when the scheme
has a next-term payment, it applies to the member (`active` and `defaulton`)
and `directDebit === 'Active'`; `no-direct-debit` when the payment applies but
there is no active mandate; `not-applicable` when the payment does not apply
to the member; `not-scheduled` when the scheme has no next-term payment at
all. `readyMembers` in `TermBucketStats` includes the `paid` ones. `unpaid` for the previous bucket uses the same rule as current
(due on or before today, state `required` or `not-started`).

## Pages

Route `/subs` (tab "Subs" in `MainNavigation`, after Water Rota).

- **Summary** (`/subs`): ONE table, one row per section (loaded one section
  at a time in order, with a per-row spinner while loading and a stop-on-first-error
  banner for a failed network call). Columns: Section, then a "Young people"
  group of Total (`ypCount`), Leaders subs, Section subs and Not set up, then
  for each of Previous / Current / Next a group of three columns Due, Unpaid,
  Overdue showing members with £ underneath (from `termTotals`), the term
  name in the group header, and "Not scheduled" in the group header when
  nothing is scheduled. Rows are links to the section page. Local errors and
  no-access sections render as muted rows with their message spanning the
  columns. A subs scheme is a *leaders* scheme when its name matches
  `/leader/i` (the discounted scheme for leaders' children); every other subs
  scheme is *section subs*. Both figures sum `schemes[].ypCount` over their
  group, so a YP in both counts in both; the leaders cell shows a dash rather
  than 0 when the section has no leaders scheme. The older description below still applies for behaviour:
  one row/card per viewable section, loaded one section
  at a time in order, with a per-section spinner and a stop-on-first-error
  banner. Columns: YP count, per-subs-scheme YP count (scheme name as the
  header, e.g. "Beavers Subs 19 / Leaders Subs 4"), YP not set up, previous /
  current / next term set-up ticks, unpaid (members and £), OSM overdue £.
  A section whose error is `localOnly` (nothing was asked of OSM) is marked in
  place with its message and the loop moves on to the next section; only a
  failed network call stops the run and raises the banner.
  A Refresh button reloads with `forceRefresh`. Sections with `canView` false
  are rendered as greyed, non-linking cards showing only the section name and
  "No finance access" (no spinner, no figures) and are never loaded; when no
  section is viewable the page shows "No sections with finance access". If the token lacks the finance
  scope, the page shows the sign-in card (copy the water rota `needsAuth`
  card in `RotaBoardPage.jsx`) and loads nothing.
- **Section** (`/subs/:sectionId`): header with the term names and coverage
  ticks; a list "YP not set up" with names; then ONE table for the whole
  section built from `members`: columns Name, YP marker, Scheme (e.g.
  "Leaders Subs" / "Beavers Subs"), DD (direct debit badge), Previous,
  Current, Next. Previous and Current cells show a state badge per payment in
  that bucket (date and £ in the badge title), so unpaid previous-term
  members stand out. The Next cell shows `nextSetUp` as a badge: ready
  (green), no direct debit (amber), not applicable (muted), not scheduled
  (grey, and the column header says "Not scheduled" when no scheme has a
  next-term payment). A footer line gives the section's `termTotals`. Other
  schemes are listed by name only.

Style: Tailwind, `scout-blue` theme, existing `LoadingScreen`, `ErrorState`,
`Alert`, `SectionFilter` conventions. Mobile first; tables scroll inside
`overflow-x-auto`.

## Work split

- **Data agent**: `payments.js` API functions (+ barrel export),
  `tokenScopes.js`, `subsModel.js`, `subsService.js`, fixture anonymiser
  script in `scripts/`, anonymised fixtures in `src/features/subs/__fixtures__/`,
  unit tests for all of it.
- **UI agent**: `src/features/subs/components/*`, `src/features/subs/hooks/*`,
  the route in `AppRouter.jsx`, the tab in `MainNavigation.jsx`, component and
  hook tests that mock `subsService.js` with the contract above.
