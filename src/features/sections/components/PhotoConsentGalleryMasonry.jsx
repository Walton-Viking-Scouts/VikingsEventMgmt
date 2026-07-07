import React, { useMemo } from 'react';
import MemberAvatar from '../../../shared/components/ui/MemberAvatar.jsx';

const RESPONSIVE_BREAKPOINTS = {
  LARGE: 1024,
  MEDIUM: 768,
};

const COLUMN_COUNTS = {
  LARGE: 3,
  MEDIUM: 2,
  BASE: 1,
};

const GRID_COLUMNS_PER_CARD = 3;

const HEIGHT_ESTIMATES = {
  HEADER: 64,
  PHOTO_ROW: 140,
};

/**
 * Estimate a section card's rendered height (header + photo grid rows) so
 * cards can be distributed into masonry columns without a layout pass.
 *
 * @param {{members: Array}} section
 * @returns {number} Estimated height in pixels.
 */
function estimateCardHeight(section) {
  const rows = Math.ceil(section.members.length / GRID_COLUMNS_PER_CARD) || 1;
  return HEIGHT_ESTIMATES.HEADER + rows * HEIGHT_ESTIMATES.PHOTO_ROW;
}

/**
 * @returns {number} The masonry column count for the current viewport width.
 */
function getColumnCount() {
  if (typeof window === 'undefined') return COLUMN_COUNTS.BASE;
  const width = window.innerWidth;
  if (width >= RESPONSIVE_BREAKPOINTS.LARGE) return COLUMN_COUNTS.LARGE;
  if (width >= RESPONSIVE_BREAKPOINTS.MEDIUM) return COLUMN_COUNTS.MEDIUM;
  return COLUMN_COUNTS.BASE;
}

/**
 * Photo Consent Gallery Masonry
 *
 * Arranges one card per section into flex-masonry columns, using the same
 * shortest-column distribution approach as the attendance brick cards (see
 * shared/components/ui/SectionCardsFlexMasonry.jsx). Unlike the attendance
 * cards, each card renders a photo-first grid — a large avatar and name only,
 * with no age/patrol/medical data — so social media volunteers can instantly
 * see who must not appear in photos.
 *
 * @component
 * @param {Object} props
 * @param {Array<{sectionid: (string|number), sectionname: string, members: Array<Object>}>} props.sections
 *   Section groups, as produced by groupNoConsentMembersBySection.
 * @returns {JSX.Element}
 */
function PhotoConsentGalleryMasonry({ sections }) {
  const columns = useMemo(() => {
    const columnCount = getColumnCount();
    const columns = Array.from({ length: columnCount }, () => ({ cards: [], height: 0 }));

    sections.forEach((section) => {
      const shortestColumn = columns.reduce(
        (min, col) => (col.height < min.height ? col : min),
        columns[0],
      );
      shortestColumn.cards.push(section);
      shortestColumn.height += estimateCardHeight(section);
    });

    return columns;
  }, [sections]);

  return (
    <div
      className="flex gap-4 w-full"
      role="region"
      aria-label="Photo consent gallery cards in masonry layout"
    >
      {columns.map((column, columnIndex) => (
        <div
          key={columnIndex}
          className="flex-1 flex flex-col gap-4"
          style={{ minHeight: 0 }}
        >
          {column.cards.map((section) => {
            const sectionKey = section.sectionid ?? section.sectionname;
            return (
              <div
                key={sectionKey}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                role="article"
                aria-labelledby={`photo-consent-section-${sectionKey}`}
              >
                <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <h4
                    id={`photo-consent-section-${sectionKey}`}
                    className="text-lg font-semibold text-gray-900"
                  >
                    {section.sectionname}
                  </h4>
                  <span className="text-sm text-gray-600">
                    {section.members.length} member{section.members.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-4">
                  {section.members.map((member) => (
                    <div key={member.scoutid} className="flex flex-col items-center text-center gap-2">
                      <MemberAvatar member={member} size="xl" />
                      <span className="text-sm text-gray-900">
                        {member.firstname} {member.lastname}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default PhotoConsentGalleryMasonry;
