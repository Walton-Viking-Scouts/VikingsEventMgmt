import React from 'react';

function SectionsList({ sections, onSectionSelect }) {
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

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Select a Section</h2>
        <div className="badge badge-primary">{sections.length} section{sections.length !== 1 ? 's' : ''}</div>
      </div>
      
      <div className="list-group">
        {sections.map((section) => (
          <div 
            key={section.sectionid}
            className="list-item"
            onClick={() => onSectionSelect(section)}
          >
            <div>
              <div className="fw-bold">{section.sectionname}</div>
              <div className="text-muted">{section.section}</div>
            </div>
            <div className="d-flex align-items-center gap-2">
              {section.isDefault && (
                <span className="badge badge-success">Default</span>
              )}
              <span className="text-muted">→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SectionsList;