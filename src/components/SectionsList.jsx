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
            const sectionType = section.section.toLowerCase();

            // Determine background color based on section type
            let bgColor;
            if (sectionType.includes('earlyyears')) {
              bgColor = 'var(--scout-red)';
            } else if (sectionType.includes('beavers')) {
              bgColor = 'var(--scout-blue)';
            } else if (sectionType.includes('cubs')) {
              bgColor = 'var(--scout-forest-green)';
            } else if (sectionType.includes('scouts')) {
              bgColor = 'var(--scout-navy)';
            } else if (sectionType.includes('adults')) {
              bgColor = 'var(--scout-purple)';
            } else if (sectionType.includes('waitinglist')) {
              bgColor = 'var(--scout-teal)';
            } else {
              bgColor = 'var(--scout-purple)';
            }

            return (
              <button
                key={section.sectionid}
                onClick={() => onSectionToggle(section)}
                disabled={isLoading}
                style={{
                  padding: '10px',
                  backgroundColor: isSelected ? bgColor : 'white',
                  color: isSelected ? 'white' : bgColor,
                  border: `2px solid ${bgColor}`,
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  minWidth: '120px',
                  opacity: isLoading ? 0.6 : 1,
                  transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.target.style.backgroundColor = bgColor;
                    e.target.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.target.style.backgroundColor = isSelected ? bgColor : 'white';
                    e.target.style.color = isSelected ? 'white' : bgColor;
                    e.target.style.border = `2px solid ${bgColor}`;
                  }
                }}
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
