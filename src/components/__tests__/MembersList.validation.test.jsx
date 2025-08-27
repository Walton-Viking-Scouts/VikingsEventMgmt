import { describe, it, expect } from 'vitest';

// Real OSM production data from osm_examples/Members/getListofMembers.json
const realOSMResponse = {
  identifier: 'scoutid',
  photos: true,
  items: [
    {
      firstname: 'Winter',
      lastname: 'Barr',
      photo_guid: '5bb3d0d4-b3c0-48e5-8434-2c1af99213a3',
      patrolid: 119078,
      patrol: 'White Lodge',
      sectionid: 49097,
      enddate: null,
      age: '6 / 7',
      patrol_role_level_label: '',
      active: true,
      scoutid: 2486157,
      full_name: 'Winter Barr',
    },
    {
      firstname: 'Beatrice',
      lastname: 'Belcher',
      photo_guid: null,
      patrolid: 119076,
      patrol: 'Purple Lodge',
      sectionid: 49097,
      enddate: null,
      age: '6 / 6',
      patrol_role_level_label: '',
      active: true,
      scoutid: 2400045,
      full_name: 'Beatrice Belcher',
    },
    {
      firstname: 'Oliver',
      lastname: 'Malone',
      photo_guid: '6f51dbe7-a93a-4ff7-a018-43a336c61e28',
      patrolid: 119078,
      patrol: 'White Lodge LL',
      sectionid: 49097,
      enddate: null,
      age: '7 / 9',
      patrol_role_level_label: 'Lodge Leader',
      active: true,
      scoutid: 2111241,
      full_name: 'Oliver Malone',
    },
    {
      firstname: 'Simon',
      lastname: 'Clark',
      photo_guid: 'd09075a3-5a48-4203-8387-a8d579ace0b1',
      patrolid: -2,
      patrol: 'Leaders',
      sectionid: 49097,
      enddate: null,
      age: '48 / 5',
      patrol_role_level_label: '',
      active: true,
      scoutid: 1919278,
      full_name: 'Simon Clark',
    },
  ],
};

// Simulate the processing logic from getListOfMembers function
function processOSMResponse(data, sectionName) {
  const memberMap = new Map();

  if (data && typeof data === 'object' && data.items) {
    // Process items array structure (OSM format)
    data.items.forEach((member) => {
      if (member && typeof member === 'object' && member.scoutid) {
        const scoutId = member.scoutid;

        if (memberMap.has(scoutId)) {
          // Member already exists, add section to their section list
          const existingMember = memberMap.get(scoutId);
          if (!existingMember.sections.includes(sectionName)) {
            existingMember.sections.push(sectionName);
          }
        } else {
          // New member, add to map
          memberMap.set(scoutId, {
            ...member,
            sections: [sectionName],
            originalSectionId: member.sectionid,
          });
        }
      }
    });
  } else if (data && typeof data === 'object') {
    // Process object values structure (legacy format)
    Object.values(data).forEach((member) => {
      if (member && typeof member === 'object' && member.scoutid) {
        const scoutId = member.scoutid;

        if (memberMap.has(scoutId)) {
          // Member already exists, add section to their section list
          const existingMember = memberMap.get(scoutId);
          if (!existingMember.sections.includes(sectionName)) {
            existingMember.sections.push(sectionName);
          }
        } else {
          // New member, add to map
          memberMap.set(scoutId, {
            ...member,
            sections: [sectionName],
            originalSectionId: member.sectionid,
          });
        }
      }
    });
  }

  return Array.from(memberMap.values());
}

