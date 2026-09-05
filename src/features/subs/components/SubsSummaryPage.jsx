import React from 'react';
import { Link } from 'react-router-dom';
import useSubsSummary from '../hooks/useSubsSummary.js';
import SubsSignInCard from './SubsSignInCard.jsx';
import { formatPounds } from './formatPounds.js';
import { BUCKET_LABELS, BUCKETS, ypBySchemeKind } from './termLabels.js';
import { formatLoadedAt } from './formatLoadedAt.js';

const FIGURE_COLUMNS = ['due', 'paid', 'unpaid'];

const YP_COLUMNS = ['total', 'leaders', 'section', 'not set up'];

/** Shown when the section has no cached members to derive YP figures from. */
export const NO_MEMBERS_MESSAGE = 'No members cached for this section — refresh the app data';

const DATA_COLUMN_COUNT = 1 + YP_COLUMNS.length + BUCKETS.length * FIGURE_COLUMNS.length;

/**
 * A members count with its amount underneath.
 *
 * @param {object} props - Component props
 * @param {{members: number, amount: number}} [props.figure] - The figure to show
 * @returns {JSX.Element} A stacked members/amount cell body
 */
function Figure({ figure }) {
  return (
    <span>
      <span className="block">{figure?.members ?? 0}</span>
      <span className="block text-xs text-gray-400">{formatPounds(figure?.amount)}</span>
    </span>
  );
}

/**
 * Cells for one section row: its figures once loaded, blank while this
 * section is loading, dashes while it is still pending, or a single message
 * cell for a section that cannot be loaded.
 *
 * @param {object} props - Component props
 * @param {object} [props.summary] - Loaded SectionSubsSummary
 * @param {boolean} props.isLoading - Whether this section is currently loading
 * @param {string} [props.message] - No-access or local-error message
 * @returns {JSX.Element} The row's data cells
 */
function RowCells({ summary, isLoading, message }) {
  if (message) {
    return (
      <td colSpan={DATA_COLUMN_COUNT - 1} className="px-3 py-2 text-sm text-gray-500">
        {message}
      </td>
    );
  }

  if (!summary) {
    return (
      <>
        {Array.from({ length: DATA_COLUMN_COUNT - 1 }, (_, index) => (
          <td key={index} className="px-3 py-2 text-gray-300">
            {isLoading ? '' : '–'}
          </td>
        ))}
      </>
    );
  }

  return (
    <>
      {summary.cachedMemberCount === 0 ? (
        Array.from({ length: YP_COLUMNS.length }, (_, index) => (
          <td key={index} className="px-3 py-2 text-gray-300" title={NO_MEMBERS_MESSAGE}>
            –
          </td>
        ))
      ) : (
        <>
          <td className="px-3 py-2 text-gray-900">{summary.ypCount ?? 0}</td>
          <td className="px-3 py-2 text-gray-900">
            {ypBySchemeKind(summary.schemes).leaders ?? <span className="text-gray-300">–</span>}
          </td>
          <td className="px-3 py-2 text-gray-900">{ypBySchemeKind(summary.schemes).section}</td>
          <td className="px-3 py-2 text-gray-900">{summary.ypNotInSubs?.length ?? 0}</td>
        </>
      )}
      {BUCKETS.map((bucket) => {
        const stats = summary.termTotals?.[bucket];
        if (!stats?.scheduled) {
          return (
            <td key={bucket} colSpan={FIGURE_COLUMNS.length} className="px-3 py-2 text-sm text-gray-400">
              Not scheduled
            </td>
          );
        }
        return FIGURE_COLUMNS.map((column) => (
          <td key={`${bucket}-${column}`} className="px-3 py-2 text-gray-900">
            <Figure figure={stats[column]} />
          </td>
        ));
      })}
    </>
  );
}

/**
 * Subs summary page: one table row per section, loaded one at a time.
 *
 * @returns {JSX.Element} The summary page
 */
function SubsSummaryPage() {
  const {
    sections,
    summaries,
    loadingSectionId,
    failedSectionId,
    sectionErrors,
    loading,
    error,
    needsAuth,
    needsFinanceScope,
    refresh,
  } = useSubsSummary();

  if (needsFinanceScope || needsAuth) {
    return <SubsSignInCard />;
  }

  const failedSection = sections.find((section) => section.sectionId === failedSectionId);
  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="m-0 text-lg font-semibold text-gray-900">Subs</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-md bg-scout-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-scout-blue-dark disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="m-0 font-medium">
            Couldn&apos;t load {failedSection ? failedSection.sectionName : 'subs'}
          </p>
          <p className="m-0 mt-1">{error.message}</p>
          <p className="m-0 mt-1">Loading stopped; no further sections were requested.</p>
        </div>
      ) : null}

      {!loading && !sections.some((section) => section.canView) ? (
        <p className="text-sm text-gray-500">No sections with finance access</p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th scope="col" rowSpan={2} className="px-3 py-2 font-medium align-bottom">Section</th>
              <th
                scope="colgroup"
                colSpan={YP_COLUMNS.length}
                className="border-l border-gray-200 px-3 py-2 font-medium whitespace-nowrap"
              >
                Young people
              </th>
              {BUCKETS.map((bucket) => (
                <th
                  key={bucket}
                  scope="colgroup"
                  colSpan={FIGURE_COLUMNS.length}
                  className="border-l border-gray-200 px-3 py-2 font-medium whitespace-nowrap"
                >
                  {BUCKET_LABELS[bucket]}
                </th>
              ))}
            </tr>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              {YP_COLUMNS.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`px-3 pb-2 font-medium whitespace-nowrap ${index === 0 ? 'border-l border-gray-200' : ''}`}
                >
                  {column}
                </th>
              ))}
              {BUCKETS.map((bucket) =>
                FIGURE_COLUMNS.map((column, index) => (
                  <th
                    key={`${bucket}-${column}`}
                    scope="col"
                    className={`px-3 pb-2 font-medium ${index === 0 ? 'border-l border-gray-200' : ''}`}
                  >
                    {column}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sections.map((section) => {
              const summary = summaries[section.sectionId];
              const isLoading = loadingSectionId === section.sectionId;
              const message = section.permissionsSynced === false
                ? 'Permissions not synced — refresh the app data'
                : !section.canView
                  ? 'No finance access'
                  : sectionErrors[section.sectionId]?.message;
              const freshness = formatLoadedAt(summary?.loadedAt, summary?.fromCache);

              return (
                <tr key={section.sectionId} className={message ? 'bg-gray-50' : ''}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {message ? (
                      <span className="font-medium text-gray-500">{section.sectionName}</span>
                    ) : (
                      <Link to={`/subs/${section.sectionId}`} className="font-medium text-scout-blue hover:underline">
                        {section.sectionName}
                      </Link>
                    )}
                    {isLoading ? (
                      <span
                        role="status"
                        aria-label="Loading section"
                        className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-b-2 border-scout-blue align-middle"
                      />
                    ) : null}
                    {freshness ? (
                      <span className="block text-xs font-normal text-gray-400">{freshness}</span>
                    ) : null}
                  </td>
                  <RowCells summary={summary} isLoading={isLoading} message={message} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SubsSummaryPage;
