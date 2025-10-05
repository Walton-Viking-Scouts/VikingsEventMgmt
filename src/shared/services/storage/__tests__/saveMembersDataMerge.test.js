import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBService } from '../indexedDBService.js';
import databaseService from '../database.js';

describe('saveMembers() Data Merge and Replace Logic', () => {
  let db;

  beforeEach(async () => {
    await databaseService.initialize();
    db = await IndexedDBService.getDB();
  });

  afterEach(async () => {
    const coreMembers = await db.getAll('core_members');
    for (const member of coreMembers) {
      if (member.scoutid >= 90000) {
        await db.delete('core_members', member.scoutid);
      }
    }

    const memberSections = await db.getAll('member_section');
    for (const section of memberSections) {
      if (section.scoutid >= 90000) {
        await db.delete('member_section', [section.scoutid, section.sectionid]);
      }
    }
  });

  describe('Core Members MERGE Strategy', () => {
    it('should preserve firstname, lastname, date_of_birth from first save', async () => {
      const member1 = {
        scoutid: 90001,
        firstname: 'Alice',
        lastname: 'Smith',
        date_of_birth: '2010-05-15',
        sectionid: 101,
      };

      await databaseService.saveMembers([101], [member1]);

      const member2 = {
        scoutid: 90001,
        firstname: 'AliceUpdated',
        lastname: 'SmithUpdated',
        date_of_birth: '2011-06-20',
        sectionid: 101,
      };

      await databaseService.saveMembers([101], [member2]);

      const coreMember = await IndexedDBService.getCoreMember(90001);

      expect(coreMember.firstname).toBe('AliceUpdated');
      expect(coreMember.lastname).toBe('SmithUpdated');
      expect(coreMember.date_of_birth).toBe('2011-06-20');
    });

    it('should merge contact_groups within same batch', async () => {
      const member1 = {
        scoutid: 90002,
        firstname: 'Bob',
        lastname: 'Jones',
        sectionid: 101,
        contact_groups: {
          primary: { name: 'Parent 1', email: 'parent1@example.com' },
        },
      };

      const member2 = {
        scoutid: 90002,
        firstname: 'Bob',
        lastname: 'Jones',
        sectionid: 102,
        contact_groups: {
          secondary: { name: 'Parent 2', email: 'parent2@example.com' },
        },
      };

      await databaseService.saveMembers([101, 102], [member1, member2]);

      const coreMember = await IndexedDBService.getCoreMember(90002);

      expect(coreMember.contact_groups.primary).toEqual({
        name: 'Parent 1',
        email: 'parent1@example.com',
      });
      expect(coreMember.contact_groups.secondary).toEqual({
        name: 'Parent 2',
        email: 'parent2@example.com',
      });
    });

    it('should merge custom_data within same batch', async () => {
      const member1 = {
        scoutid: 90003,
        firstname: 'Charlie',
        lastname: 'Brown',
        sectionid: 101,
        custom_data: {
          medical: { allergies: 'peanuts' },
        },
      };

      const member2 = {
        scoutid: 90003,
        firstname: 'Charlie',
        lastname: 'Brown',
        sectionid: 102,
        custom_data: {
          emergency: { contact: '555-1234' },
        },
      };

      await databaseService.saveMembers([101, 102], [member1, member2]);

      const coreMember = await IndexedDBService.getCoreMember(90003);

      expect(coreMember.custom_data.medical).toEqual({ allergies: 'peanuts' });
      expect(coreMember.custom_data.emergency).toEqual({ contact: '555-1234' });
    });

    it('should merge flattened_fields within same batch', async () => {
      const member1 = {
        scoutid: 90004,
        firstname: 'Diana',
        lastname: 'Prince',
        sectionid: 101,
        custom_field_1: 'value1',
        badge_progress: '50%',
      };

      const member2 = {
        scoutid: 90004,
        firstname: 'Diana',
        lastname: 'Prince',
        sectionid: 102,
        custom_field_2: 'value2',
        activity_level: 'high',
      };

      await databaseService.saveMembers([101, 102], [member1, member2]);

      const coreMember = await IndexedDBService.getCoreMember(90004);

      expect(coreMember.flattened_fields.custom_field_1).toBe('value1');
      expect(coreMember.flattened_fields.badge_progress).toBe('50%');
      expect(coreMember.flattened_fields.custom_field_2).toBe('value2');
      expect(coreMember.flattened_fields.activity_level).toBe('high');
    });

    it('should create only 1 core_members row for multi-section member', async () => {
      const youngLeaderCubs = {
        scoutid: 90005,
        firstname: 'Emily',
        lastname: 'Davis',
        sectionid: 101,
        person_type: 'Young Leader',
        patrol: 'Red Six',
      };

      const youngPeopleScouts = {
        scoutid: 90005,
        firstname: 'Emily',
        lastname: 'Davis',
        sectionid: 102,
        person_type: 'Young People',
        patrol: 'Eagles',
      };

      await databaseService.saveMembers([101, 102], [youngLeaderCubs, youngPeopleScouts]);

      const coreMembers = await db.getAll('core_members');
      const emilyCoreRecords = coreMembers.filter(m => m.scoutid === 90005);

      expect(emilyCoreRecords).toHaveLength(1);
    });

    it('should overwrite contact_groups fields with same key', async () => {
      const member1 = {
        scoutid: 90006,
        firstname: 'Frank',
        lastname: 'Miller',
        sectionid: 101,
        contact_groups: {
          primary: { name: 'Old Parent', email: 'old@example.com' },
        },
      };

      await databaseService.saveMembers([101], [member1]);

      const member2 = {
        scoutid: 90006,
        firstname: 'Frank',
        lastname: 'Miller',
        sectionid: 101,
        contact_groups: {
          primary: { name: 'New Parent', email: 'new@example.com' },
        },
      };

      await databaseService.saveMembers([101], [member2]);

      const coreMember = await IndexedDBService.getCoreMember(90006);

      expect(coreMember.contact_groups.primary).toEqual({
        name: 'New Parent',
        email: 'new@example.com',
      });
    });

    it('should overwrite contact_groups across separate saveMembers calls', async () => {
      const member1 = {
        scoutid: 90007,
        firstname: 'Grace',
        lastname: 'Lee',
        sectionid: 101,
        contact_groups: {
          primary: { name: 'Parent 1', email: 'parent1@example.com' },
        },
      };

      await databaseService.saveMembers([101], [member1]);

      const member2 = {
        scoutid: 90007,
        firstname: 'Grace',
        lastname: 'Lee',
        sectionid: 101,
        contact_groups: {
          secondary: { name: 'Parent 2', email: 'parent2@example.com' },
        },
      };

      await databaseService.saveMembers([101], [member2]);

      const coreMember = await IndexedDBService.getCoreMember(90007);

      expect(coreMember.contact_groups.primary).toBeUndefined();
      expect(coreMember.contact_groups.secondary).toEqual({
        name: 'Parent 2',
        email: 'parent2@example.com',
      });
    });
  });

  describe('Member Section REPLACE Strategy', () => {
    it('should create 1 member_section row when saving member with section', async () => {
      const member = {
        scoutid: 90010,
        firstname: 'George',
        lastname: 'Wilson',
        sectionid: 101,
        person_type: 'Young People',
        patrol: 'Red Six',
      };

      await databaseService.saveMembers([101], [member]);

      const memberSections = await IndexedDBService.getMemberSectionsByScout(90010);

      expect(memberSections).toHaveLength(1);
      expect(memberSections[0].sectionid).toBe(101);
      expect(memberSections[0].patrol).toBe('Red Six');
    });

    it('should update member_section row when patrol changes in same section', async () => {
      const member1 = {
        scoutid: 90011,
        firstname: 'Hannah',
        lastname: 'Taylor',
        sectionid: 101,
        person_type: 'Young People',
        patrol: 'Red Six',
        patrol_id: 5,
      };

      await databaseService.saveMembers([101], [member1]);

      const member2 = {
        scoutid: 90011,
        firstname: 'Hannah',
        lastname: 'Taylor',
        sectionid: 101,
        person_type: 'Young People',
        patrol: 'Blue Six',
        patrol_id: 6,
      };

      await databaseService.saveMembers([101], [member2]);

      const memberSections = await IndexedDBService.getMemberSectionsByScout(90011);

      expect(memberSections).toHaveLength(1);
      expect(memberSections[0].patrol).toBe('Blue Six');
      expect(memberSections[0].patrol_id).toBe(6);
    });

    it('should add new member_section row when member joins additional section', async () => {
      const memberCubs = {
        scoutid: 90012,
        firstname: 'Ian',
        lastname: 'Moore',
        sectionid: 101,
        person_type: 'Young People',
        patrol: 'Red Six',
      };

      await databaseService.saveMembers([101], [memberCubs]);

      const memberScouts = {
        scoutid: 90012,
        firstname: 'Ian',
        lastname: 'Moore',
        sectionid: 102,
        person_type: 'Young People',
        patrol: 'Eagles',
      };

      await databaseService.saveMembers([102], [memberScouts]);

      const memberSections = await IndexedDBService.getMemberSectionsByScout(90012);

      expect(memberSections).toHaveLength(2);
      expect(memberSections.some(s => s.sectionid === 101 && s.patrol === 'Red Six')).toBe(true);
      expect(memberSections.some(s => s.sectionid === 102 && s.patrol === 'Eagles')).toBe(true);
    });

    it('should not create member_section row when member has no sectionid', async () => {
      const member = {
        scoutid: 90013,
        firstname: 'Julia',
        lastname: 'Anderson',
        date_of_birth: '2010-01-01',
      };

      await databaseService.saveMembers([], [member]);

      const memberSections = await IndexedDBService.getMemberSectionsByScout(90013);

      expect(memberSections).toHaveLength(0);
    });
  });

  describe('Multi-Section Membership Scenarios', () => {
    it('should handle Young Leader in Cubs + Young People in Scouts correctly', async () => {
      const youngLeaderCubs = {
        scoutid: 90020,
        firstname: 'Kevin',
        lastname: 'Lee',
        date_of_birth: '2008-03-15',
        sectionid: 101,
        person_type: 'Young Leader',
        patrol: 'Red Six',
        started: '2023-01-01',
        active: true,
      };

      const youngPeopleScouts = {
        scoutid: 90020,
        firstname: 'Kevin',
        lastname: 'Lee',
        date_of_birth: '2008-03-15',
        sectionid: 102,
        person_type: 'Young People',
        patrol: 'Eagles',
        started: '2023-01-01',
        active: true,
      };

      await databaseService.saveMembers([101, 102], [youngLeaderCubs, youngPeopleScouts]);

      const coreMembers = await db.getAll('core_members');
      const kevinCoreRecords = coreMembers.filter(m => m.scoutid === 90020);

      expect(kevinCoreRecords).toHaveLength(1);

      const memberSections = await IndexedDBService.getMemberSectionsByScout(90020);

      expect(memberSections).toHaveLength(2);
      expect(memberSections.some(s => s.sectionid === 101 && s.person_type === 'Young Leader')).toBe(true);
      expect(memberSections.some(s => s.sectionid === 102 && s.person_type === 'Young People')).toBe(true);
    });

    it('should update only Cubs member_section when Cubs patrol changes', async () => {
      const youngLeaderCubs = {
        scoutid: 90021,
        firstname: 'Laura',
        lastname: 'White',
        sectionid: 101,
        person_type: 'Young Leader',
        patrol: 'Red Six',
        patrol_id: 5,
      };

      const youngPeopleScouts = {
        scoutid: 90021,
        firstname: 'Laura',
        lastname: 'White',
        sectionid: 102,
        person_type: 'Young People',
        patrol: 'Eagles',
        patrol_id: 10,
      };

      await databaseService.saveMembers([101, 102], [youngLeaderCubs, youngPeopleScouts]);

      const updatedCubsLeader = {
        scoutid: 90021,
        firstname: 'Laura',
        lastname: 'White',
        sectionid: 101,
        person_type: 'Young Leader',
        patrol: 'Blue Six',
        patrol_id: 6,
      };

      await databaseService.saveMembers([101], [updatedCubsLeader]);

      const memberSections = await IndexedDBService.getMemberSectionsByScout(90021);

      expect(memberSections).toHaveLength(2);

      const cubsSection = memberSections.find(s => s.sectionid === 101);
      expect(cubsSection.patrol).toBe('Blue Six');
      expect(cubsSection.patrol_id).toBe(6);

      const scoutsSection = memberSections.find(s => s.sectionid === 102);
      expect(scoutsSection.patrol).toBe('Eagles');
      expect(scoutsSection.patrol_id).toBe(10);
    });

    it('should preserve all section memberships when updating core data', async () => {
      const youngLeaderCubs = {
        scoutid: 90022,
        firstname: 'Mike',
        lastname: 'Brown',
        sectionid: 101,
        person_type: 'Young Leader',
        patrol: 'Red Six',
      };

      const youngPeopleScouts = {
        scoutid: 90022,
        firstname: 'Mike',
        lastname: 'Brown',
        sectionid: 102,
        person_type: 'Young People',
        patrol: 'Eagles',
      };

      await databaseService.saveMembers([101, 102], [youngLeaderCubs, youngPeopleScouts]);

      const coreUpdate = {
        scoutid: 90022,
        firstname: 'Mike',
        lastname: 'Brown',
        email: 'mike.brown@example.com',
        contact_groups: {
          primary: { name: 'Parent', email: 'parent@example.com' },
        },
      };

      await databaseService.saveMembers([], [coreUpdate]);

      const coreMember = await IndexedDBService.getCoreMember(90022);
      expect(coreMember.email).toBe('mike.brown@example.com');

      const memberSections = await IndexedDBService.getMemberSectionsByScout(90022);
      expect(memberSections).toHaveLength(2);
    });
  });

  describe('Data Integrity at Scale', () => {
    it('should handle 50 members across 3 sections without duplicates', async () => {
      const members = [];

      for (let i = 0; i < 50; i++) {
        const scoutid = 90100 + i;
        const sectionid = 101 + (i % 3);
        members.push({
          scoutid,
          firstname: `Member${i}`,
          lastname: `TestUser${i}`,
          date_of_birth: `2010-${String((i % 12) + 1).padStart(2, '0')}-15`,
          sectionid,
          person_type: 'Young People',
          patrol: `Patrol${i % 5}`,
          patrol_id: i % 5,
        });
      }

      await databaseService.saveMembers([101, 102, 103], members);

      const coreMembers = await db.getAll('core_members');
      const testCoreMembers = coreMembers.filter(m => m.scoutid >= 90100 && m.scoutid < 90150);

      expect(testCoreMembers).toHaveLength(50);

      const scoutids = testCoreMembers.map(m => m.scoutid);
      const uniqueScoutids = new Set(scoutids);
      expect(uniqueScoutids.size).toBe(50);

      const memberSections = await db.getAll('member_section');
      const testMemberSections = memberSections.filter(s => s.scoutid >= 90100 && s.scoutid < 90150);

      expect(testMemberSections).toHaveLength(50);
    });

    it('should overwrite custom_data when re-saving members (shallow merge)', async () => {
      const members = [];

      for (let i = 0; i < 50; i++) {
        const scoutid = 90200 + i;
        members.push({
          scoutid,
          firstname: `Member${i}`,
          lastname: `TestUser${i}`,
          sectionid: 101,
          person_type: 'Young People',
          patrol: `Patrol${i % 5}`,
          custom_data: { score: i },
        });
      }

      await databaseService.saveMembers([101], members);

      const membersUpdate = members.map(m => ({
        ...m,
        custom_data: { level: m.custom_data.score * 2 },
      }));

      await databaseService.saveMembers([101], membersUpdate);

      const coreMembers = await db.getAll('core_members');
      const testCoreMembers = coreMembers.filter(m => m.scoutid >= 90200 && m.scoutid < 90250);

      expect(testCoreMembers).toHaveLength(50);

      testCoreMembers.forEach((member, index) => {
        expect(member.custom_data.score).toBeUndefined();
        expect(member.custom_data.level).toBe(index * 2);
      });
    });

    it('should handle members with varying section counts correctly', async () => {
      const members = [
        {
          scoutid: 90300,
          firstname: 'Single',
          lastname: 'Section',
          sectionid: 101,
          person_type: 'Young People',
        },
        {
          scoutid: 90301,
          firstname: 'Double',
          lastname: 'Section',
          sectionid: 101,
          person_type: 'Young People',
        },
        {
          scoutid: 90301,
          firstname: 'Double',
          lastname: 'Section',
          sectionid: 102,
          person_type: 'Young Leader',
        },
        {
          scoutid: 90302,
          firstname: 'Triple',
          lastname: 'Section',
          sectionid: 101,
          person_type: 'Young People',
        },
        {
          scoutid: 90302,
          firstname: 'Triple',
          lastname: 'Section',
          sectionid: 102,
          person_type: 'Young Leader',
        },
        {
          scoutid: 90302,
          firstname: 'Triple',
          lastname: 'Section',
          sectionid: 103,
          person_type: 'Young People',
        },
      ];

      await databaseService.saveMembers([101, 102, 103], members);

      const coreMembers = await db.getAll('core_members');
      const testCoreMembers = coreMembers.filter(m => m.scoutid >= 90300 && m.scoutid <= 90302);

      expect(testCoreMembers).toHaveLength(3);

      const singleSectionMemberships = await IndexedDBService.getMemberSectionsByScout(90300);
      expect(singleSectionMemberships).toHaveLength(1);

      const doubleSectionMemberships = await IndexedDBService.getMemberSectionsByScout(90301);
      expect(doubleSectionMemberships).toHaveLength(2);

      const tripleSectionMemberships = await IndexedDBService.getMemberSectionsByScout(90302);
      expect(tripleSectionMemberships).toHaveLength(3);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty contact_groups and custom_data correctly', async () => {
      const member = {
        scoutid: 90400,
        firstname: 'Empty',
        lastname: 'Data',
        sectionid: 101,
      };

      await databaseService.saveMembers([101], [member]);

      const coreMember = await IndexedDBService.getCoreMember(90400);

      expect(coreMember.contact_groups).toEqual({});
      expect(coreMember.custom_data).toEqual({});
    });

    it('should handle member with only scoutid (minimal data)', async () => {
      const member = {
        scoutid: 90401,
      };

      await databaseService.saveMembers([], [member]);

      const coreMember = await IndexedDBService.getCoreMember(90401);

      expect(coreMember).toBeTruthy();
      expect(coreMember.scoutid).toBe(90401);
    });

    it('should skip members without scoutid or member_id', async () => {
      const members = [
        {
          firstname: 'Invalid',
          lastname: 'Member',
          sectionid: 101,
        },
        {
          scoutid: 90402,
          firstname: 'Valid',
          lastname: 'Member',
          sectionid: 101,
        },
      ];

      await databaseService.saveMembers([101], members);

      const coreMembers = await db.getAll('core_members');
      const testCoreMembers = coreMembers.filter(m => m.scoutid === 90402);

      expect(testCoreMembers).toHaveLength(1);
      expect(testCoreMembers[0].firstname).toBe('Valid');
    });

    it('should handle member_id as alternative to scoutid', async () => {
      const member = {
        member_id: 90403,
        firstname: 'MemberId',
        lastname: 'User',
        sectionid: 101,
      };

      await databaseService.saveMembers([101], [member]);

      const coreMember = await IndexedDBService.getCoreMember(90403);

      expect(coreMember).toBeTruthy();
      expect(coreMember.scoutid).toBe(90403);
    });
  });
});
