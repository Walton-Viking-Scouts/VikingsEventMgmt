import { describe, it, expect } from 'vitest';
import { calculateSectionMovements, groupMoversByTargetSection } from '../movementCalculator.js';

describe('calculateSectionMovements', () => {
  const termStart = '2024-01-01';
  
  const mockMembers = [
    {
      member_id: 1,
      first_name: 'Alice',
      last_name: 'Smith',
      date_of_birth: '2015-10-01', // 8+ years old, moves from Beavers to Cubs
      section_id: 10,
      sectionname: 'Wednesday Beavers',
    },
    {
      member_id: 2,
      first_name: 'Bob',
      last_name: 'Jones',
      date_of_birth: '2015-11-01', // 8+ years old, moves from Beavers to Cubs  
      section_id: 11,
      sectionname: 'Thursday Beavers',
    },
    {
      member_id: 3,
      first_name: 'Charlie',
      last_name: 'Brown',
      date_of_birth: '2017-06-01', // 6-7 years old, stays in Beavers
      section_id: 10,
      sectionname: 'Wednesday Beavers',
    },
    {
      member_id: 4,
      first_name: 'Diana',
      last_name: 'Lee',
      date_of_birth: '2013-01-01', // 10.5+ years old, moves from Cubs to Scouts
      section_id: 20,
      sectionname: 'Monday Cubs',
    },
  ];

  it('identifies movers correctly', () => {
    const result = calculateSectionMovements(mockMembers, termStart);
    
    expect(result.movers).toHaveLength(3);
    
    const aliceMovement = result.movers.find(m => m.name === 'Alice Smith');
    expect(aliceMovement.shouldMove).toBe(true);
    expect(aliceMovement.targetSection).toBe('Cubs');
    
    const bobMovement = result.movers.find(m => m.name === 'Bob Jones');
    expect(bobMovement.shouldMove).toBe(true);
    expect(bobMovement.targetSection).toBe('Cubs');
    
    const dianaMovement = result.movers.find(m => m.name === 'Diana Lee');
    expect(dianaMovement.shouldMove).toBe(true);
    expect(dianaMovement.targetSection).toBe('Scouts');
  });

  it('creates section summaries correctly', () => {
    const result = calculateSectionMovements(mockMembers, termStart);
    
    const wedBeavers = result.sectionSummaries.get(10);
    expect(wedBeavers.sectionName).toBe('Wednesday Beavers');
    expect(wedBeavers.currentMembers).toHaveLength(2); // Alice and Charlie
    expect(wedBeavers.outgoingMovers).toHaveLength(1); // Only Alice moves
    expect(wedBeavers.remainingCount).toBe(1); // Charlie remains
  });

  it('handles FlexiRecord data correctly', () => {
    // FlexiRecords only contain young people, so no filtering needed
    const result = calculateSectionMovements(mockMembers, termStart);
    
    expect(result.movers).toHaveLength(3);
    expect(result.movers.every(mover => mover.age > 0)).toBe(true);
  });
});

describe('groupMoversByTargetSection', () => {
  it('groups movers by target section', () => {
    const movers = [
      { name: 'Alice', targetSection: 'Cubs' },
      { name: 'Bob', targetSection: 'Cubs' },
      { name: 'Charlie', targetSection: 'Scouts' },
    ];
    
    const grouped = groupMoversByTargetSection(movers);
    
    expect(grouped.get('Cubs')).toHaveLength(2);
    expect(grouped.get('Scouts')).toHaveLength(1);
  });
});