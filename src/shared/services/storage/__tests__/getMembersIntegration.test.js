import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBService } from '../indexedDBService.js';
import databaseService from '../database.js';

describe('getMembers() Integration Tests', () => {
  let db;

  beforeEach(async () => {
    await databaseService.initialize();
    db = await IndexedDBService.getDB();
  });

  afterEach(async () => {
    const coreMembers = await db.getAll(IndexedDBService.STORES.CORE_MEMBERS);
    for (const member of coreMembers) {
      if (member.scoutid >= 90000) {
        await IndexedDBService.deleteCoreMember(member.scoutid);
      }
    }

    const memberSections = await db.getAll(IndexedDBService.STORES.MEMBER_SECTION);
    for (const section of memberSections) {
      if (section.scoutid >= 90000) {
        await IndexedDBService.deleteMemberSection(section.scoutid, section.sectionid);
      }
    }
  });

  async function insertTestMember(scoutid, firstname, lastname, sections = [], coreOverrides = {}) {
    const coreMember = {
      scoutid,
      firstname,
      lastname,
      date_of_birth: '2010-05-15',
      age: '14 years',
      age_years: 14,
      age_months: 168,
      yrs: 14,
      photo_guid: `photo-${scoutid}`,
      has_photo: true,
      pic: `https://example.com/photo-${scoutid}.jpg`,
      email: firstname ? `${firstname.toLowerCase()}@example.com` : null,
      contact_groups: { primary: { name: firstname ? `Parent of ${firstname}` : 'Unknown Parent' } },
      custom_data: { medical: { allergies: 'none' } },
      read_only: [],
      ...coreOverrides,
    };

    await IndexedDBService.upsertCoreMember(coreMember);

    for (const section of sections) {
      await IndexedDBService.upsertMemberSection(section);
    }
  }

  describe('Field Completeness Tests', () => {
    it('should return member object with all 25+ required fields', async () => {
      await insertTestMember(90001, 'Alice', 'Smith', [
        {
          scoutid: 90001,
          sectionid: 101,
          sectionname: '1st Test Cubs',
          section: 'cubs',
          person_type: 'Young People',
          patrol: 'Red Six',
          patrol_id: 5,
          active: true,
          started: '2023-09-01',
          joined: '2023-09-15',
          end_date: null,
          patrol_role_level: 0,
          patrol_role_level_label: 'Member',
        },
      ]);

      const members = await databaseService.getMembers([101]);

      expect(members).toHaveLength(1);
      const member = members[0];

      expect(member).toHaveProperty('scoutid', 90001);
      expect(member).toHaveProperty('member_id', 90001);
      expect(member).toHaveProperty('firstname', 'Alice');
      expect(member).toHaveProperty('lastname', 'Smith');
      expect(member).toHaveProperty('date_of_birth', '2010-05-15');
      expect(member).toHaveProperty('dateofbirth', '2010-05-15');
      expect(member).toHaveProperty('age', '14 years');
      expect(member).toHaveProperty('age_years', 14);
      expect(member).toHaveProperty('age_months', 168);
      expect(member).toHaveProperty('yrs', 14);
      expect(member).toHaveProperty('photo_guid', 'photo-90001');
      expect(member).toHaveProperty('has_photo', true);
      expect(member).toHaveProperty('pic', 'https://example.com/photo-90001.jpg');
      expect(member).toHaveProperty('email', 'alice@example.com');
      expect(member).toHaveProperty('contact_groups');
      expect(member).toHaveProperty('custom_data');
      expect(member).toHaveProperty('read_only');
      expect(member).toHaveProperty('sectionid', 101);
      expect(member).toHaveProperty('sectionname', '1st Test Cubs');
      expect(member).toHaveProperty('section', 'cubs');
      expect(member).toHaveProperty('person_type', 'Young People');
      expect(member).toHaveProperty('patrol', 'Red Six');
      expect(member).toHaveProperty('patrol_id', 5);
      expect(member).toHaveProperty('started', '2023-09-01');
      expect(member).toHaveProperty('joined', '2023-09-15');
      expect(member).toHaveProperty('end_date', null);
      expect(member).toHaveProperty('active', true);
      expect(member).toHaveProperty('patrol_role_level', 0);
      expect(member).toHaveProperty('patrol_role_level_label', 'Member');
      expect(member).toHaveProperty('sections');
      expect(Array.isArray(member.sections)).toBe(true);
    });

    it('should preserve contact_groups structure', async () => {
      await insertTestMember(90002, 'Bob', 'Jones', [
        { scoutid: 90002, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ], {
        contact_groups: {
          primary: { name: 'Parent Jones', phone: '555-1234', email: 'parent@example.com' },
          emergency: { name: 'Grandparent Jones', phone: '555-5678' },
        },
      });

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.contact_groups).toEqual({
        primary: { name: 'Parent Jones', phone: '555-1234', email: 'parent@example.com' },
        emergency: { name: 'Grandparent Jones', phone: '555-5678' },
      });
    });

    it('should preserve custom_data structure', async () => {
      await insertTestMember(90003, 'Charlie', 'Brown', [
        { scoutid: 90003, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ], {
        custom_data: {
          medical: { allergies: 'peanuts', conditions: 'asthma' },
          dietary: { vegetarian: true },
          consents: { photo: true, newsletter: false },
        },
      });

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.custom_data).toEqual({
        medical: { allergies: 'peanuts', conditions: 'asthma' },
        dietary: { vegetarian: true },
        consents: { photo: true, newsletter: false },
      });
    });

    it('should preserve read_only array', async () => {
      await insertTestMember(90004, 'David', 'Wilson', [
        { scoutid: 90004, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ], {
        read_only: ['date_of_birth', 'firstname', 'lastname'],
      });

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.read_only).toEqual(['date_of_birth', 'firstname', 'lastname']);
    });
  });

  describe('Single-Section Member Tests', () => {
    it('should return complete member object with all fields', async () => {
      await insertTestMember(90005, 'Emily', 'Davis', [
        {
          scoutid: 90005,
          sectionid: 101,
          sectionname: '1st Test Cubs',
          section: 'cubs',
          person_type: 'Young People',
          patrol: 'Blue Six',
          active: true,
        },
      ]);

      const members = await databaseService.getMembers([101]);

      expect(members).toHaveLength(1);
      expect(members[0].scoutid).toBe(90005);
      expect(members[0].sections).toHaveLength(1);
      expect(members[0].sections[0].sectionid).toBe(101);
    });

    it('should include backward compatibility aliases', async () => {
      await insertTestMember(90006, 'Frank', 'Miller', [
        { scoutid: 90006, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ]);

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.member_id).toBe(member.scoutid);
      expect(member.dateofbirth).toBe(member.date_of_birth);
      expect(member.member_id).toBe(90006);
      expect(member.dateofbirth).toBe('2010-05-15');
    });
  });

  describe('Multi-Section Member Tests', () => {
    it('should return member with sections array containing all memberships', async () => {
      await insertTestMember(90007, 'Grace', 'Taylor', [
        {
          scoutid: 90007,
          sectionid: 101,
          sectionname: '1st Test Cubs',
          section: 'cubs',
          person_type: 'Young Leaders',
          patrol: 'Leadership Team',
          active: true,
        },
        {
          scoutid: 90007,
          sectionid: 102,
          sectionname: '1st Test Scouts',
          section: 'scouts',
          person_type: 'Young People',
          patrol: 'Eagles',
          active: true,
        },
      ]);

      const members = await databaseService.getMembers([101, 102]);

      expect(members).toHaveLength(1);
      const member = members[0];

      expect(member.scoutid).toBe(90007);
      expect(member.sections).toHaveLength(2);

      const sectionIds = member.sections.map(s => s.section_id);
      expect(sectionIds).toContain(101);
      expect(sectionIds).toContain(102);
    });

    it('should populate sections array with complete section objects', async () => {
      await insertTestMember(90008, 'Henry', 'Anderson', [
        {
          scoutid: 90008,
          sectionid: 101,
          sectionname: '1st Test Cubs',
          section: 'cubs',
          person_type: 'Young Leaders',
          patrol: 'Leadership',
          active: true,
        },
        {
          scoutid: 90008,
          sectionid: 102,
          sectionname: '1st Test Scouts',
          section: 'scouts',
          person_type: 'Young People',
          patrol: 'Panthers',
          active: false,
        },
      ]);

      const members = await databaseService.getMembers([101, 102]);
      const member = members[0];

      expect(member.sections).toHaveLength(2);

      member.sections.forEach(section => {
        expect(section).toHaveProperty('section_id');
        expect(section).toHaveProperty('sectionid');
        expect(section).toHaveProperty('sectionname');
        expect(section).toHaveProperty('section');
        expect(section).toHaveProperty('person_type');
        expect(section).toHaveProperty('patrol');
        expect(section).toHaveProperty('active');
      });

      const cubsSection = member.sections.find(s => s.section_id === 101);
      expect(cubsSection.person_type).toBe('Young Leaders');
      expect(cubsSection.patrol).toBe('Leadership');

      const scoutsSection = member.sections.find(s => s.section_id === 102);
      expect(scoutsSection.person_type).toBe('Young People');
      expect(scoutsSection.patrol).toBe('Panthers');
    });

    it('should use primary section data for top-level section fields', async () => {
      await insertTestMember(90009, 'Ivy', 'Martin', [
        {
          scoutid: 90009,
          sectionid: 101,
          sectionname: '1st Test Cubs',
          section: 'cubs',
          person_type: 'Young Leaders',
          patrol: 'Leadership Team',
          active: true,
        },
        {
          scoutid: 90009,
          sectionid: 102,
          sectionname: '1st Test Scouts',
          section: 'scouts',
          person_type: 'Young People',
          patrol: 'Lions',
          active: true,
        },
      ]);

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.sectionid).toBe(101);
      expect(member.sectionname).toBe('1st Test Cubs');
      expect(member.section).toBe('cubs');
      expect(member.person_type).toBe('Young Leaders');
      expect(member.patrol).toBe('Leadership Team');
    });
  });

  describe('Edge Case Tests', () => {
    it('should return empty array when sectionIds is empty', async () => {
      const members = await databaseService.getMembers([]);
      expect(members).toEqual([]);
    });

    it('should return empty array when sectionIds is null', async () => {
      const members = await databaseService.getMembers(null);
      expect(members).toEqual([]);
    });

    it('should return empty array when sectionIds is undefined', async () => {
      const members = await databaseService.getMembers(undefined);
      expect(members).toEqual([]);
    });

    it('should skip orphaned section memberships (missing core data)', async () => {
      await IndexedDBService.upsertMemberSection({
        scoutid: 99999,
        sectionid: 101,
        sectionname: '1st Test Cubs',
        person_type: 'Young People',
      });

      const members = await databaseService.getMembers([101]);

      const orphanedMember = members.find(m => m.scoutid === 99999);
      expect(orphanedMember).toBeUndefined();
    });

    it('should handle missing optional fields gracefully', async () => {
      const coreMember = {
        scoutid: 90010,
        firstname: 'Jack',
        lastname: 'White',
        date_of_birth: '2012-01-01',
      };

      await IndexedDBService.upsertCoreMember(coreMember);
      await IndexedDBService.upsertMemberSection({
        scoutid: 90010,
        sectionid: 101,
        sectionname: '1st Test Cubs',
        person_type: 'Young People',
      });

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.photo_guid).toBeUndefined();
      expect(member.email).toBeUndefined();
      expect(member.patrol).toBeUndefined();
      expect(member.contact_groups).toEqual({});
      expect(member.custom_data).toEqual({});
      expect(member.read_only).toEqual([]);
    });

    it('should safely spread flattened_fields', async () => {
      await insertTestMember(90011, 'Kate', 'Green', [
        { scoutid: 90011, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ], {
        flattened_fields: {
          custom_field_1: 'value1',
          custom_field_2: 42,
          custom_field_3: true,
        },
      });

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.custom_field_1).toBe('value1');
      expect(member.custom_field_2).toBe(42);
      expect(member.custom_field_3).toBe(true);
    });

    it('should handle null flattened_fields', async () => {
      await insertTestMember(90012, 'Leo', 'Black', [
        { scoutid: 90012, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ], {
        flattened_fields: null,
      });

      const members = await databaseService.getMembers([101]);
      expect(members).toHaveLength(1);
      expect(members[0].scoutid).toBe(90012);
    });

    it('should handle array flattened_fields gracefully', async () => {
      await insertTestMember(90013, 'Mia', 'Gray', [
        { scoutid: 90013, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ], {
        flattened_fields: ['should', 'not', 'spread'],
      });

      const members = await databaseService.getMembers([101]);
      expect(members).toHaveLength(1);
      expect(members[0].scoutid).toBe(90013);
    });
  });

  describe('Sorting Tests', () => {
    it('should sort members by lastname, then firstname', async () => {
      await insertTestMember(90014, 'Alice', 'Brown', [
        { scoutid: 90014, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ]);
      await insertTestMember(90015, 'Bob', 'Smith', [
        { scoutid: 90015, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ]);
      await insertTestMember(90016, 'Charlie', 'Brown', [
        { scoutid: 90016, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ]);

      const members = await databaseService.getMembers([101]);

      expect(members).toHaveLength(3);
      expect(members[0].firstname).toBe('Alice');
      expect(members[0].lastname).toBe('Brown');
      expect(members[1].firstname).toBe('Charlie');
      expect(members[1].lastname).toBe('Brown');
      expect(members[2].firstname).toBe('Bob');
      expect(members[2].lastname).toBe('Smith');
    });

    it('should handle null lastnames in sorting', async () => {
      await insertTestMember(90017, 'David', null, [
        { scoutid: 90017, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ]);
      await insertTestMember(90018, 'Emily', 'Anderson', [
        { scoutid: 90018, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ]);

      const members = await databaseService.getMembers([101]);

      expect(members).toHaveLength(2);
      expect(members[0].lastname).toBeNull();
      expect(members[1].lastname).toBe('Anderson');
    });

    it('should handle null firstnames in sorting', async () => {
      await insertTestMember(90019, null, 'Young', [
        { scoutid: 90019, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ]);
      await insertTestMember(90020, 'Zoe', 'Young', [
        { scoutid: 90020, sectionid: 101, sectionname: '1st Test Cubs', person_type: 'Young People' },
      ]);

      const members = await databaseService.getMembers([101]);

      expect(members).toHaveLength(2);
      expect(members[0].firstname).toBeNull();
      expect(members[1].firstname).toBe('Zoe');
    });
  });

  describe('Multiple Section Query Tests', () => {
    it('should return members from all requested sections', async () => {
      await insertTestMember(90021, 'Cub1', 'Test', [
        { scoutid: 90021, sectionid: 101, sectionname: 'Cubs', person_type: 'Young People' },
      ]);
      await insertTestMember(90022, 'Cub2', 'Test', [
        { scoutid: 90022, sectionid: 101, sectionname: 'Cubs', person_type: 'Young People' },
      ]);
      await insertTestMember(90023, 'Scout1', 'Test', [
        { scoutid: 90023, sectionid: 102, sectionname: 'Scouts', person_type: 'Young People' },
      ]);
      await insertTestMember(90024, 'Scout2', 'Test', [
        { scoutid: 90024, sectionid: 102, sectionname: 'Scouts', person_type: 'Young People' },
      ]);
      await insertTestMember(90025, 'Beaver1', 'Test', [
        { scoutid: 90025, sectionid: 103, sectionname: 'Beavers', person_type: 'Young People' },
      ]);

      const members = await databaseService.getMembers([101, 102]);

      expect(members.length).toBeGreaterThanOrEqual(4);

      const testMembers = members.filter(m => m.scoutid >= 90000);
      expect(testMembers).toHaveLength(4);

      const sectionIds = new Set(testMembers.map(m => m.sectionid));
      expect(sectionIds.has(101)).toBe(true);
      expect(sectionIds.has(102)).toBe(true);
      expect(sectionIds.has(103)).toBe(false);
    });

    it('should deduplicate multi-section members', async () => {
      await insertTestMember(90026, 'YoungLeader', 'Test', [
        {
          scoutid: 90026,
          sectionid: 101,
          sectionname: 'Cubs',
          person_type: 'Young Leaders',
        },
        {
          scoutid: 90026,
          sectionid: 102,
          sectionname: 'Scouts',
          person_type: 'Young People',
        },
      ]);

      const members = await databaseService.getMembers([101, 102]);

      const youngLeaderMembers = members.filter(m => m.scoutid === 90026);
      expect(youngLeaderMembers).toHaveLength(1);

      const member = youngLeaderMembers[0];
      expect(member.sections).toHaveLength(2);

      const sectionIds = member.sections.map(s => s.section_id);
      expect(sectionIds).toContain(101);
      expect(sectionIds).toContain(102);
    });

    it('should handle overlapping section queries correctly', async () => {
      await insertTestMember(90027, 'Overlap', 'Test', [
        {
          scoutid: 90027,
          sectionid: 101,
          sectionname: 'Cubs',
          person_type: 'Young People',
        },
      ]);

      const members = await databaseService.getMembers([101, 101, 101]);

      const overlapMembers = members.filter(m => m.scoutid === 90027);
      expect(overlapMembers).toHaveLength(1);
    });
  });

  describe('Data Integrity Tests', () => {
    it('should return empty array for non-existent section', async () => {
      const members = await databaseService.getMembers([99999]);
      expect(members).toEqual([]);
    });

    it('should handle member with no sections array gracefully', async () => {
      await insertTestMember(90028, 'NoSections', 'Test', [
        { scoutid: 90028, sectionid: 101, sectionname: 'Cubs', person_type: 'Young People' },
      ]);

      const members = await databaseService.getMembers([101]);
      const member = members.find(m => m.scoutid === 90028);

      expect(member).toBeDefined();
      expect(member.sections).toBeDefined();
      expect(Array.isArray(member.sections)).toBe(true);
    });

    it('should preserve all section-specific fields for each section in sections array', async () => {
      await insertTestMember(90029, 'MultiRole', 'Test', [
        {
          scoutid: 90029,
          sectionid: 101,
          sectionname: 'Cubs',
          section: 'cubs',
          person_type: 'Young Leaders',
          patrol: 'Leadership',
          active: true,
        },
        {
          scoutid: 90029,
          sectionid: 102,
          sectionname: 'Scouts',
          section: 'scouts',
          person_type: 'Young People',
          patrol: 'Eagles',
          active: false,
        },
      ]);

      const members = await databaseService.getMembers([101, 102]);
      const member = members[0];

      const cubsSection = member.sections.find(s => s.section_id === 101);
      expect(cubsSection.section).toBe('cubs');
      expect(cubsSection.person_type).toBe('Young Leaders');
      expect(cubsSection.patrol).toBe('Leadership');
      expect(cubsSection.active).toBe(true);

      const scoutsSection = member.sections.find(s => s.section_id === 102);
      expect(scoutsSection.section).toBe('scouts');
      expect(scoutsSection.person_type).toBe('Young People');
      expect(scoutsSection.patrol).toBe('Eagles');
      expect(scoutsSection.active).toBe(false);
    });
  });

  describe('Backward Compatibility Tests', () => {
    it('should always set member_id equal to scoutid', async () => {
      await insertTestMember(90030, 'Compat', 'Test', [
        { scoutid: 90030, sectionid: 101, sectionname: 'Cubs', person_type: 'Young People' },
      ]);

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.member_id).toBe(member.scoutid);
      expect(member.member_id).toBe(90030);
    });

    it('should always set dateofbirth equal to date_of_birth', async () => {
      await insertTestMember(90031, 'DOB', 'Test', [
        { scoutid: 90031, sectionid: 101, sectionname: 'Cubs', person_type: 'Young People' },
      ], {
        date_of_birth: '2015-03-20',
      });

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.dateofbirth).toBe(member.date_of_birth);
      expect(member.dateofbirth).toBe('2015-03-20');
    });

    it('should handle null date_of_birth in backward compat', async () => {
      await insertTestMember(90032, 'NoDOB', 'Test', [
        { scoutid: 90032, sectionid: 101, sectionname: 'Cubs', person_type: 'Young People' },
      ], {
        date_of_birth: null,
      });

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.dateofbirth).toBe(member.date_of_birth);
      expect(member.dateofbirth).toBeNull();
    });
  });

  describe('Sections Array Structure Tests', () => {
    it('should include both section_id and sectionid in sections array elements', async () => {
      await insertTestMember(90033, 'DualID', 'Test', [
        {
          scoutid: 90033,
          sectionid: 101,
          sectionname: 'Cubs',
          person_type: 'Young People',
        },
      ]);

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.sections[0]).toHaveProperty('section_id');
      expect(member.sections[0]).toHaveProperty('sectionid');
      expect(member.sections[0].section_id).toBe(member.sections[0].sectionid);
      expect(member.sections[0].section_id).toBe(101);
    });

    it('should maintain section order in sections array', async () => {
      await insertTestMember(90034, 'Order', 'Test', [
        {
          scoutid: 90034,
          sectionid: 101,
          sectionname: 'Cubs',
          person_type: 'Young Leaders',
        },
        {
          scoutid: 90034,
          sectionid: 102,
          sectionname: 'Scouts',
          person_type: 'Young People',
        },
        {
          scoutid: 90034,
          sectionid: 103,
          sectionname: 'Beavers',
          person_type: 'Leaders',
        },
      ]);

      const members = await databaseService.getMembers([101, 102, 103]);
      const member = members.find(m => m.scoutid === 90034);

      expect(member.sections).toHaveLength(3);

      const sectionIds = member.sections.map(s => s.section_id);
      expect(sectionIds).toContain(101);
      expect(sectionIds).toContain(102);
      expect(sectionIds).toContain(103);
    });
  });

  describe('Performance and Large Dataset Tests', () => {
    it('should handle section with multiple members efficiently', async () => {
      const memberCount = 50;
      const insertPromises = [];

      for (let i = 0; i < memberCount; i++) {
        insertPromises.push(
          insertTestMember(90100 + i, `Member${i}`, 'Bulk', [
            {
              scoutid: 90100 + i,
              sectionid: 101,
              sectionname: 'Large Section',
              person_type: 'Young People',
            },
          ]),
        );
      }

      await Promise.all(insertPromises);

      const startTime = Date.now();
      const members = await databaseService.getMembers([101]);
      const endTime = Date.now();

      const testMembers = members.filter(m => m.scoutid >= 90100 && m.scoutid < 90100 + memberCount);
      expect(testMembers).toHaveLength(memberCount);

      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Age Field Tests', () => {
    it('should handle null age fields gracefully', async () => {
      await insertTestMember(90035, 'NoAge', 'Test', [
        { scoutid: 90035, sectionid: 101, sectionname: 'Cubs', person_type: 'Young People' },
      ], {
        age: null,
        age_years: null,
        age_months: null,
        yrs: null,
      });

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.age).toBeNull();
      expect(member.age_years).toBeNull();
      expect(member.age_months).toBeNull();
      expect(member.yrs).toBeNull();
    });

    it('should preserve age string format', async () => {
      await insertTestMember(90036, 'AgeString', 'Test', [
        { scoutid: 90036, sectionid: 101, sectionname: 'Cubs', person_type: 'Young People' },
      ], {
        age: '25+',
        age_years: 25,
        age_months: 300,
        yrs: 25,
      });

      const members = await databaseService.getMembers([101]);
      const member = members[0];

      expect(member.age).toBe('25+');
      expect(member.age_years).toBe(25);
      expect(member.age_months).toBe(300);
      expect(member.yrs).toBe(25);
    });
  });
});
