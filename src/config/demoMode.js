// Demo mode configuration and initialization
// Handles demo mode initialization and data pre-population using production data structure

import { safeSetItem } from '../utils/storageUtils.js';
import logger, { LOG_CATEGORIES } from '../services/logger.js';

/**
 * Detect if demo mode should be enabled
 * Checks URL parameters, subdomain, and path
 */
export function isDemoMode() {
  // For test environments or SSR, check environment variable only
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_DEMO_MODE === 'true';
  }
  
  try {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo') === 'true';
    const modeParam = urlParams.get('mode') === 'demo';
    
    console.log('🔍 Demo mode detection:', {
      url: window.location.href,
      demoParam,
      modeParam,
      hostname: window.location.hostname,
      pathname: window.location.pathname
    });
    
    if (demoParam || modeParam) {
      console.log('✅ Demo mode enabled via URL parameter');
      return true;
    }
    
    // Check subdomain
    if (window.location.hostname && window.location.hostname.startsWith('demo.')) {
      console.log('✅ Demo mode enabled via subdomain');
      return true;
    }
    
    // Check path
    if (window.location.pathname && window.location.pathname.startsWith('/demo')) {
      console.log('✅ Demo mode enabled via path');
      return true;
    }
  } catch (error) {
    // Fallback to environment variable if window access fails
    logger.warn('Demo mode detection failed, falling back to environment variable', {
      error: error.message,
    }, LOG_CATEGORIES.APP);
  }
  
  // Environment variable fallback
  const envDemo = import.meta.env.VITE_DEMO_MODE === 'true';
  console.log('🔍 Demo mode environment variable:', envDemo);
  return envDemo;
}

/**
 * Production-based demo data - anonymized real cache structure
 */
const DEMO_CACHE_DATA = {
  viking_sections_offline: [
    {
      "sectionid": 11107,
      "sectionname": "Demo Adults",
      "section": "adults", 
      "sectiontype": "adults",
      "isDefault": false,
      "permissions": {
        "badge": 20,
        "member": 20,
        "user": 100,
        "register": 0,
        "programme": 20,
        "events": 20,
        "flexi": 20,
        "finance": 10,
        "quartermaster": 20
      }
    },
    {
      "sectionid": 63813,
      "sectionname": "Demo Squirrels",
      "section": "earlyyears",
      "sectiontype": "earlyyears", 
      "isDefault": false,
      "permissions": {
        "badge": 100,
        "member": 100,
        "user": 100,
        "register": 100,
        "programme": 100,
        "events": 100,
        "flexi": 100,
        "finance": 100,
        "quartermaster": 100
      }
    },
    {
      "sectionid": 11113,
      "sectionname": "Demo Beavers",
      "section": "beavers",
      "sectiontype": "beavers",
      "isDefault": false,
      "permissions": {
        "badge": 100,
        "member": 100,
        "user": 100,
        "register": 100,
        "programme": 100,
        "events": 100,
        "flexi": 100,
        "finance": 100,
        "quartermaster": 100
      }
    },
    {
      "sectionid": 49097,
      "sectionname": "Demo Cubs",
      "section": "cubs",
      "sectiontype": "cubs",
      "isDefault": true,
      "permissions": {
        "badge": 100,
        "member": 100,
        "user": 100,
        "register": 100,
        "programme": 100,
        "events": 100,
        "flexi": 100,
        "finance": 100,
        "quartermaster": 100
      }
    }
  ],

  viking_terms_offline: {
    "items": [
      {
        "termid": "term_autumn_2025",
        "name": "Autumn Term 2025",
        "startdate": "2025-09-01",
        "enddate": "2025-12-15"
      }
    ],
    "_cacheTimestamp": Date.now()
  },

  viking_startup_data_offline: {
    "globals": {
      "firstname": "Demo",
      "lastname": "Leader", 
      "userid": "demo_user",
      "email": "demo@example.com"
    },
    "_cacheTimestamp": Date.now()
  }
};

/**
 * Initialize demo mode with production-based cache structure
 */
