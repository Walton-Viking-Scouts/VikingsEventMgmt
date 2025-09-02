export const SECTION_TYPE_MAPPING = {
  'earlyyears': 'Squirrels',
  'squirrels': 'Squirrels', 
  'beavers': 'Beavers',
  'cubs': 'Cubs',
  'scouts': 'Scouts',
  'explorers': 'Explorers',
};

export function mapSectionType(sectionType) {
  if (!sectionType) return 'Unknown';
  const normalized = sectionType.toLowerCase();
  return SECTION_TYPE_MAPPING[normalized] || sectionType;
}

export function groupSectionsByType(sectionSummaries, sectionsData) {
  const grouped = new Map();
  
  const summariesArray = Array.from(sectionSummaries.values());
  
  summariesArray.forEach(summary => {
    const section = sectionsData.find(s => s.sectionid === summary.sectionId);
    const sectionType = mapSectionType(section?.sectiontype || getSectionTypeFromName(summary.sectionName));
    
    if (!grouped.has(sectionType)) {
      grouped.set(sectionType, {
        type: sectionType,
        sections: [],
        totalIncoming: 0,
        totalOutgoing: 0,
        totalCurrent: 0,
        totalRemaining: 0,
      });
    }
    
    const group = grouped.get(sectionType);
    group.sections.push(summary);
    group.totalIncoming += summary.incomingMovers.length;
    group.totalOutgoing += summary.outgoingMovers.length;
    group.totalCurrent += summary.currentMembers.length;
    group.totalRemaining += summary.remainingCount;
  });
  
  return grouped;
}

function getSectionTypeFromName(sectionName) {
  if (!sectionName) return null;
  
  const normalized = sectionName.toLowerCase();
  
  if (normalized.includes('squirrel') || normalized.includes('early')) return 'squirrels';
  if (normalized.includes('beaver')) return 'beavers';
  if (normalized.includes('cub')) return 'cubs';
  if (normalized.includes('scout')) return 'scouts';
  if (normalized.includes('explorer')) return 'explorers';
  
  return null;
}

export function calculateGroupTotals(movers, groupedSections) {
  const groupTotals = new Map();
  
  groupedSections.forEach((group, sectionType) => {
    const incomingFromPrevious = movers.filter(mover => 
      mover.targetSection && mapSectionType(mover.targetSection.toLowerCase()) === sectionType
    ).length;
    
    const outgoingToNext = group.totalOutgoing;
    
    groupTotals.set(sectionType, {
      incoming: incomingFromPrevious,
      outgoing: outgoingToNext,
    });
  });
  
  return groupTotals;
}