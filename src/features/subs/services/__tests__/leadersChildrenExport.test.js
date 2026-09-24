import { describe, it, expect } from 'vitest';
import { buildLeadersChildrenCsvRows, leadersChildrenCsvFilename } from '../leadersChildrenExport.js';

const leader = (scoutId, name, sectionNames, matchedOn) => ({
  scoutId,
  name,
  matchedOn,
  sections: sectionNames.map((sectionName, index) => ({ sectionId: String(index), sectionName })),
});

const SECTIONS = [
  {
    sectionId: '1',
    sectionName: 'Beavers',
    canView: true,
    permissionsSynced: true,
    children: [
      {
        scoutId: '200', firstName: 'Amy', lastName: 'Doe',
        parents: [
          { contact: 'Primary contact 1', name: 'Jane Doe', leaders: [leader('100', 'Jane Doe', ['Cubs', 'Adults'], ['name'])] },
          { contact: 'Primary contact 2', name: 'Jon "JD" Doe', leaders: [leader('101', 'Jonathan Doe', ['Scouts'], ['email'])] },
        ],
      },
    ],
  },
  { sectionId: '2', sectionName: 'Cubs', canView: true, permissionsSynced: true, children: [] },
  {
    sectionId: '4',
    sectionName: 'Scouts',
    canView: false,
    permissionsSynced: true,
    children: [
      {
        scoutId: '300', firstName: 'Cal', lastName: 'Roe',
        parents: [{ contact: 'Primary contact 1', name: 'Jo Roe', leaders: [leader('102', 'Jo Roe', ['Beavers'], ['name', 'email'])] }],
      },
    ],
  },
];

const SUMMARIES = {
  1: { schemes: [{ name: 'Leaders Subs', members: [{ scoutId: '200' }] }, { name: 'Beavers Subs', members: [{ scoutId: '200' }] }] },
};

const CONTEXT = { needsFinanceScope: false, sectionErrors: {} };

describe('buildLeadersChildrenCsvRows', () => {
  it('writes a header and one row per child, parent contact and leader across sections', () => {
    const rows = buildLeadersChildrenCsvRows(SECTIONS, SUMMARIES, CONTEXT);

    expect(rows).toEqual([
      '"Section","First name","Last name","Parent contact","Parent name","Leader name","Leader sections","Matched on","Subs group","Subs schemes"',
      '"Beavers","Amy","Doe","Primary contact 1","Jane Doe","Jane Doe","Cubs; Adults","name","Leaders","Leaders Subs; Beavers Subs"',
      '"Beavers","Amy","Doe","Primary contact 2","Jon ""JD"" Doe","Jonathan Doe","Scouts","email","Leaders","Leaders Subs; Beavers Subs"',
      '"Scouts","Cal","Roe","Primary contact 1","Jo Roe","Jo Roe","Beavers","name and email","No finance access",""',
    ]);
  });

  it('says why subs are missing instead of leaving the group blank', () => {
    const noScope = buildLeadersChildrenCsvRows(SECTIONS, SUMMARIES, { needsFinanceScope: true, sectionErrors: {} });
    expect(noScope[1]).toContain('"Sign in to see"');

    const notLoaded = buildLeadersChildrenCsvRows(SECTIONS, {}, CONTEXT);
    expect(notLoaded[1]).toContain('"Not loaded"');

    const localError = buildLeadersChildrenCsvRows(SECTIONS, {}, {
      needsFinanceScope: false,
      sectionErrors: { 1: { message: 'No current term for Beavers' } },
    });
    expect(localError[1]).toContain('"No current term for Beavers"');
  });

  it('reports Not set up for a child in no subs scheme', () => {
    const rows = buildLeadersChildrenCsvRows(SECTIONS, { 1: { schemes: [] } }, CONTEXT);
    expect(rows[1].endsWith('"Not set up",""')).toBe(true);
  });
});

describe('leadersChildrenCsvFilename', () => {
  it('is dated with the local date', () => {
    expect(leadersChildrenCsvFilename(new Date(2026, 8, 4))).toBe('leaders_children_2026-09-04.csv');
  });
});
