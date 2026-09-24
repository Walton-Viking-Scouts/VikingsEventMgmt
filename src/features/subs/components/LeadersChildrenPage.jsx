import React from 'react';
import { Link } from 'react-router-dom';
import useLeadersChildren from '../hooks/useLeadersChildren.js';
import { subsGroupFor } from '../services/leadersChildrenModel.js';
import SubsSignInCard from './SubsSignInCard.jsx';
import SubsTabs from './SubsTabs.jsx';

const GROUP_BADGES = {
  leaders: { label: 'Leaders', className: 'bg-green-100 text-green-800 border-green-200' },
  other: { label: 'Other', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  none: { label: 'Not set up', className: 'bg-red-50 text-scout-red border-red-200' },
};

/**
 * The subs cell for one child: the subs group badge and scheme names once the
 * section is loaded, otherwise why it is not shown.
 *
 * @param {object} props - Component props
 * @param {object} [props.summary] - Loaded SectionSubsSummary for the child's section
 * @param {string} props.scoutId - The child's scout id
 * @param {string} [props.unavailable] - Why subs cannot be shown for this section
 * @param {boolean} props.isLoading - Whether the section's subs are loading
 * @returns {JSX.Element} The cell body
 */
function SubsGroupCell({ summary, scoutId, unavailable, isLoading }) {
  if (unavailable) {
    return <span className="text-xs text-gray-400">{unavailable}</span>;
  }
  if (!summary) {
    return <span className="text-gray-300">{isLoading ? '' : '–'}</span>;
  }
  const { group, schemeNames } = subsGroupFor(summary, scoutId);
  const badge = GROUP_BADGES[group];
  return (
    <span>
      <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
      {schemeNames.length > 0 ? (
        <span className="block text-xs text-gray-400">{schemeNames.join(', ')}</span>
      ) : null}
    </span>
  );
}

/**
 * One section's card: the young people with a parent who is a leader, the
 * matching parent, the leader's sections and the child's subs group.
 *
 * @param {object} props - Component props
 * @param {object} props.section - Section with its matched children and access
 * @param {object} [props.summary] - Loaded SectionSubsSummary
 * @param {boolean} props.isLoading - Whether this section's subs are loading
 * @param {string} [props.unavailable] - Why subs cannot be shown for this section
 * @returns {JSX.Element} The section card
 */
function SectionCard({ section, summary, isLoading, unavailable }) {
  return (
    <section className="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="m-0 text-base font-semibold text-gray-900">
          {section.canView ? (
            <Link to={`/subs/${section.sectionId}`} className="text-scout-blue hover:underline">
              {section.sectionName}
            </Link>
          ) : section.sectionName}
          {isLoading ? (
            <span
              role="status"
              aria-label="Loading section"
              className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-b-2 border-scout-blue align-middle"
            />
          ) : null}
        </h2>
        <span className="text-xs text-gray-500">
          {section.children.length} {section.children.length === 1 ? 'young person' : 'young people'}
        </span>
      </div>
      {section.children.length === 0 ? (
        <p className="m-0 px-4 py-3 text-sm text-gray-500">No young people with a parent who is a leader</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th scope="col" className="px-4 py-2 font-medium">Young person</th>
                <th scope="col" className="px-4 py-2 font-medium">Parent</th>
                <th scope="col" className="px-4 py-2 font-medium">Leader in</th>
                <th scope="col" className="px-4 py-2 font-medium">Subs group</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {section.children.map((child) => (
                <tr key={child.scoutId} className="align-top">
                  <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {child.firstName} {child.lastName}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {child.parents.map((parent) => (
                      <span key={parent.contact} className="block whitespace-nowrap">
                        {parent.name}
                        <span className="block text-xs text-gray-400">{parent.contact}</span>
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-2 text-gray-900">
                    {child.parents.flatMap((parent) => parent.leaders.map((leader) => (
                      <span key={`${parent.contact}-${leader.scoutId}`} className="block">
                        {leader.sections.map((entry) => entry.sectionName).join(', ')}
                      </span>
                    )))}
                  </td>
                  <td className="px-4 py-2">
                    <SubsGroupCell
                      summary={summary}
                      scoutId={child.scoutId}
                      unavailable={unavailable}
                      isLoading={isLoading}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Leaders' children page: for every section, the young people whose primary
 * contact shares a name with an adult leader in any section (or in adults),
 * which section(s) that leader is in, and, where the user has finance access,
 * whether the child is in a leaders' subs scheme or another one.
 *
 * @returns {JSX.Element} The Leaders' children page
 */
function LeadersChildrenPage() {
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
  } = useLeadersChildren();

  if (needsAuth) {
    return <SubsSignInCard />;
  }

  const failedSection = sections.find((section) => section.sectionId === failedSectionId);
  const total = sections.reduce((count, section) => count + section.children.length, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <SubsTabs />
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="m-0 text-lg font-semibold text-gray-900">Leaders&apos; children</h1>
          <p className="m-0 mt-0.5 text-xs text-gray-500">
            Young people whose primary contact has the same name as an adult leader
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-md bg-scout-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-scout-blue-dark disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {needsFinanceScope ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sign in again with the finance permission to see which subs group each young person is in.
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="m-0 font-medium">
            Couldn&apos;t load {failedSection ? failedSection.sectionName : 'leaders\' children'}
          </p>
          <p className="m-0 mt-1">{error.message}</p>
          {failedSection ? (
            <p className="m-0 mt-1">Loading stopped; no further sections were requested.</p>
          ) : null}
        </div>
      ) : null}

      {!loading && sections.length === 0 && !error ? (
        <p className="text-sm text-gray-500">No sections cached — refresh the app data</p>
      ) : null}

      {!loading && sections.length > 0 && total === 0 ? (
        <p className="mb-4 text-sm text-gray-500">
          No young people found with a parent who is a leader
        </p>
      ) : null}

      {sections.map((section) => {
        const unavailable = needsFinanceScope
          ? 'Sign in to see'
          : !section.permissionsSynced
            ? 'Permissions not synced — refresh the app data'
            : !section.canView
              ? 'No finance access'
              : sectionErrors[section.sectionId]?.message;
        return (
          <SectionCard
            key={section.sectionId}
            section={section}
            summary={summaries[section.sectionId]}
            isLoading={loadingSectionId === section.sectionId}
            unavailable={unavailable}
          />
        );
      })}
    </div>
  );
}

export default LeadersChildrenPage;
