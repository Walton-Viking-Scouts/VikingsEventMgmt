import { describe, it, expect } from 'vitest';
import {
  findLeadersChildren,
  leaderEmails,
  normaliseEmail,
  normaliseName,
  parentContacts,
  subsGroupFor,
} from '../leadersChildrenModel.js';

const SECTIONS = [
  { sectionid: 1, sectionname: 'Beavers', sectiontype: 'beavers' },
  { sectionid: 2, sectionname: 'Cubs', sectiontype: 'cubs' },
  { sectionid: 3, sectionname: 'Adults', sectiontype: 'adults' },
];

/**
 * Builds a cached member with the given memberships and primary contacts.
 *
 * @param {object} fields - Member fields
 * @param {number} fields.scoutid - Scout id
 * @param {string} [fields.firstname] - First name
 * @param {string} [fields.lastname] - Last name
 * @param {Array<object>} fields.sections - Section memberships
 * @param {string[]} [fields.pc1] - Primary contact 1 first and last name
 * @param {string[]} [fields.pc2] - Primary contact 2 first and last name
 * @param {object} [fields.nested] - contact_groups contents
 * @returns {object} Cached member record
 */
function member({ scoutid, firstname, lastname, sections, pc1, pc2, nested }) {
  const record = { scoutid, firstname, lastname, sections, contact_groups: nested ?? {} };
  if (pc1) {
    record.primary_contact_1__first_name = pc1[0];
    record.primary_contact_1__last_name = pc1[1];
  }
  if (pc2) {
    record.primary_contact_2__first_name = pc2[0];
    record.primary_contact_2__last_name = pc2[1];
  }
  return record;
}

const membership = (sectionid, person_type) => ({ sectionid, person_type });

describe('normaliseName', () => {
  it('ignores case, accents, punctuation and spacing', () => {
    expect(normaliseName('  Zoë  O\'Brien-Smith ')).toBe('zoe obrien smith');
    expect(normaliseName(null)).toBe('');
  });
});

describe('parentContacts', () => {
  it('reads both primary contacts from flattened or nested fields', () => {
    const record = member({
      scoutid: 10,
      sections: [],
      pc1: ['Jane', 'Doe'],
      nested: { primary_contact_2__first_name: 'John', primary_contact_2__last_name: 'Doe' },
    });
    expect(parentContacts(record)).toEqual([
      { contact: 'Primary contact 1', name: 'Jane Doe', emails: [] },
      { contact: 'Primary contact 2', name: 'John Doe', emails: [] },
    ]);
  });

  it('keeps a contact with only an email, with its addresses normalised', () => {
    const record = {
      scoutid: 10,
      sections: [],
      primary_contact_1__email_1: ' Jen@Example.com ',
      primary_contact_1__email_2: 'jen@example.com',
    };
    expect(parentContacts(record)).toEqual([
      { contact: 'Primary contact 1', name: '', emails: ['jen@example.com'] },
    ]);
  });
});

describe('leaderEmails', () => {
  it('uses the leader\'s own addresses, not their contacts\'', () => {
    const record = {
      email: 'Lead@Example.com',
      member_contact__email_1: 'work@example.com',
      primary_contact_1__email_1: 'partner@example.com',
    };
    expect(leaderEmails(record)).toEqual(['lead@example.com', 'work@example.com']);
  });

  it('ignores values that are not addresses', () => {
    expect(normaliseEmail('n/a')).toBe('');
  });
});

