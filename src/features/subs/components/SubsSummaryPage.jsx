import React from 'react';
import { Link } from 'react-router-dom';
import useSubsSummary from '../hooks/useSubsSummary.js';
import CoverageTicks from './CoverageTicks.jsx';
import SubsSignInCard from './SubsSignInCard.jsx';
import { formatPounds } from './formatPounds.js';

/**
 * One section's row on the summary page: either its loaded figures, a spinner
 * while it is the section being loaded, or a pending placeholder.
 *
 * @param {object} props - Component props
 * @param {{sectionId: string, sectionName: string, canView: boolean}} props.section - The section
 * @param {object} [props.summary] - Loaded SectionSubsSummary, when available
 * @param {boolean} props.isLoading - Whether this section is currently loading
 * @param {{code: string, message: string}} [props.sectionError] - A local, pre-network failure for this section
 * @returns {JSX.Element} A section card linking to its drill-down
 */
function SectionCard({ section, summary, isLoading, sectionError }) {
  if (sectionError) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm">
        <h2 className="m-0 text-base font-semibold text-gray-500">{section.sectionName}</h2>
        <p className="m-0 mt-2 text-sm text-gray-500">{sectionError.message}</p>
      </div>
    );
  }

  if (!section.canView) {
    return (
      <div
        aria-disabled="true"
        className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-400 shadow-sm"
      >
        <h2 className="m-0 text-base font-semibold">{section.sectionName}</h2>
        <p className="m-0 mt-2 text-sm">No finance access</p>
      </div>
    );
  }

  return (
    <Link
      to={`/subs/${section.sectionId}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-scout-blue"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-base font-semibold text-gray-900">{section.sectionName}</h2>
        {summary ? <CoverageTicks coverage={summary.subsCoverage} terms={summary.terms} /> : null}
      </div>

      {isLoading && !summary ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
          <span
            role="status"
            aria-label="Loading section"
            className="inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-scout-blue"
          />
          Loading…
        </p>
      ) : null}

      {!isLoading && !summary ? (
        <p className="mt-2 text-sm text-gray-400">Pending</p>
      ) : null}

      {summary ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Young people</dt>
            <dd className="m-0 text-gray-900">{summary.ypCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">YP not set up</dt>
            <dd className="m-0 text-gray-900">{summary.ypNotInSubs?.length ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Unpaid</dt>
            <dd className="m-0 text-gray-900">
              {summary.unpaidTotal?.members ?? 0} ({formatPounds(summary.unpaidTotal?.amount)})
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">OSM overdue</dt>
            <dd className="m-0 text-gray-900">
              {formatPounds((summary.schemes ?? []).reduce((total, scheme) => total + (Number(scheme.amountOverdue) || 0), 0))}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs uppercase tracking-wide text-gray-500">Schemes</dt>
            <dd className="m-0 text-gray-900">
              {(summary.schemes ?? []).length === 0
                ? 'No subs schemes'
                : (summary.schemes ?? []).map((scheme) => `${scheme.name} ${scheme.ypCount}`).join(' / ')}
            </dd>
          </div>
        </dl>
      ) : null}
    </Link>
  );
}

/**
 * Subs summary page: one card per viewable section, loaded one at a time.
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
    <div className="max-w-4xl mx-auto px-4 py-4">
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

      <div className="space-y-3">
        {sections.map((section) => (
          <SectionCard
            key={section.sectionId}
            section={section}
            summary={summaries[section.sectionId]}
            isLoading={loadingSectionId === section.sectionId}
            sectionError={sectionErrors[section.sectionId]}
          />
        ))}
      </div>
    </div>
  );
}

export default SubsSummaryPage;
