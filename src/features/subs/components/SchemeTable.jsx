import React from 'react';
import StateBadge from './StateBadge.jsx';
import CoverageTicks from './CoverageTicks.jsx';
import { formatPounds } from './formatPounds.js';

/**
 * Per-member payment table for one subs scheme, with a current-term column per
 * payment and a footer of unpaid / pending / paid counts.
 *
 * @param {object} props - Component props
 * @param {object} props.scheme - A scheme entry from SectionSubsSummary.schemes
 * @param {{previous: object|null, current: object|null, next: object|null}} [props.terms] - Term buckets
 * @returns {JSX.Element} A horizontally scrollable scheme table
 */
function SchemeTable({ scheme, terms }) {
  const paymentIds = scheme?.currentTerm?.paymentIds ?? [];
  const paymentsById = new Map((scheme?.payments ?? []).map((payment) => [payment.paymentId, payment]));
  const members = scheme?.members ?? [];

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 rounded-t-lg">
        <div>
          <h3 className="m-0 text-base font-semibold text-gray-900">{scheme.name}</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            {scheme.memberCount} members · {scheme.ypCount} YP · {scheme.noDirectDebitCount} without direct debit
          </p>
        </div>
        <CoverageTicks coverage={scheme.coverage} terms={terms} />
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th scope="col" className="px-4 py-2 font-medium">Member</th>
              <th scope="col" className="px-4 py-2 font-medium">Direct debit</th>
              {paymentIds.map((paymentId) => {
                const payment = paymentsById.get(paymentId);
                return (
                  <th key={paymentId} scope="col" className="px-4 py-2 font-medium whitespace-nowrap">
                    <span className="block">{payment?.date ?? paymentId}</span>
                    <span className="block text-gray-400">{formatPounds(payment?.amount)}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((member) => (
              <tr key={member.scoutId}>
                <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                  {member.firstName} {member.lastName}
                  {member.isYP === null || member.isYP === undefined ? (
                    <span
                      className="ml-2 text-xs text-gray-500"
                      title="Not in cached members"
                      aria-label="Not in cached members"
                    >
                      ?
                    </span>
                  ) : (
                    <span className="ml-2 text-xs text-gray-500">{member.isYP ? 'YP' : 'Adult'}</span>
                  )}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      member.directDebit === 'Active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {member.directDebit === 'Active' ? 'Direct debit' : 'No direct debit'}
                  </span>
                </td>
                {paymentIds.map((paymentId) => {
                  const cell = member.payments?.[paymentId];
                  return (
                    <td key={paymentId} className="px-4 py-2 whitespace-nowrap">
                      <StateBadge state={cell?.state} latestStatus={cell?.latestStatus} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="border-t border-gray-200 px-4 py-2 text-xs text-gray-600">
        Unpaid {scheme.currentTerm?.unpaid?.members ?? 0} ({formatPounds(scheme.currentTerm?.unpaid?.amount)})
        {' · '}Pending {scheme.currentTerm?.pending?.members ?? 0} ({formatPounds(scheme.currentTerm?.pending?.amount)})
        {' · '}Paid {scheme.currentTerm?.paidMembers ?? 0}
        {' · '}OSM overdue {formatPounds(scheme.amountOverdue)}
      </footer>
    </section>
  );
}

export default SchemeTable;
