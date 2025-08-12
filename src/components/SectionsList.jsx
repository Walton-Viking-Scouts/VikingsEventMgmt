import React from 'react';
import { Button, Card, Badge } from './ui';

function SectionsList({
  sections,
  selectedSections = [],
  onSectionToggle,
  onContinueToEvents,
  showContinueButton = true,
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
    <Card className="border-0 shadow-none">
      <Card.Header className="border-b-0">
        <Card.Title>Select Sections</Card.Title>
      </Card.Header>

      <Card.Body>
        <div className="flex flex-wrap justify-center" style={{ gap: '30px' }}>
          {sortedSections.map((section) => {
            const isSelected = isSectionSelected(section.sectionid);
            const isLoading = loadingSection === section.sectionid;
            const sectionType = section.section.toLowerCase();

            // Determine background color based on section type
            let bgColor, hoverBgColor;
            if (sectionType.includes('earlyyears')) {
              bgColor = 'var(--scout-red)';
              hoverBgColor = 'var(--scout-red-dark)';
            } else if (sectionType.includes('beavers')) {
              bgColor = 'var(--scout-blue)';
              hoverBgColor = 'var(--scout-blue-dark)';
            } else if (sectionType.includes('cubs')) {
              bgColor = 'var(--scout-forest-green)';
              hoverBgColor = 'var(--scout-forest-green-dark)';
            } else if (sectionType.includes('scouts')) {
              bgColor = 'var(--scout-navy)';
              hoverBgColor = 'var(--scout-navy-dark)';
            } else if (sectionType.includes('adults')) {
              bgColor = 'var(--scout-purple)';
              hoverBgColor = 'var(--scout-purple-dark)';
            } else if (sectionType.includes('waitinglist')) {
              bgColor = 'var(--scout-teal)';
              hoverBgColor = 'var(--scout-teal-dark)';
            } else {
              bgColor = 'var(--scout-purple)';
              hoverBgColor = 'var(--scout-purple-dark)';
            }

            return (
              <button
                key={section.sectionid}
                onClick={() => onSectionToggle(section)}
                disabled={isLoading}
                style={{
                  padding: '10px',
                  backgroundColor: isSelected ? hoverBgColor : bgColor,
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  minWidth: '120px',
                  opacity: isLoading ? 0.6 : isSelected ? 1 : 0.8,
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
                    e.target.style.backgroundColor = hoverBgColor;
                    e.target.style.opacity = 1;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.target.style.backgroundColor = isSelected
                      ? hoverBgColor
                      : bgColor;
                    e.target.style.opacity = isSelected ? 1 : 0.8;
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

      {selectedSections.length > 0 && showContinueButton && (
        <Card.Footer className="text-center">
          <Button
            variant="scout-green"
            size="lg"
            onClick={onContinueToEvents}
            className="flex items-center justify-center gap-2"
          >
            <span>Continue to Events</span>
            <Badge variant="outline-scout-green" className="bg-white">
              {selectedSections.length} section
              {selectedSections.length === 1 ? '' : 's'}
            </Badge>
          </Button>
        </Card.Footer>
      )}
    </Card>
  );
}

export default SectionsList;
