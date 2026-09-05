import React from 'react';
import { formatPounds } from './formatPounds.js';
import {
  BUCKET_LABELS,
  BUCKETS,
  hasOverdue,
  bucketHeader,
  paymentBadge,
  formatDueDate,
  futurePaymentDates,
} from './termLabels.js';

/**
 * Two-line column heading: the bucket label over the term name (or a detail
 * such as "Not scheduled"), so the header stays narrow.
 *
 * @param {object} props - Component props
 * @param {'previous'|'current'|'next'} props.bucket - Term bucket
 * @param {object} [props.terms] - SectionSubsSummary.terms
 * @param {string} [props.detail] - Text shown instead of the term name
 * @returns {JSX.Element} Stacked heading text
 */
function BucketHeading({ bucket, terms, detail }) {
  const second = detail ?? terms?.[bucket]?.name;
  return (
    <span className="inline-flex flex-col leading-tight">
      <span>{BUCKET_LABELS[bucket]}</span>
      {second ? <span className="text-xs font-normal text-gray-500 whitespace-nowrap">{second}</span> : null}
    </span>
  );
}

/**
 * The payment badges for one member in one term bucket, or a muted dash when
 * the bucket holds no payments.
 *
 * @param {object} props - Component props
 * @param {Array<object>} [props.payments] - Payments in this bucket
 * @returns {JSX.Element} Badges or an empty marker
 */
function BucketCell({ payments }) {
  if (!payments || payments.length === 0) {
    return <span className="text-gray-300">–</span>;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {payments.map((payment) => {
        const badge = paymentBadge(payment);
        if (!badge) {
          return (
            <span key={payment.paymentId} title="No status from OSM yet" className="text-gray-300">
              –
            </span>
          );
        }
        return (
          <span
            key={payment.paymentId}
            title={`${payment.date} ${formatPounds(payment.amount)} ${payment.latestStatus || payment.state}`}
            className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        );
      })}
    </span>
  );
}

/**
 * One table for the whole section: a row per member and subs scheme, with a
 * column per term bucket so unpaid previous-term members stand out.
 *
 * @param {object} props - Component props
 * @param {Array<object>} props.members - SectionSubsSummary.members rows
 * @param {{previous: object|null, current: object|null, next: object|null}} [props.terms] - Term buckets
 * @param {object} props.termTotals - SectionSubsSummary.termTotals
 * @returns {JSX.Element} A horizontally scrollable section table
 */
function SectionMembersTable({ members, terms, termTotals }) {
  const rows = members ?? [];
  const futureDates = futurePaymentDates(rows);

  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th scope="col" rowSpan={2} className="px-4 py-2 font-medium align-bottom">Name</th>
              <th scope="col" rowSpan={2} className="px-4 py-2 font-medium align-bottom">YP</th>
              <th scope="col" rowSpan={2} className="px-4 py-2 font-medium align-bottom">Scheme</th>
              <th scope="col" rowSpan={2} className="px-4 py-2 font-medium align-bottom">DD</th>
              <th
                scope="col"
                rowSpan={2}
                className="px-4 py-2 font-medium align-bottom"
                aria-label={bucketHeader('previous', terms)}
              >
                <BucketHeading bucket="previous" terms={terms} />
              </th>
              <th
                scope="col"
                rowSpan={2}
                className="px-4 py-2 font-medium align-bottom"
                aria-label={bucketHeader('current', terms)}
              >
                <BucketHeading bucket="current" terms={terms} />
              </th>
              {futureDates.length === 0 ? (
                <th
                  scope="col"
                  rowSpan={2}
                  className="border-l border-gray-200 px-4 py-2 font-medium align-bottom"
                  aria-label="Next · Not scheduled"
                >
                  <BucketHeading bucket="next" terms={terms} detail="Not scheduled" />
                </th>
              ) : (
                <th
                  scope="colgroup"
                  colSpan={futureDates.length}
                  className="border-l border-gray-200 px-4 py-2 font-medium whitespace-nowrap"
                >
                  Future
                </th>
              )}
            </tr>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              {futureDates.map((date, index) => (
                <th
                  key={date}
                  scope="col"
                  className={`px-4 pb-2 font-medium whitespace-nowrap ${index === 0 ? 'border-l border-gray-200' : ''}`}
                >
                  {formatDueDate(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr
                key={`${row.scoutId}-${row.schemeId}`}
                className={hasOverdue(row) ? 'border-l-4 border-scout-red' : 'border-l-4 border-transparent'}
              >
                <td className="px-4 py-2 whitespace-nowrap text-gray-900">
                  {row.firstName} {row.lastName}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {row.isYP === null || row.isYP === undefined ? (
                    <span title="Not in cached members" aria-label="Not in cached members">?</span>
                  ) : (
                    row.isYP ? 'YP' : 'Adult'
                  )}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-gray-700">{row.schemeName}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      row.directDebit === 'Active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {row.directDebit === 'Active' ? 'Direct debit' : 'No direct debit'}
                  </span>
                </td>
                <td className="px-4 py-2"><BucketCell payments={row.buckets?.previous} /></td>
                <td className="px-4 py-2"><BucketCell payments={row.buckets?.current} /></td>
                {futureDates.length === 0 ? (
                  <td className="px-4 py-2"><BucketCell payments={[]} /></td>
                ) : (
                  futureDates.map((date) => (
                    <td key={date} className="px-4 py-2">
                      <BucketCell
                        payments={(row.buckets?.next ?? []).filter((payment) => payment.date === date)}
                      />
                    </td>
                  ))
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="border-t border-gray-200 px-4 py-2 text-xs text-gray-600">
        {BUCKETS.map((bucket, index) => {
          const stats = termTotals?.[bucket];
          return (
            <span key={bucket}>
              {index > 0 ? ' · ' : ''}
              {BUCKET_LABELS[bucket]}: {stats?.due?.members ?? 0} due · {stats?.unpaid?.members ?? 0} unpaid
              {' · '}{stats?.overdue?.members ?? 0} overdue ({formatPounds(stats?.overdue?.amount)})
            </span>
          );
        })}
      </footer>
    </section>
  );
}

export default SectionMembersTable;
