import React from 'react';

const BUCKETS = ['previous', 'current', 'next'];

const LABELS = {
  previous: 'Prev',
  current: 'Current',
  next: 'Next',
};

/**
 * Previous / current / next term set-up indicators for a section or scheme.
 *
 * @param {object} props - Component props
 * @param {{previous: boolean, current: boolean, next: boolean}} [props.coverage] - Per-bucket coverage
 * @param {{previous: object|null, current: object|null, next: object|null}} [props.terms] - Term buckets, for tooltips
 * @returns {JSX.Element} A row of labelled tick/cross markers
 */
function CoverageTicks({ coverage, terms }) {
  return (
    <div className="flex items-center gap-2" aria-label="Term set-up">
      {BUCKETS.map((bucket) => {
        const covered = Boolean(coverage?.[bucket]);
        const termName = terms?.[bucket]?.name;
        return (
          <span
            key={bucket}
            title={termName || LABELS[bucket]}
            className="inline-flex items-center gap-1 text-xs text-gray-600"
          >
            <span className="uppercase tracking-wide">{LABELS[bucket]}</span>
            <span
              aria-label={`${LABELS[bucket]} term ${covered ? 'set up' : 'not set up'}`}
              className={
                covered
                  ? 'inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-700'
                  : 'inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-gray-400'
              }
            >
              {covered ? '✓' : '–'}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default CoverageTicks;
