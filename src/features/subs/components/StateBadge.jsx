import React from 'react';

const STATE_STYLES = {
  'paid': { label: 'Paid', className: 'bg-green-100 text-green-800 border-green-200' },
  'in-progress': { label: 'In progress', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  'required': { label: 'Required', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  'not-started': { label: 'Not started', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  'not-required': { label: 'Not required', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

/**
 * Badge for one member's state on one payment.
 *
 * @param {object} props - Component props
 * @param {string} [props.state] - Derived payment state
 * @param {string} [props.latestStatus] - Raw OSM status, shown for unknown states
 * @returns {JSX.Element} A coloured state badge
 */
function StateBadge({ state, latestStatus }) {
  if (!state || state === 'not-applicable') {
    return (
      <span
        aria-label="Not applicable"
        className="inline-block h-4 w-6 rounded border border-dashed border-gray-300"
      />
    );
  }

  const known = STATE_STYLES[state];
  const label = known ? known.label : (latestStatus || state);
  const className = known ? known.className : 'bg-neutral-100 text-neutral-700 border-neutral-300';

  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

export default StateBadge;
