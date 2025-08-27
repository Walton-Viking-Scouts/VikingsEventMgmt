import React from 'react';
import { Card } from './ui';
import MembersList from './MembersList.jsx';

function SectionsList({
  sections,
  selectedSections = [],
  onSectionToggle,
  loadingSection = null,
}) {
  if (!sections || sections.length === 0) {
    return (
      <Card>
        <Card.Body className="text-center p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No Sections Available
          </h2>
          <p className="text-gray-600">
            No sections found for your account. Please check your OSM
            permissions.
          </p>
        </Card.Body>
      </Card>
    );
  }

  const isSectionSelected = (sectionId) => {
    return selectedSections.some((s) => s.sectionid === sectionId);
  };

  const getSectionOrder = (sectionType) => {
    const type = sectionType.toLowerCase();
    if (type.includes('earlyyears')) return 1;
    if (type.includes('beavers')) return 2;
    if (type.includes('cubs')) return 3;
    if (type.includes('scouts')) return 4;
    if (type.includes('adults')) return 5;
    if (type.includes('waitinglist')) return 6;
    return 7; // Unknown sections at the end
  };

  const getDayOrder = (sectionName) => {
    const name = sectionName.toLowerCase();
    if (name.includes('monday')) return 1;
    if (name.includes('tuesday')) return 2;
    if (name.includes('wednesday')) return 3;
    if (name.includes('thursday')) return 4;
    if (name.includes('friday')) return 5;
    if (name.includes('saturday')) return 6;
    if (name.includes('sunday')) return 7;
    return 8; // No day mentioned - put at end
  };

  const sortedSections = [...sections].sort((a, b) => {
    const sectionOrderA = getSectionOrder(a.section);
    const sectionOrderB = getSectionOrder(b.section);

    // First sort by section type
    if (sectionOrderA !== sectionOrderB) {
      return sectionOrderA - sectionOrderB;
    }

    // Then sort by day of the week within same section type
    return getDayOrder(a.sectionname) - getDayOrder(b.sectionname);
  });

  return (
    <Card>
      <Card.Header>
        <Card.Title>Select Sections</Card.Title>
      </Card.Header>

      <Card.Body>
        <div className="flex flex-wrap justify-center" style={{ gap: '30px' }}>
          {sortedSections.map((section) => {
            const isSelected = isSectionSelected(section.sectionid);
            const isLoading = loadingSection === section.sectionid;
            const sectionType = (section.section || section.sectionname || '').toLowerCase();

            // Determine section color classes
            let sectionColorClass, hoverColorClass;
            if (sectionType.includes('earlyyears')) {
              sectionColorClass = isSelected ? 'bg-scout-red text-white border-scout-red' : 'bg-white text-scout-red border-scout-red';
              hoverColorClass = 'hover:bg-scout-red hover:text-white';
            } else if (sectionType.includes('beavers')) {
              sectionColorClass = isSelected ? 'bg-scout-blue text-white border-scout-blue' : 'bg-white text-scout-blue border-scout-blue';
              hoverColorClass = 'hover:bg-scout-blue hover:text-white';
            } else if (sectionType.includes('cubs')) {
              sectionColorClass = isSelected ? 'bg-scout-forest-green text-white border-scout-forest-green' : 'bg-white text-scout-forest-green border-scout-forest-green';
              hoverColorClass = 'hover:bg-scout-forest-green hover:text-white';
            } else if (sectionType.includes('scouts')) {
              sectionColorClass = isSelected ? 'bg-scout-navy text-white border-scout-navy' : 'bg-white text-scout-navy border-scout-navy';
              hoverColorClass = 'hover:bg-scout-navy hover:text-white';
            } else if (sectionType.includes('adults')) {
              sectionColorClass = isSelected ? 'bg-scout-purple text-white border-scout-purple' : 'bg-white text-scout-purple border-scout-purple';
              hoverColorClass = 'hover:bg-scout-purple hover:text-white';
            } else if (sectionType.includes('waitinglist')) {
              sectionColorClass = isSelected ? 'bg-scout-teal text-white border-scout-teal' : 'bg-white text-scout-teal border-scout-teal';
              hoverColorClass = 'hover:bg-scout-teal hover:text-white';
            } else {
              sectionColorClass = isSelected ? 'bg-scout-purple text-white border-scout-purple' : 'bg-white text-scout-purple border-scout-purple';
              hoverColorClass = 'hover:bg-scout-purple hover:text-white';
            }

            return (
              <button
                key={section.sectionid}
                onClick={() => onSectionToggle(section)}
                type="button"
                disabled={isLoading}
                className={`
                  p-2.5 border-2 rounded text-xs font-medium min-w-[120px] 
                  flex items-center justify-center gap-2
                  transition-all duration-200 ease-in-out
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-scout-blue
                  ${sectionColorClass}
                  ${!isLoading ? hoverColorClass : ''}
                  ${isLoading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                  ${isSelected ? 'transform scale-105 shadow-lg' : 'transform scale-100'}
                `}
              >
                {isLoading && (
                  <svg
                    className="animate-spin h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    ></path>
                  </svg>
                )}
                {isLoading ? 'Loading...' : section.sectionname}
              </button>
            );
          })}
        </div>
      </Card.Body>

      {/* Members Area - Show when sections are selected */}
      {selectedSections && selectedSections.length > 0 && (
        <Card.Body className="border-t border-gray-200 bg-gray-50">
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              Members from {selectedSections.length} section{selectedSections.length === 1 ? '' : 's'}
            </h4>
            <p className="text-sm text-gray-600">
              {selectedSections.map(s => s.sectionname).join(', ')}
            </p>
          </div>
          
          {/* Embedded Members List */}
          <div className="bg-white rounded-lg border border-gray-200">
            <MembersList
              embedded={true}
              showHeader={false}
              sections={selectedSections}
            />
          </div>
        </Card.Body>
      )}
    </Card>
  );
}

export default SectionsList;
