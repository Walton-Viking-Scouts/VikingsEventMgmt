import React, { useMemo } from 'react';

const SectionCardsFlexMasonry = ({ sections, isYoungPerson }) => {
  const { columns } = useMemo(() => {
    // Responsive column count based on screen width
    const getColumnCount = () => {
      if (typeof window === 'undefined') return 1;
      const width = window.innerWidth;
      if (width >= 1024) return 3; // lg
      if (width >= 768) return 2;  // md
      return 1; // base
    };

    const columnCount = getColumnCount();
    
    // Smart distribution algorithm - places each card in the shortest column
    const distributeCards = (cards, numColumns) => {
      const columns = Array(numColumns).fill(null).map(() => ({
        cards: [],
        height: 0,
      }));

      // Calculate estimated height for each section based on member count
      const getEstimatedHeight = (section) => {
        const headerHeight = 64; // Header height estimate
        const memberHeight = 32;  // Each member row height estimate
        return headerHeight + (section.members.length * memberHeight);
      };

      // Place each section in the column with minimum height
      cards.forEach(section => {
        const estimatedHeight = getEstimatedHeight(section);
        
        // Find column with minimum height
        const shortestColumn = columns.reduce(
          (min, col) => (col.height < min.height ? col : min),
          columns[0],
        );
        
        shortestColumn.cards.push(section);
        shortestColumn.height += estimatedHeight;
      });

      return columns;
    };

    const distributedColumns = distributeCards(sections, columnCount);
    
    return {
      columns: distributedColumns,
    };
  }, [sections]);

  return (
    <div 
      className="flex gap-4 w-full"
      role="region"
      aria-label="Section attendance cards in masonry layout"
      data-oid="section-cards"
    >
      {columns.map((column, columnIndex) => (
        <div 
          key={columnIndex} 
          className="flex-1 flex flex-col gap-4"
          style={{ minHeight: 0 }} // Allows flex child to shrink
        >
          {column.cards.map((section) => (
            <div
              key={section.sectionid}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              role="article"
              aria-labelledby={`section-title-${section.sectionid}`}
              aria-describedby={`section-stats-${section.sectionid}`}
            >
              {/* Section header */}
              <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h4 
                    id={`section-title-${section.sectionid}`}
                    className="text-lg font-semibold text-gray-900"
                  >
                    {section.sectionname}
                  </h4>
                  <div 
                    id={`section-stats-${section.sectionid}`}
                    className="flex gap-3 text-sm text-gray-600"
                  >
                    <span>{section.members.length} total</span>
                    <span>•</span>
                    <span>{section.youngPeopleCount} YP</span>
                    <span>•</span>
                    <span>{section.adultsCount} adults</span>
                  </div>
                </div>
              </div>

              {/* Section members */}
              <div className="divide-y divide-gray-200">
                {section.members.map((member, memberIndex) => (
                  <div
                    key={`${section.sectionid}-${member.scoutid || memberIndex}`}
                    className="px-4 py-1 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {member.firstname} {member.lastname}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        isYoungPerson(member.age)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {isYoungPerson(member.age) ? 'YP' : 'Adult'}
                      </span>
                      <div className="text-sm text-gray-500 w-16 text-right">
                        {member.age || 'N/A'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default SectionCardsFlexMasonry;