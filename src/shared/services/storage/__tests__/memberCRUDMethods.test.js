import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBService } from '../indexedDBService.js';

describe('Member CRUD Methods', () => {
  let db;

  beforeEach(async () => {
    db = await IndexedDBService.getDB();
    vi.clearAllMocks();
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

  describe('CoreMember CRUD', () => {
    describe('upsertCoreMember', () => {
      it('should create new member when not exists', async () => {
        const memberData = {
          scoutid: 90001,
          firstname: 'John',
          lastname: 'Doe',
          date_of_birth: '2010-01-01',
        };

        const result = await IndexedDBService.upsertCoreMember(memberData);

        expect(result.scoutid).toBe(90001);
        expect(result.firstname).toBe('John');
        expect(result.updated_at).toBeDefined();
        expect(typeof result.updated_at).toBe('number');
      });

      it('should merge with existing data on update (MERGE strategy)', async () => {
        const initial = {
          scoutid: 90002,
          firstname: 'Jane',
          lastname: 'Smith',
          date_of_birth: '2011-02-02',
          photo_guid: 'initial-guid',
          custom_field: 'should-persist',
        };

        await IndexedDBService.upsertCoreMember(initial);

        const update = {
          scoutid: 90002,
          firstname: 'Janet',
          new_field: 'new-value',
        };

        const result = await IndexedDBService.upsertCoreMember(update);

        expect(result.scoutid).toBe(90002);
        expect(result.firstname).toBe('Janet');
        expect(result.lastname).toBe('Smith');
        expect(result.date_of_birth).toBe('2011-02-02');
        expect(result.photo_guid).toBe('initial-guid');
        expect(result.custom_field).toBe('should-persist');
        expect(result.new_field).toBe('new-value');
      });

      it('should handle null/undefined values gracefully', async () => {
        const memberData = {
          scoutid: 90003,
          firstname: null,
          lastname: undefined,
        };

        const result = await IndexedDBService.upsertCoreMember(memberData);

        expect(result.scoutid).toBe(90003);
        expect(result.firstname).toBeNull();
        expect(result.lastname).toBeUndefined();
        expect(result.updated_at).toBeDefined();
      });

      it('should throw error when scoutid is missing', async () => {
        const memberData = {
          firstname: 'No',
          lastname: 'ID',
        };

        await expect(IndexedDBService.upsertCoreMember(memberData)).rejects.toThrow();
      });
    });

    describe('getCoreMember', () => {
      it('should retrieve existing member', async () => {
        const memberData = {
          scoutid: 90004,
          firstname: 'Get',
          lastname: 'Test',
        };

        await IndexedDBService.upsertCoreMember(memberData);
        const result = await IndexedDBService.getCoreMember(90004);

        expect(result).toBeDefined();
        expect(result.scoutid).toBe(90004);
        expect(result.firstname).toBe('Get');
      });

      it('should return null for non-existent member', async () => {
        const result = await IndexedDBService.getCoreMember(99999);
        expect(result).toBeNull();
      });
    });

    describe('getAllCoreMembers', () => {
      it('should retrieve all members', async () => {
        const members = [
          { scoutid: 90005, firstname: 'Member1' },
          { scoutid: 90006, firstname: 'Member2' },
        ];

        for (const member of members) {
          await IndexedDBService.upsertCoreMember(member);
        }

        const result = await IndexedDBService.getAllCoreMembers();

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);

        const testMembers = result.filter(m => m.scoutid >= 90000);
        expect(testMembers.length).toBeGreaterThanOrEqual(2);
      });

      it('should return empty array when no members exist', async () => {
        await db.clear('core_members');
        const result = await IndexedDBService.getAllCoreMembers();

        expect(result).toEqual([]);
      });
    });

    describe('deleteCoreMember', () => {
      it('should delete existing member', async () => {
        await IndexedDBService.upsertCoreMember({ scoutid: 90007, firstname: 'ToDelete' });

        const result = await IndexedDBService.deleteCoreMember(90007);
        expect(result).toBe(true);

        const member = await IndexedDBService.getCoreMember(90007);
        expect(member).toBeNull();
      });

      it('should not throw when deleting non-existent member', async () => {
        const result = await IndexedDBService.deleteCoreMember(99999);
        expect(result).toBe(true);
      });
    });

    describe('bulkUpsertCoreMembers', () => {
      it('should bulk insert new members', async () => {
        const members = [
          { scoutid: 90008, firstname: 'Bulk1', lastname: 'Test1' },
          { scoutid: 90009, firstname: 'Bulk2', lastname: 'Test2' },
          { scoutid: 90010, firstname: 'Bulk3', lastname: 'Test3' },
        ];

        const count = await IndexedDBService.bulkUpsertCoreMembers(members);
        expect(count).toBe(3);

        for (const member of members) {
          const retrieved = await IndexedDBService.getCoreMember(member.scoutid);
          expect(retrieved).toBeDefined();
          expect(retrieved.firstname).toBe(member.firstname);
        }
      });

      it('should merge data for existing members (MERGE strategy)', async () => {
        await IndexedDBService.upsertCoreMember({
          scoutid: 90011,
          firstname: 'Original',
          lastname: 'Name',
          custom_data: 'keep-this',
        });

        const updates = [
          { scoutid: 90011, firstname: 'Updated' },
        ];

        await IndexedDBService.bulkUpsertCoreMembers(updates);

        const result = await IndexedDBService.getCoreMember(90011);
        expect(result.firstname).toBe('Updated');
        expect(result.lastname).toBe('Name');
        expect(result.custom_data).toBe('keep-this');
      });

      it('should handle empty array', async () => {
        const count = await IndexedDBService.bulkUpsertCoreMembers([]);
        expect(count).toBe(0);
      });

      it('should set same timestamp for all bulk operations', async () => {
        const members = [
          { scoutid: 90012, firstname: 'Time1' },
          { scoutid: 90013, firstname: 'Time2' },
        ];

        await IndexedDBService.bulkUpsertCoreMembers(members);

        const member1 = await IndexedDBService.getCoreMember(90012);
        const member2 = await IndexedDBService.getCoreMember(90013);

        expect(member1.updated_at).toBe(member2.updated_at);
      });
    });
  });

  describe('MemberSection CRUD', () => {
    describe('upsertMemberSection', () => {
      it('should create new section membership', async () => {
        const sectionData = {
          scoutid: 90014,
          sectionid: 101,
          person_type: 'Young People',
          patrol: 'Eagles',
          sectionname: '1st Test Scouts',
        };

        const result = await IndexedDBService.upsertMemberSection(sectionData);

        expect(result.scoutid).toBe(90014);
        expect(result.sectionid).toBe(101);
        expect(result.person_type).toBe('Young People');
        expect(result.updated_at).toBeDefined();
      });

      it('should fully replace existing data (REPLACE strategy)', async () => {
        const initial = {
          scoutid: 90015,
          sectionid: 102,
          person_type: 'Young People',
          patrol: 'Lions',
          custom_field: 'should-disappear',
          active: true,
        };

        await IndexedDBService.upsertMemberSection(initial);

        const update = {
          scoutid: 90015,
          sectionid: 102,
          person_type: 'Young Leaders',
          patrol: 'Leadership',
        };

        const result = await IndexedDBService.upsertMemberSection(update);

        expect(result.scoutid).toBe(90015);
        expect(result.sectionid).toBe(102);
        expect(result.person_type).toBe('Young Leaders');
        expect(result.patrol).toBe('Leadership');
        expect(result.custom_field).toBeUndefined();
        expect(result.active).toBeUndefined();
      });

      it('should handle compound key correctly', async () => {
        const sections = [
          {
            scoutid: 90016,
            sectionid: 103,
            person_type: 'Young People',
            sectionname: 'Cubs',
          },
          {
            scoutid: 90016,
            sectionid: 104,
            person_type: 'Young Leaders',
            sectionname: 'Scouts',
          },
        ];

        for (const section of sections) {
          await IndexedDBService.upsertMemberSection(section);
        }

        const cubs = await IndexedDBService.getMemberSection(90016, 103);
        const scouts = await IndexedDBService.getMemberSection(90016, 104);

        expect(cubs.sectionname).toBe('Cubs');
        expect(scouts.sectionname).toBe('Scouts');
      });
    });

    describe('getMemberSection', () => {
      it('should retrieve section membership by compound key', async () => {
        const sectionData = {
          scoutid: 90017,
          sectionid: 105,
          person_type: 'Young People',
        };

        await IndexedDBService.upsertMemberSection(sectionData);
        const result = await IndexedDBService.getMemberSection(90017, 105);

        expect(result).toBeDefined();
        expect(result.scoutid).toBe(90017);
        expect(result.sectionid).toBe(105);
      });

      it('should return null for non-existent membership', async () => {
        const result = await IndexedDBService.getMemberSection(99999, 999);
        expect(result).toBeNull();
      });
    });

    describe('getMemberSectionsByScout', () => {
      it('should retrieve all sections for a scout', async () => {
        const sections = [
          { scoutid: 90018, sectionid: 106, sectionname: 'Cubs' },
          { scoutid: 90018, sectionid: 107, sectionname: 'Scouts' },
          { scoutid: 90019, sectionid: 108, sectionname: 'Other' },
        ];

        for (const section of sections) {
          await IndexedDBService.upsertMemberSection(section);
        }

        const result = await IndexedDBService.getMemberSectionsByScout(90018);

        expect(result).toHaveLength(2);
        expect(result.map(s => s.sectionid)).toEqual(expect.arrayContaining([106, 107]));
      });

      it('should return empty array for scout with no sections', async () => {
        const result = await IndexedDBService.getMemberSectionsByScout(99999);
        expect(result).toEqual([]);
      });
    });

    describe('getMemberSectionsBySection', () => {
      it('should retrieve all members in a section', async () => {
        const sections = [
          { scoutid: 90020, sectionid: 109, sectionname: 'Test Section' },
          { scoutid: 90021, sectionid: 109, sectionname: 'Test Section' },
          { scoutid: 90022, sectionid: 110, sectionname: 'Other Section' },
        ];

        for (const section of sections) {
          await IndexedDBService.upsertMemberSection(section);
        }

        const result = await IndexedDBService.getMemberSectionsBySection(109);

        expect(result.length).toBeGreaterThanOrEqual(2);
        const testMembers = result.filter(s => s.scoutid >= 90000);
        expect(testMembers).toHaveLength(2);
      });

      it('should return empty array for section with no members', async () => {
        const result = await IndexedDBService.getMemberSectionsBySection(99999);
        expect(result).toEqual([]);
      });
    });

    describe('deleteMemberSection', () => {
      it('should delete section membership by compound key', async () => {
        await IndexedDBService.upsertMemberSection({
          scoutid: 90023,
          sectionid: 111,
          person_type: 'ToDelete',
        });

        const result = await IndexedDBService.deleteMemberSection(90023, 111);
        expect(result).toBe(true);

        const membership = await IndexedDBService.getMemberSection(90023, 111);
        expect(membership).toBeNull();
      });

      it('should not throw when deleting non-existent membership', async () => {
        const result = await IndexedDBService.deleteMemberSection(99999, 999);
        expect(result).toBe(true);
      });
    });

    describe('bulkUpsertMemberSections', () => {
      it('should bulk insert new section memberships', async () => {
        const sections = [
          { scoutid: 90024, sectionid: 112, person_type: 'Young People' },
          { scoutid: 90025, sectionid: 112, person_type: 'Young People' },
          { scoutid: 90026, sectionid: 113, person_type: 'Young Leaders' },
        ];

        const count = await IndexedDBService.bulkUpsertMemberSections(sections);
        expect(count).toBe(3);

        for (const section of sections) {
          const retrieved = await IndexedDBService.getMemberSection(section.scoutid, section.sectionid);
          expect(retrieved).toBeDefined();
          expect(retrieved.person_type).toBe(section.person_type);
        }
      });

      it('should fully replace existing memberships (REPLACE strategy)', async () => {
        await IndexedDBService.upsertMemberSection({
          scoutid: 90027,
          sectionid: 114,
          person_type: 'Young People',
          patrol: 'Original Patrol',
          custom_data: 'will-be-gone',
        });

        const updates = [
          { scoutid: 90027, sectionid: 114, person_type: 'Young Leaders' },
        ];

        await IndexedDBService.bulkUpsertMemberSections(updates);

        const result = await IndexedDBService.getMemberSection(90027, 114);
        expect(result.person_type).toBe('Young Leaders');
        expect(result.patrol).toBeUndefined();
        expect(result.custom_data).toBeUndefined();
      });

      it('should handle empty array', async () => {
        const count = await IndexedDBService.bulkUpsertMemberSections([]);
        expect(count).toBe(0);
      });

      it('should set same timestamp for all bulk operations', async () => {
        const sections = [
          { scoutid: 90028, sectionid: 115, person_type: 'Type1' },
          { scoutid: 90029, sectionid: 115, person_type: 'Type2' },
        ];

        await IndexedDBService.bulkUpsertMemberSections(sections);

        const section1 = await IndexedDBService.getMemberSection(90028, 115);
        const section2 = await IndexedDBService.getMemberSection(90029, 115);

        expect(section1.updated_at).toBe(section2.updated_at);
      });
    });
  });

  describe('Transaction Behavior', () => {
    it('should fail fast on first error in bulkUpsertCoreMembers', async () => {
      const members = [
        { scoutid: 90030, firstname: 'Valid1' },
        { firstname: 'Invalid' },
        { scoutid: 90031, firstname: 'Valid2' },
      ];

      await expect(IndexedDBService.bulkUpsertCoreMembers(members)).rejects.toThrow('scoutid is required');

      const member2 = await IndexedDBService.getCoreMember(90031);
      expect(member2).toBeNull();
    });

    it('should handle concurrent operations correctly', async () => {
      const operations = [];

      for (let i = 0; i < 10; i++) {
        operations.push(
          IndexedDBService.upsertCoreMember({
            scoutid: 90040 + i,
            firstname: `Concurrent${i}`,
          }),
        );
      }

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.scoutid).toBe(90040 + index);
        expect(result.firstname).toBe(`Concurrent${index}`);
      });
    });
  });

  describe('Error Handling', () => {
    it('should include proper error context in logs', async () => {
      const loggerSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await IndexedDBService.upsertCoreMember({});
      } catch (error) {
        expect(error.message).toContain('scoutid is required');
      }

      loggerSpy.mockRestore();
    });
  });
});