describe('findLeadersChildren', () => {
  const members = [
    member({ scoutid: 100, firstname: 'Jane', lastname: 'Doe', sections: [membership(2, 'Leaders')] }),
    member({ scoutid: 101, firstname: 'Sam', lastname: 'Adult', sections: [membership(3, 'Young People')] }),
    member({ scoutid: 102, firstname: 'Yan', lastname: 'Leader', sections: [membership(1, 'Young Leaders')] }),
    member({
      scoutid: 200, firstname: 'Amy', lastname: 'Doe',
      sections: [membership(1, 'Young People')], pc1: ['jane', 'DOE'],
    }),
    member({
      scoutid: 201, firstname: 'Ben', lastname: 'Other',
      sections: [membership(2, 'Young People')], pc1: ['Pat', 'Other'], pc2: ['Sam', 'Adult'],
    }),
    member({
      scoutid: 202, firstname: 'Cal', lastname: 'Nope',
      sections: [membership(1, 'Young People')], pc1: ['Yan', 'Leader'],
    }),
  ];

  it('matches primary contacts to leaders in any section and to adults', () => {
    const result = findLeadersChildren({ sections: SECTIONS, members });

    expect(result.map((section) => section.sectionName)).toEqual(['Beavers', 'Cubs']);
    const [beavers, cubs] = result;
    expect(beavers.children).toHaveLength(1);
    expect(beavers.children[0]).toMatchObject({ scoutId: '200', firstName: 'Amy' });
    expect(beavers.children[0].parents).toEqual([
      {
        contact: 'Primary contact 1',
        name: 'jane DOE',
        emails: [],
        leaders: [{
          scoutId: '100', name: 'Jane Doe', sections: [{ sectionId: '2', sectionName: 'Cubs' }], matchedOn: ['name'],
        }],
      },
    ]);
    expect(cubs.children).toHaveLength(1);
    expect(cubs.children[0].parents[0]).toMatchObject({
      contact: 'Primary contact 2',
      leaders: [{ scoutId: '101', sections: [{ sectionId: '3', sectionName: 'Adults' }] }],
    });
  });

  it('matches on email when the names are spelt differently', () => {
    const withEmails = [
      { ...members[0], firstname: 'Jennifer', email: 'jen.doe@example.com' },
      {
        ...member({
          scoutid: 400, firstname: 'Eve', lastname: 'Doe',
          sections: [membership(1, 'Young People')], pc1: ['Jen', 'Doe'],
        }),
        primary_contact_1__email_1: 'JEN.DOE@example.com',
      },
    ];
    const [beavers] = findLeadersChildren({ sections: SECTIONS, members: withEmails });
    expect(beavers.children).toHaveLength(1);
    expect(beavers.children[0].parents[0].leaders).toEqual([
      expect.objectContaining({ scoutId: '100', name: 'Jennifer Doe', matchedOn: ['email'] }),
    ]);
  });

  it('records both reasons when name and email match the same leader', () => {
    const both = [
      { ...members[0], email: 'jane@example.com' },
      { ...members[3], primary_contact_1__email_1: 'jane@example.com' },
    ];
    const [beavers] = findLeadersChildren({ sections: SECTIONS, members: both });
    expect(beavers.children[0].parents[0].leaders).toHaveLength(1);
    expect(beavers.children[0].parents[0].leaders[0].matchedOn).toEqual(['name', 'email']);
  });

  it('does not treat Young Leaders as adult leaders', () => {
    const result = findLeadersChildren({ sections: SECTIONS, members });
    const ids = result.flatMap((section) => section.children.map((child) => child.scoutId));
    expect(ids).not.toContain('202');
  });

  it('lists a child under every section they are a young person in', () => {
    const twoSections = [
      members[0],
      member({
        scoutid: 300, firstname: 'Dee', lastname: 'Doe',
        sections: [membership(1, 'Young People'), membership(2, 'Young People')], pc1: ['Jane', 'Doe'],
      }),
    ];
    const result = findLeadersChildren({ sections: SECTIONS, members: twoSections });
    expect(result.map((section) => section.children.length)).toEqual([1, 1]);
  });
});

describe('subsGroupFor', () => {
  const summary = {
    schemes: [
      { name: 'Leaders Children Subs', members: [{ scoutId: '1' }] },
      { name: 'Beavers Subs', members: [{ scoutId: '1' }, { scoutId: '2' }] },
    ],
  };

  it('reports leaders when any scheme is a leaders scheme', () => {
    expect(subsGroupFor(summary, 1)).toEqual({
      group: 'leaders',
      schemeNames: ['Leaders Children Subs', 'Beavers Subs'],
    });
  });

  it('reports other for non-leaders schemes and none when not set up', () => {
    expect(subsGroupFor(summary, '2')).toEqual({ group: 'other', schemeNames: ['Beavers Subs'] });
    expect(subsGroupFor(summary, '3')).toEqual({ group: 'none', schemeNames: [] });
  });
});