export async function initializeDemoMode() {
  if (!isDemoMode()) return false;
  
  logger.info('🎯 Initializing demo mode with production-based data structure', {}, LOG_CATEGORIES.APP);
  console.log('🎯 Demo mode starting initialization...');
  
  try {
    // Store sections as array - safeSetItem will handle JSON stringification
    console.log(`📦 Storing sections as array:`, DEMO_CACHE_DATA.viking_sections_offline);
    safeSetItem('viking_sections_offline', DEMO_CACHE_DATA.viking_sections_offline);

    // Store other demo cache data
    Object.entries(DEMO_CACHE_DATA).forEach(([key, value]) => {
      if (key === 'viking_sections_offline') return; // Already stored above
      
      const dataWithTimestamp = typeof value === 'object' && value !== null && !Array.isArray(value) 
        ? value 
        : { items: value, _cacheTimestamp: Date.now() };
      
      console.log(`📦 Storing demo data: ${key}`, dataWithTimestamp);
      safeSetItem(key, dataWithTimestamp);
    });

    // Generate events for each section and store as arrays - safeSetItem will handle JSON stringification
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      const demoEvents = generateEventsForSection(section);
      const eventsKey = `viking_events_${section.sectionid}_offline`;
      console.log(`📦 Storing events for section ${section.sectionid} as array:`, eventsKey, demoEvents);
      safeSetItem(eventsKey, demoEvents);
    });


    // Generate members for each section and consolidated list
    const allMembers = [];
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      const demoMembers = generateMembersForSection(section);
      const membersWithTimestamp = {
        items: demoMembers,
        _cacheTimestamp: Date.now()
      };
      safeSetItem(`viking_members_${section.sectionid}_offline`, membersWithTimestamp);
      allMembers.push(...demoMembers);
    });

    // Store consolidated member data for sections page
    const consolidatedMembersWithTimestamp = {
      items: allMembers,
      _cacheTimestamp: Date.now()
    };
    console.log('📦 Storing consolidated members:', consolidatedMembersWithTimestamp);
    safeSetItem('viking_members_offline', consolidatedMembersWithTimestamp);

    // Debug: Check what sections data was stored
    console.log('📊 Demo sections stored:', DEMO_CACHE_DATA.viking_sections_offline);

    // Generate attendance for events
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      for (let i = 1; i <= 6; i++) {
        const events = generateEventsForSection(section);
        const event = events[i - 1];
        const eventId = event.eventid;
        const attendanceData = generateAttendanceForEvent(section, eventId);
        safeSetItem(`viking_attendance_${eventId}_offline`, attendanceData);
      }
    });

    // Generate shared metadata for Annual Camp Weekend with external section
    const annualCampMetadata = {
      eventid: "shared_annual_camp_weekend",
      name: "Annual Camp Weekend",
      _isSharedEvent: true,
      _allSections: [
        ...DEMO_CACHE_DATA.viking_sections_offline.map(s => ({
          sectionid: s.sectionid,
          sectionname: s.sectionname,
          attendance: 6, // 6 members attending from each section
          status: "Owner"
        })),
        // External section that user doesn't have access to
        {
          sectionid: 99999,
          sectionname: "External Scout Group",
          attendance: 12,
          status: "Accepted",
          groupname: "1st Neighboring Scouts"
        }
      ],
      _sourceEvent: {
        eventid: "shared_annual_camp_weekend",
        name: "Annual Camp Weekend",
        sectionid: DEMO_CACHE_DATA.viking_sections_offline[0].sectionid
      }
    };
    safeSetItem(`viking_shared_metadata_shared_annual_camp_weekend`, annualCampMetadata);

    // Generate combined attendance for shared Annual Camp Weekend including external section
    const allSharedAttendance = [];
    
    // Add attendance from all demo sections
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      const members = generateMembersForSection(section);
      members.forEach(member => {
        allSharedAttendance.push({
          scoutid: member.scoutid,
          attending: Math.random() > 0.3 ? "Yes" : "Invited",
          firstname: member.firstname,
          lastname: member.lastname,
          sectionid: section.sectionid,
          sectionname: section.sectionname,
          patrolid: 12345 + (parseInt(member.scoutid.split('_')[2]) % 3),
          _filterString: `${member.firstname.toLowerCase()} ${member.lastname.toLowerCase()}`
        });
      });
    });

    // Add synthetic attendance from external section
    const externalNames = [
      "Alex", "Ben", "Chloe", "Dan", "Emma", "Finn", "Grace", "Harry", "Isla", "Jack", "Kate", "Liam"
    ];
    externalNames.forEach((name, index) => {
      allSharedAttendance.push({
        scoutid: `synthetic-99999-${index}`,
        attending: "Yes",
        firstname: name,
        lastname: "External",
        sectionid: 99999,
        sectionname: "External Scout Group",
        patrolid: 99999,
        _filterString: `${name.toLowerCase()} external`
      });
    });

    // Store combined shared attendance
    safeSetItem(`viking_attendance_shared_annual_camp_weekend_offline`, allSharedAttendance);

    // Generate flexi records for each section
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      // Generate flexi lists (available flexi records for section)
      const flexiLists = generateFlexiListsForSection(section);
      const flexiListsWithTimestamp = {
        items: flexiLists,
        _cacheTimestamp: Date.now()
      };
      safeSetItem(`viking_flexi_lists_${section.sectionid}_offline`, flexiListsWithTimestamp);

      // Generate flexi structures and data for each flexi record
      flexiLists.forEach(flexiRecord => {
        const flexiStructure = generateFlexiStructure(flexiRecord);
        const flexiStructureWithTimestamp = {
          ...flexiStructure,
          _cacheTimestamp: Date.now()
        };
        safeSetItem(`viking_flexi_structure_${flexiRecord.flexirecordid}_offline`, flexiStructureWithTimestamp);

        // Generate flexi data for the current term
        const flexiData = generateFlexiData(section, flexiRecord);
        const flexiDataWithTimestamp = {
          items: flexiData,
          _cacheTimestamp: Date.now()
        };
        safeSetItem(`viking_flexi_data_${flexiRecord.flexirecordid}_${section.sectionid}_term_autumn_2025_offline`, flexiDataWithTimestamp);
      });
    });

    logger.info('✅ Demo mode cache populated successfully with production structure', {
      sections: DEMO_CACHE_DATA.viking_sections_offline.length,
      totalDataKeys: Object.keys(DEMO_CACHE_DATA).length + (DEMO_CACHE_DATA.viking_sections_offline.length * 3)
    }, LOG_CATEGORIES.APP);
    console.log('✅ Demo mode initialization complete! Check localStorage for cached data.');
    
    return true;
    
  } catch (error) {
    logger.error('❌ Failed to initialize demo mode', {
      error: error.message,
    }, LOG_CATEGORIES.ERROR);
    return false;
  }
}

