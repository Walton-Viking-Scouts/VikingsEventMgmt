import React from 'react';

function SectionsList({ sections, selectedSections = [], onSectionToggle, onContinueToEvents }) {
  if (!sections || sections.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">No Sections Available</h2>
        <p className="text-muted">
          No sections found for your account. Please check your OSM permissions.
        </p>
      </div>
    );
  }

  const isSectionSelected = (sectionId) => {
    return selectedSections.some(s => s.sectionid === sectionId);
  };

  const getSectionColorClass = (sectionType) => {
    const type = sectionType.toLowerCase();
    if (type.includes('earlyyears')) return 'scout-red';     // Squirrels
    if (type.includes('beavers')) return 'scout-blue';
    if (type.includes('cubs')) return 'scout-forest-green';
    if (type.includes('scouts')) return 'scout-blue-dark';   // Navy-like color
    if (type.includes('adults') || type.includes('waitinglist')) return null; // White/default
    return null; // Default to white for any unknown sections
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Select Sections</h2>
        <div className="badge badge-primary">{sections.length} section{sections.length !== 1 ? 's' : ''} available</div>
      </div>
      
      <div className="sections-grid">
        {sections.map((section) => {
          const isSelected = isSectionSelected(section.sectionid);
          const colorClass = getSectionColorClass(section.section); // Use section type field
          const buttonClass = colorClass 
            ? (isSelected ? `btn-${colorClass}` : `btn-outline-${colorClass}`)
            : (isSelected ? 'btn-primary' : 'btn-outline-primary'); // Default white for adults/waitinglist
          
          return (
            <button
              key={section.sectionid}
              className={`section-button btn ${buttonClass} btn-lg m-2`}
              onClick={() => onSectionToggle(section)}
              type="button"
            >
              <i className="fas fa-users me-2"></i>
              <div className="fw-bold">{section.sectionname}</div>
            </button>
          );
        })}
      </div>

      {selectedSections.length > 0 && (
        <div className="card-footer text-center">
          <button
            className="btn btn-scout-green btn-lg"
            onClick={onContinueToEvents}
            type="button"
          >
            <i className="fas fa-arrow-right me-2"></i>
            Continue to Events
            <span className="badge bg-light text-dark ms-2">
              {selectedSections.length} section{selectedSections.length === 1 ? '' : 's'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default SectionsList;