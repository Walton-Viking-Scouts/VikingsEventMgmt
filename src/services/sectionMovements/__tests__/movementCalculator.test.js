import { describe, it, expect } from 'vitest';
import { calculateSectionMovements, groupMoversByTargetSection } from '../movementCalculator.js';

describe('calculateSectionMovements', () => {
  const termStart = '2024-01-01';
  
  const mockMembers = [
    {
      scoutid: 1,
      firstname: 'Alice',
      lastname: 'Smith',
      date_of_birth: '2015-10-01',
      sectionid: 10,
      sectionname: 'Wednesday Beavers',
      person_type: 'Young People',
    },
    {
      scoutid: 2,
      firstname: 'Bob',
      lastname: 'Jones',
      date_of_birth: '2015-11-01',
      sectionid: 11,
      sectionname: 'Thursday Beavers',
      person_type: 'Young People',
    },
    {
      scoutid: 3,
      firstname: 'Charlie',
      lastname: 'Brown',
      date_of_birth: '2017-06-01',
      sectionid: 10,
      sectionname: 'Wednesday Beavers',
      person_type: 'Young People',
    },
    {
      scoutid: 4,
      firstname: 'Diana',
      lastname: 'Lee',
      date_of_birth: '2010-01-01',
      sectionid: 20,
      sectionname: 'Monday Cubs',
      person_type: 'Young People',
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
    expect(wedBeavers.currentMembers).toHaveLength(2);
    expect(wedBeavers.outgoingMovers).toHaveLength(1);
    expect(wedBeavers.remainingCount).toBe(1);
  });

  it('filters out non-young people', () => {
    const membersWithLeaders = [
      ...mockMembers,
      {
        scoutid: 5,
        firstname: 'Leader',
        lastname: 'Smith',
        date_of_birth: '1990-01-01',
        sectionid: 10,
        sectionname: 'Wednesday Beavers',
        person_type: 'Leaders',
      },
    ];
    
    const result = calculateSectionMovements(membersWithLeaders, termStart);
    
    expect(result.movers).toHaveLength(3);
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