function generateEventsForSection(section) {
  const baseEvents = [
    { name: "Annual Camp Weekend", location: "Camp Wilderness", cost: "35.00", isShared: true },
    { name: "Swimming Gala", location: "Leisure Centre", cost: "8.00", isShared: true },
    { name: "Hiking Adventure", location: "Surrey Hills", cost: "5.00", isShared: true },
    { name: "Craft Workshop", location: "Scout Hall", cost: "3.00", isShared: true },
    { name: "Games Tournament", location: "Scout Hall", cost: "2.00", isShared: true },
    { name: "Pizza Night", location: "Scout Hall", cost: "10.00", isShared: true }
  ];

  return baseEvents.map((event, index) => {
    // For Annual Camp Weekend, use same eventid across all sections (true shared event)
    // For other events, each section gets unique eventid (grouped events)
    const eventId = event.name === "Annual Camp Weekend" 
      ? "shared_annual_camp_weekend"
      : `demo_event_${section.sectionid}_${index + 1}`;
    
    const eventName = event.name;
    
    return {
      eventid: eventId,
      name: eventName,
      startdate: getFutureDate(index),
      enddate: getFutureDate(index),
      location: event.location,
      notes: event.name === "Annual Camp Weekend" 
        ? "Multi-section shared camp weekend including external groups"
        : `${event.name} for all sections`,
      cost: event.cost,
      sectionid: section.sectionid,
      sectionname: section.sectionname,
      termid: "term_autumn_2025",
      isShared: event.name === "Annual Camp Weekend"
    };
  });
}

