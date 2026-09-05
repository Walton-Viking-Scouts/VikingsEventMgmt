import React from 'react';

const SET_UP_STYLES = {
  'ready': { label: 'Ready', className: 'bg-green-100 text-green-800 border-green-200' },
  'no-direct-debit': { label: 'No DD', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  'not-applicable': { label: 'N/A', className: 'bg-slate-100 text-slate-500 border-slate-200' },
  'not-scheduled': { label: 'Not scheduled', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const TITLES = {
  'ready': 'Next term will be collected by direct debit',
  'no-direct-debit': 'Next term is scheduled but there is no active direct debit',
  'not-applicable': 'Next term’s payment does not apply to this member',
  'not-scheduled': 'This scheme has no next-term payment',
};

/**
 * Badge summarising whether next term's subs will be collected for a member.
 *
 * @param {object} props - Component props
 * @param {string} [props.nextSetUp] - One of ready, no-direct-debit, not-applicable, not-scheduled
 * @returns {JSX.Element} A coloured next-term badge
 */
function NextSetUpBadge({ nextSetUp }) {
  const style = SET_UP_STYLES[nextSetUp] ?? SET_UP_STYLES['not-scheduled'];
  const title = TITLES[nextSetUp] ?? TITLES['not-scheduled'];

  return (
    <span
      title={title}
      className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}

export default NextSetUpBadge;
