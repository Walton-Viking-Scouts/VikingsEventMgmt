export const MemberMovementModel = {
  memberId: 'string',
  name: 'string',
  birthdate: 'Date',
  currentSection: 'string',
  currentSectionId: 'number',
  targetSection: 'string',
  age: 'number',
  ageAtTermStart: 'number',
  shouldMove: 'boolean',
  assignedSection: 'string?',
  assignedSectionId: 'number?',
};

export const SectionCapacityModel = {
  sectionId: 'number',
  name: 'string',
  meetingDay: 'string',
  currentCount: 'number',
  targetCapacity: 'number',
  remainingAfterMovements: 'number',
  incomingMovers: 'number',
  projectedCount: 'number',
  capacityStatus: 'good | warning | over',
};

export const MovementSummaryModel = {
  sectionId: 'number',
  sectionName: 'string',
  currentMembers: 'MemberMovementModel[]',
  outgoingMovers: 'MemberMovementModel[]',
  incomingMovers: 'MemberMovementModel[]',
  remainingCount: 'number',
  projectedCount: 'number',
};