function generateMembersForSection(section) {
  const demoNames = [
    { firstname: "Alice", lastname: "Smith" },
    { firstname: "Bob", lastname: "Jones" },
    { firstname: "Charlie", lastname: "Brown" },
    { firstname: "Diana", lastname: "Wilson" },
    { firstname: "Emma", lastname: "Davis" },
    { firstname: "Felix", lastname: "Miller" },
    { firstname: "Grace", lastname: "Taylor" },
    { firstname: "Henry", lastname: "Anderson" }
  ];

  return demoNames.map((name, index) => ({
    scoutid: `demo_${section.sectionid}_${index + 1}`,
    firstname: name.firstname,
    lastname: name.lastname,
    sectionid: section.sectionid,
    sectionname: section.sectionname,
    patrol: `Patrol ${String.fromCharCode(65 + (index % 3))}`, // A, B, C
    active: 1,
    dateofbirth: getRandomBirthDate(section.section)
  }));
}

function generateAttendanceForEvent(section, eventId) {
  const members = generateMembersForSection(section);
  return members.map(member => ({
    scoutid: member.scoutid,
    attending: Math.random() > 0.3 ? "Yes" : "Invited", 
    firstname: member.firstname,
    lastname: member.lastname,
    sectionid: section.sectionid,
    sectionname: section.sectionname,
    patrolid: 12345 + (parseInt(member.scoutid.split('_')[2]) % 3),
    _filterString: `${member.firstname.toLowerCase()} ${member.lastname.toLowerCase()}`
  }));
}

function getFutureDate(offset) {
  const date = new Date();
  // Create events spanning recent past to near future (dashboard shows events >= 1 week ago)
  // offset 0: 3 days from now, offset 1: 10 days from now, offset 2: 17 days from now, etc.
  const dayOffset = 3 + (offset * 7);
  date.setDate(date.getDate() + dayOffset);
  console.log(`📅 Generated date for offset ${offset}: ${date.toISOString().split('T')[0]} (${dayOffset} days from now)`);
  return date.toISOString().split('T')[0];
}

function getRandomBirthDate(sectionType) {
  const ageRanges = {
    'earlyyears': [4, 6],
    'beavers': [6, 8], 
    'cubs': [8, 11],
    'scouts': [11, 14],
    'explorers': [14, 18],
    'adults': [18, 65]
  };
  
  const [minAge, maxAge] = ageRanges[sectionType] || [8, 11];
  const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
  const birthYear = new Date().getFullYear() - age;
  const birthMonth = Math.floor(Math.random() * 12) + 1;
  const birthDay = Math.floor(Math.random() * 28) + 1;
  
  return `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`;
}

function generateFlexiListsForSection(section) {
  return [
    {
      flexirecordid: `demo_flexi_${section.sectionid}_1`,
      name: "Viking Event Mgmt Camp Groups",
      config: "Camp group assignments for multi-section events",
      sectionid: section.sectionid,
      archived: "0"
    }
  ];
}

function generateFlexiStructure(flexiRecord) {
  const baseStructure = {
    flexirecordid: flexiRecord.flexirecordid,
    name: flexiRecord.name,
    config: flexiRecord.config
  };

  if (flexiRecord.name === "Viking Event Mgmt Camp Groups") {
    return {
      ...baseStructure,
      structure: {
        fields: [
          { fieldid: "group_name", name: "Group Name", type: "text" },
          { fieldid: "leader", name: "Group Leader", type: "text" },
          { fieldid: "members", name: "Group Members", type: "text" }
        ]
      }
    };
  }

  return baseStructure;
}

function generateFlexiData(section, flexiRecord) {
  const members = generateMembersForSection(section);
  
  if (flexiRecord.name === "Viking Event Mgmt Camp Groups") {
    const groups = ["Red Group", "Blue Group", "Green Group"];
    const leaders = ["Sarah", "Mike", "Emma"];
    return members.map((member, index) => ({
      scoutid: member.scoutid,
      firstname: member.firstname,
      lastname: member.lastname,
      group_name: groups[index % 3],
      leader: leaders[index % 3],
      members: `${member.firstname} and 3 others`
    }));
  }

  return [];
}

/**
 * Demo mode configuration object
 */
export const demoConfig = {
  get enabled() { return isDemoMode(); },
  initialize: initializeDemoMode,
};

export default demoConfig;