import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBService } from '../indexedDBService.js';

describe('Member Stores Creation', () => {
  let db;

  beforeEach(async () => {
    db = await IndexedDBService.getDB();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('core_members store', () => {
    it('should exist in database', async () => {
      const storeNames = Array.from(db.objectStoreNames);
      expect(storeNames).toContain('core_members');
    });

    it('should have scoutid as keyPath', async () => {
      const tx = db.transaction('core_members', 'readonly');
      const store = tx.objectStore('core_members');
      expect(store.keyPath).toBe('scoutid');
      await tx.done;
    });

    it('should have lastname index', async () => {
      const tx = db.transaction('core_members', 'readonly');
      const store = tx.objectStore('core_members');
      const indexNames = Array.from(store.indexNames);
      expect(indexNames).toContain('lastname');
      await tx.done;
    });

    it('should have firstname index', async () => {
      const tx = db.transaction('core_members', 'readonly');
      const store = tx.objectStore('core_members');
      const indexNames = Array.from(store.indexNames);
      expect(indexNames).toContain('firstname');
      await tx.done;
    });

    it('should have updated_at index', async () => {
      const tx = db.transaction('core_members', 'readonly');
      const store = tx.objectStore('core_members');
      const indexNames = Array.from(store.indexNames);
      expect(indexNames).toContain('updated_at');
      await tx.done;
    });

    it('should allow adding and retrieving records', async () => {
      const testMember = {
        scoutid: 999,
        firstname: 'Test',
        lastname: 'Member',
        date_of_birth: '2010-01-01',
        photo_guid: 'test-guid',
        has_photo: true,
        contact_groups: { primary: { name: 'Parent' } },
        custom_data: { medical: { allergies: 'none' } },
        flattened_fields: {},
        age: '14 years',
        updated_at: Date.now(),
      };

      await db.put('core_members', testMember);
      const retrieved = await db.get('core_members', 999);

      expect(retrieved).toEqual(testMember);

      await db.delete('core_members', 999);
    });

    it('should support querying by lastname index', async () => {
      const testMembers = [
        {
          scoutid: 1001,
          firstname: 'Alice',
          lastname: 'Smith',
          date_of_birth: '2012-03-15',
          updated_at: Date.now(),
        },
        {
          scoutid: 1002,
          firstname: 'Bob',
          lastname: 'Smith',
          date_of_birth: '2011-07-20',
          updated_at: Date.now(),
        },
      ];

      for (const member of testMembers) {
        await db.put('core_members', member);
      }

      const smiths = await db.getAllFromIndex('core_members', 'lastname', 'Smith');
      expect(smiths).toHaveLength(2);
      expect(smiths.map(m => m.scoutid)).toEqual(expect.arrayContaining([1001, 1002]));

      for (const member of testMembers) {
        await db.delete('core_members', member.scoutid);
      }
    });
  });

  describe('member_section store', () => {
    it('should exist in database', async () => {
      const storeNames = Array.from(db.objectStoreNames);
      expect(storeNames).toContain('member_section');
    });

    it('should have compound keyPath [scoutid, sectionid]', async () => {
      const tx = db.transaction('member_section', 'readonly');
      const store = tx.objectStore('member_section');
      expect(store.keyPath).toEqual(['scoutid', 'sectionid']);
      await tx.done;
    });

    it('should have scoutid index', async () => {
      const tx = db.transaction('member_section', 'readonly');
      const store = tx.objectStore('member_section');
      const indexNames = Array.from(store.indexNames);
      expect(indexNames).toContain('scoutid');
      await tx.done;
    });

    it('should have sectionid index', async () => {
      const tx = db.transaction('member_section', 'readonly');
      const store = tx.objectStore('member_section');
      const indexNames = Array.from(store.indexNames);
      expect(indexNames).toContain('sectionid');
      await tx.done;
    });

    it('should have person_type index', async () => {
      const tx = db.transaction('member_section', 'readonly');
      const store = tx.objectStore('member_section');
      const indexNames = Array.from(store.indexNames);
      expect(indexNames).toContain('person_type');
      await tx.done;
    });

    it('should allow adding and retrieving records with compound key', async () => {
      const testMembership = {
        scoutid: 789,
        sectionid: 101,
        person_type: 'Young Leaders',
        patrol: 'Leadership Team',
        patrol_id: -3,
        sectionname: '1st Walton Cubs',
        section: 'cubs',
        started: '2020-09-01',
        joined: '2020-09-01',
        active: true,
        updated_at: Date.now(),
      };

      await db.put('member_section', testMembership);
      const retrieved = await db.get('member_section', [789, 101]);

      expect(retrieved).toEqual(testMembership);

      await db.delete('member_section', [789, 101]);
    });

    it('should support multiple memberships for same scout', async () => {
      const memberships = [
        {
          scoutid: 789,
          sectionid: 101,
          person_type: 'Young Leaders',
          patrol: 'Leadership Team',
          patrol_id: -3,
          sectionname: '1st Walton Cubs',
          active: true,
          updated_at: Date.now(),
        },
        {
          scoutid: 789,
          sectionid: 102,
          person_type: 'Young People',
          patrol: 'Eagles',
          patrol_id: 7,
          sectionname: '1st Walton Scouts',
          active: true,
          updated_at: Date.now(),
        },
      ];

      for (const membership of memberships) {
        await db.put('member_section', membership);
      }

      const scoutMemberships = await db.getAllFromIndex('member_section', 'scoutid', 789);
      expect(scoutMemberships).toHaveLength(2);
      expect(scoutMemberships.map(m => m.sectionid)).toEqual(expect.arrayContaining([101, 102]));
      expect(scoutMemberships.map(m => m.person_type)).toEqual(
        expect.arrayContaining(['Young Leaders', 'Young People']),
      );

      await db.delete('member_section', [789, 101]);
      await db.delete('member_section', [789, 102]);
    });

    it('should support querying by sectionid index', async () => {
      const cubsMemberships = [
        {
          scoutid: 1001,
          sectionid: 101,
          person_type: 'Young People',
          patrol: 'Red Six',
          patrol_id: 1,
          sectionname: '1st Walton Cubs',
          active: true,
          updated_at: Date.now(),
        },
        {
          scoutid: 1002,
          sectionid: 101,
          person_type: 'Young People',
          patrol: 'Blue Six',
          patrol_id: 2,
          sectionname: '1st Walton Cubs',
          active: true,
          updated_at: Date.now(),
        },
      ];

      for (const membership of cubsMemberships) {
        await db.put('member_section', membership);
      }

      const cubsMembers = await db.getAllFromIndex('member_section', 'sectionid', 101);
      expect(cubsMembers.length).toBeGreaterThanOrEqual(2);
      const testMembers = cubsMembers.filter(m => [1001, 1002].includes(m.scoutid));
      expect(testMembers).toHaveLength(2);

      await db.delete('member_section', [1001, 101]);
      await db.delete('member_section', [1002, 101]);
    });

    it('should support querying by person_type index', async () => {
      const youngLeaders = [
        {
          scoutid: 2001,
          sectionid: 101,
          person_type: 'Young Leaders',
          patrol: 'Leadership',
          patrol_id: -3,
          sectionname: '1st Walton Cubs',
          active: true,
          updated_at: Date.now(),
        },
        {
          scoutid: 2002,
          sectionid: 102,
          person_type: 'Young Leaders',
          patrol: 'Leadership',
          patrol_id: -3,
          sectionname: '1st Walton Scouts',
          active: true,
          updated_at: Date.now(),
        },
      ];

      for (const membership of youngLeaders) {
        await db.put('member_section', membership);
      }

      const ylMembers = await db.getAllFromIndex('member_section', 'person_type', 'Young Leaders');
      expect(ylMembers.length).toBeGreaterThanOrEqual(2);
      const testYLs = ylMembers.filter(m => [2001, 2002].includes(m.scoutid));
      expect(testYLs).toHaveLength(2);

      await db.delete('member_section', [2001, 101]);
      await db.delete('member_section', [2002, 102]);
    });
  });

  describe('Integration: core_members + member_section', () => {
    it('should support JOIN pattern for getting full member data', async () => {
      const coreMember = {
        scoutid: 5001,
        firstname: 'Charlie',
        lastname: 'Brown',
        date_of_birth: '2010-05-10',
        photo_guid: 'charlie-guid',
        has_photo: true,
        contact_groups: { primary: { name: 'Parent Brown' } },
        custom_data: { medical: { allergies: 'peanuts' } },
        updated_at: Date.now(),
      };

      const sectionMembership = {
        scoutid: 5001,
        sectionid: 101,
        person_type: 'Young People',
        patrol: 'Red Six',
        patrol_id: 1,
        sectionname: '1st Walton Cubs',
        active: true,
        updated_at: Date.now(),
      };

      await db.put('core_members', coreMember);
      await db.put('member_section', sectionMembership);

      const core = await db.get('core_members', 5001);
      const section = await db.get('member_section', [5001, 101]);
      const fullMember = { ...core, ...section };

      expect(fullMember.scoutid).toBe(5001);
      expect(fullMember.firstname).toBe('Charlie');
      expect(fullMember.lastname).toBe('Brown');
      expect(fullMember.person_type).toBe('Young People');
      expect(fullMember.patrol).toBe('Red Six');
      expect(fullMember.sectionname).toBe('1st Walton Cubs');
      expect(fullMember.contact_groups).toEqual({ primary: { name: 'Parent Brown' } });

      await db.delete('core_members', 5001);
      await db.delete('member_section', [5001, 101]);
    });

    it('should support getting all members for a section with JOIN', async () => {
      const coreMembers = [
        {
          scoutid: 6001,
          firstname: 'David',
          lastname: 'Wilson',
          date_of_birth: '2011-01-15',
          updated_at: Date.now(),
        },
        {
          scoutid: 6002,
          firstname: 'Emma',
          lastname: 'Taylor',
          date_of_birth: '2012-02-20',
          updated_at: Date.now(),
        },
      ];

      const sectionMemberships = [
        {
          scoutid: 6001,
          sectionid: 101,
          person_type: 'Young People',
          patrol: 'Red Six',
          patrol_id: 1,
          sectionname: '1st Walton Cubs',
          active: true,
          updated_at: Date.now(),
        },
        {
          scoutid: 6002,
          sectionid: 101,
          person_type: 'Young People',
          patrol: 'Blue Six',
          patrol_id: 2,
          sectionname: '1st Walton Cubs',
          active: true,
          updated_at: Date.now(),
        },
      ];

      for (const member of coreMembers) {
        await db.put('core_members', member);
      }
      for (const membership of sectionMemberships) {
        await db.put('member_section', membership);
      }

      const sectionMembers = await db.getAllFromIndex('member_section', 'sectionid', 101);
      const testSectionMembers = sectionMembers.filter(m => [6001, 6002].includes(m.scoutid));

      const fullMembers = await Promise.all(
        testSectionMembers.map(async (sectionMember) => {
          const core = await db.get('core_members', sectionMember.scoutid);
          return { ...core, ...sectionMember };
        }),
      );

      expect(fullMembers).toHaveLength(2);
      expect(fullMembers[0].firstname).toBeDefined();
      expect(fullMembers[0].patrol).toBeDefined();
      expect(fullMembers[1].firstname).toBeDefined();
      expect(fullMembers[1].patrol).toBeDefined();

      for (const member of coreMembers) {
        await db.delete('core_members', member.scoutid);
      }
      for (const membership of sectionMemberships) {
        await db.delete('member_section', [membership.scoutid, membership.sectionid]);
      }
    });
  });
});
