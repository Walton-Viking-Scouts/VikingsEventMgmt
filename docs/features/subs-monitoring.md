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
- **Term buckets**: previous / current / next are taken from the section's
  cached terms: current is the term containing today (fallback: the most
  recent term, via `src/shared/utils/termUtils.js` and
  `currentActiveTermsService`), previous is the latest term ending before it,
  next is the earliest term starting after it. A payment belongs to a bucket
  when its `date` falls inside that term's `startdate`..`enddate`.
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
      currentTerm: {
        paymentIds: ['1259480'],
        unpaid: { members: 3, amount: 78 },
        pending: { members: 1, amount: 26 },
        paidMembers: 16,
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
  unpaidTotal: { members: 3, amount: 78 }, // across subs schemes, current term (members deduplicated)
}
```

## Pages

Route `/subs` (tab "Subs" in `MainNavigation`, after Water Rota).

- **Summary** (`/subs`): one row/card per viewable section, loaded one section
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
  ticks; a list "YP not set up" with names; then one table per subs scheme:
  member name, YP/adult marker, direct debit badge, one column per
  current-term payment (date and £) with a state badge, plus a compact
  previous/next indicator. Other schemes are listed by name only.

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