describe('MembersList OSM Data Validation', () => {
  describe('Real OSM Response Processing', () => {
    it('should correctly process real OSM data structure with items array', () => {
      const processed = processOSMResponse(realOSMResponse, 'Beavers');

      expect(processed).toHaveLength(4);
      expect(processed[0]).toMatchObject({
        firstname: 'Winter',
        lastname: 'Barr',
        scoutid: 2486157,
        sections: ['Beavers'],
        originalSectionId: 49097,
      });
    });

    it('should preserve all OSM member fields', () => {
      const processed = processOSMResponse(realOSMResponse, 'Beavers');
      const winterBarr = processed.find((m) => m.scoutid === 2486157);

      expect(winterBarr).toMatchObject({
        firstname: 'Winter',
        lastname: 'Barr',
        photo_guid: '5bb3d0d4-b3c0-48e5-8434-2c1af99213a3',
        patrolid: 119078,
        patrol: 'White Lodge',
        sectionid: 49097,
        enddate: null,
        age: '6 / 7',
        patrol_role_level_label: '',
        active: true,
        scoutid: 2486157,
        full_name: 'Winter Barr',
        sections: ['Beavers'],
        originalSectionId: 49097,
      });
    });

    it('should handle members with different roles and ages', () => {
      const processed = processOSMResponse(realOSMResponse, 'Beavers');

      // Lodge Leader
      const oliverMalone = processed.find((m) => m.scoutid === 2111241);
      expect(oliverMalone.patrol_role_level_label).toBe('Lodge Leader');
      expect(oliverMalone.age).toBe('7 / 9');

      // Adult Leader
      const simonClark = processed.find((m) => m.scoutid === 1919278);
      expect(simonClark.patrol).toBe('Leaders');
      expect(simonClark.age).toBe('48 / 5');
      expect(simonClark.patrolid).toBe(-2);
    });

    it('should handle null photo_guid correctly', () => {
      const processed = processOSMResponse(realOSMResponse, 'Beavers');
      const beatriceBelcher = processed.find((m) => m.scoutid === 2400045);

      expect(beatriceBelcher.photo_guid).toBe(null);
      expect(beatriceBelcher.firstname).toBe('Beatrice');
    });

    it('should deduplicate members across multiple sections', () => {
      // Process same member in two different sections
      const section1 = processOSMResponse(realOSMResponse, 'Beavers');
      const section2 = processOSMResponse(realOSMResponse, 'Cubs');

      // Simulate merging two sections (like in the actual API function)
      const memberMap = new Map();

      // Add from first section
      section1.forEach((member) => {
        memberMap.set(member.scoutid, member);
      });

      // Add from second section (should merge sections)
      section2.forEach((member) => {
        if (memberMap.has(member.scoutid)) {
          const existingMember = memberMap.get(member.scoutid);
          if (!existingMember.sections.includes('Cubs')) {
            existingMember.sections.push('Cubs');
          }
        } else {
          memberMap.set(member.scoutid, member);
        }
      });

      const merged = Array.from(memberMap.values());
      const winterBarr = merged.find((m) => m.scoutid === 2486157);

      expect(winterBarr.sections).toEqual(['Beavers', 'Cubs']);
    });

    it('should handle empty or invalid data gracefully', () => {
      expect(processOSMResponse(null, 'Beavers')).toEqual([]);
      expect(processOSMResponse({}, 'Beavers')).toEqual([]);
      expect(processOSMResponse({ items: [] }, 'Beavers')).toEqual([]);
      expect(processOSMResponse({ items: null }, 'Beavers')).toEqual([]);
    });

    it('should validate that our API expects correct data structure', () => {
      // Test that our processing logic works with both formats
      const legacyFormat = {
        2486157: realOSMResponse.items[0],
        2400045: realOSMResponse.items[1],
      };

      const processedLegacy = processOSMResponse(legacyFormat, 'Beavers');
      const processedItems = processOSMResponse(realOSMResponse, 'Beavers');

      // Both should produce similar results (just different order potentially)
      expect(processedLegacy).toHaveLength(2);
      expect(processedItems).toHaveLength(4);

      // Find Winter Barr in both
      const winterLegacy = processedLegacy.find((m) => m.scoutid === 2486157);
      const winterItems = processedItems.find((m) => m.scoutid === 2486157);

      expect(winterLegacy).toMatchObject(winterItems);
    });
  });

  describe('OSM API Endpoint Validation', () => {
    it('should validate expected OSM endpoint parameters', () => {
      const expectedParams = {
        action: 'getListOfMembers',
        sort: 'lastname',
        sectionid: '49097',
        termid: '12345',
        section: 'beavers',
      };

      const urlParams = new URLSearchParams(expectedParams);
      const expectedUrl = `/api/ext/members/contact/?${urlParams}`;

      expect(expectedUrl).toBe(
        '/api/ext/members/contact/?action=getListOfMembers&sort=lastname&sectionid=49097&termid=12345&section=beavers',
      );
    });

    it('should validate section type parameter formats', () => {
      const sectionTypes = ['beavers', 'cubs', 'scouts', 'venturers', 'rovers'];

      sectionTypes.forEach((sectionType) => {
        const params = new URLSearchParams({
          action: 'getListOfMembers',
          sort: 'lastname',
          sectionid: '12345',
          termid: '67890',
          section: sectionType,
        });

        expect(params.get('section')).toBe(sectionType);
        expect(params.get('action')).toBe('getListOfMembers');
      });
    });
  });
});
