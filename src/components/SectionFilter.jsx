import React from "react";

/**
 * SectionFilter - Reusable pill-based filter for sections
 * Provides toggle buttons for filtering by section similar to attendance status filters
 *
 * @param {Object} props - Component props
 * @param {Object} props.sectionFilters - Object mapping section IDs to boolean visibility
 * @param {Function} props.onFiltersChange - Callback when filters change
 * @param {Array} props.sections - Array of section objects with sectionid and sectionname
 * @param {string} props.className - Additional CSS classes
 */
function SectionFilter({
  sectionFilters,
  onFiltersChange,
  sections,
  className = "",
}) {
  if (!sections || sections.length === 0) {
    return null;
  }

  const handleFilterToggle = (sectionId) => {
    const newFilters = {
      ...sectionFilters,
      [sectionId]: !sectionFilters[sectionId],
    };
    onFiltersChange(newFilters);
  };

  // Get section color based on section type (matching dashboard colors)
  const getSectionColor = (section) => {
    // Try to determine section type from sectionname or section field
    const sectionType = (
      section.section ||
      section.sectionname ||
      ""
    ).toLowerCase();

    if (sectionType.includes("earlyyears"))
      return "bg-scout-red text-white border-scout-red";
    if (sectionType.includes("beavers"))
      return "bg-scout-blue text-white border-scout-blue";
    if (sectionType.includes("cubs"))
      return "bg-scout-forest-green text-white border-scout-forest-green";
    if (sectionType.includes("scouts"))
      return "bg-scout-navy text-white border-scout-navy";
    if (sectionType.includes("adults"))
      return "bg-scout-purple text-white border-scout-purple";
    if (sectionType.includes("waitinglist"))
      return "bg-scout-teal text-white border-scout-teal";

    // Default fallback to purple for unknown sections
    return "bg-scout-purple text-white border-scout-purple";
  };

  return (
    <div
      className={`flex gap-2 flex-wrap items-center ${className}`}
      role="group"
      aria-label="Section filters"
      data-oid="ne.l:5_"
    >
      {/* Individual section filters */}
      {sections.map((section) => {
        const isActive = sectionFilters[section.sectionid];
        const activeStyles = getSectionColor(section);
        const inactiveStyles =
          "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50";

        return (
          <button
            key={section.sectionid}
            onClick={() => handleFilterToggle(section.sectionid)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 hover:shadow-sm ${
              isActive ? activeStyles : inactiveStyles
            }`}
            type="button"
            aria-pressed={isActive}
            aria-label={`Filter by ${section.sectionname} section`}
            title={section.sectionname}
            data-oid="hakp:zy"
          >
            {section.sectionname}
          </button>
        );
      })}
    </div>
  );
}

export default SectionFilter;
