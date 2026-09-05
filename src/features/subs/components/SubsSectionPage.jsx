import React from 'react';
import { Link, useParams } from 'react-router-dom';
import LoadingScreen from '../../../shared/components/LoadingScreen.jsx';
import useSectionSubs from '../hooks/useSectionSubs.js';
import CoverageTicks from './CoverageTicks.jsx';
import SectionMembersTable from './SectionMembersTable.jsx';
import SubsSignInCard from './SubsSignInCard.jsx';

/**
 * Drill-down page for one section: term coverage, the young people with no
 * subs scheme, and a table per subs scheme.
 *
 * @returns {JSX.Element} The section subs page
 */
function SubsSectionPage() {
  const { sectionId } = useParams();
  const { summary, loading, error, needsAuth, needsFinanceScope, refresh } = useSectionSubs(sectionId);

  if (needsFinanceScope || needsAuth) {
    return <SubsSignInCard />;
  }

  if (loading && !summary) {
    return <LoadingScreen message="Loading subs..." />;
  }

  const termNames = summary
    ? ['previous', 'current', 'next']
      .map((bucket) => summary.terms?.[bucket]?.name)
      .filter(Boolean)
      .join(' · ')
    : '';

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      <Link to="/subs" className="text-sm text-scout-blue hover:underline">
        ← All sections
      </Link>

      <div className="mt-2 mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="m-0 text-lg font-semibold text-gray-900">
            {summary?.sectionName ?? 'Section'}
          </h1>
          {termNames ? <p className="m-0 mt-0.5 text-xs text-gray-500">{termNames}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {summary ? <CoverageTicks coverage={summary.subsCoverage} terms={summary.terms} /> : null}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-md bg-scout-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-scout-blue-dark disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="m-0 font-medium">Couldn&apos;t load this section</p>
          <p className="m-0 mt-1">{error.message}</p>
        </div>
      ) : null}

      {summary ? (
        <>
          <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="m-0 text-base font-semibold text-gray-900">YP not set up</h2>
            {(summary.ypNotInSubs ?? []).length === 0 ? (
              <p className="m-0 mt-1 text-sm text-gray-500">All young people are in a subs scheme</p>
            ) : (
              <ul className="m-0 mt-2 list-disc pl-5 text-sm text-gray-800">
                {summary.ypNotInSubs.map((member) => (
                  <li key={member.scoutId}>{member.firstName} {member.lastName}</li>
                ))}
              </ul>
            )}
          </section>

          <SectionMembersTable
            members={summary.members}
            terms={summary.terms}
            termTotals={summary.termTotals}
          />

          {(summary.otherSchemes ?? []).length > 0 ? (
            <section className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="m-0 text-base font-semibold text-gray-900">Other schemes</h2>
              <ul className="m-0 mt-2 list-disc pl-5 text-sm text-gray-600">
                {summary.otherSchemes.map((scheme) => (
                  <li key={scheme.schemeId}>{scheme.name}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default SubsSectionPage;
