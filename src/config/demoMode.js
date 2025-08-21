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
    
    // Demo mode detection (logging disabled to reduce console spam)
    
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
  // Demo mode environment variable detected (logging disabled)
  return envDemo;
}

/**
 * Production-based demo data - anonymized real cache structure
 */
const DEMO_CACHE_DATA = {
  viking_sections_offline: [
    {
      'sectionid': 11107,
      'sectionname': 'Demo Adults',
      'section': 'adults', 
      'sectiontype': 'adults',
      'isDefault': false,
      'permissions': {
        'badge': 20,
        'member': 20,
        'user': 100,
        'register': 0,
        'programme': 20,
        'events': 20,
        'flexi': 20,
        'finance': 10,
        'quartermaster': 20,
      },
    },
    {
      'sectionid': 63813,
      'sectionname': 'Demo Squirrels',
      'section': 'earlyyears',
      'sectiontype': 'earlyyears', 
      'isDefault': false,
      'permissions': {
        'badge': 100,
        'member': 100,
        'user': 100,
        'register': 100,
        'programme': 100,
        'events': 100,
        'flexi': 100,
        'finance': 100,
        'quartermaster': 100,
      },
    },
    {
      'sectionid': 11113,
      'sectionname': 'Demo Beavers',
      'section': 'beavers',
      'sectiontype': 'beavers',
      'isDefault': false,
      'permissions': {
        'badge': 100,
        'member': 100,
        'user': 100,
        'register': 100,
        'programme': 100,
        'events': 100,
        'flexi': 100,
        'finance': 100,
        'quartermaster': 100,
      },
    },
    {
      'sectionid': 49097,
      'sectionname': 'Demo Cubs',
      'section': 'cubs',
      'sectiontype': 'cubs',
      'isDefault': true,
      'permissions': {
        'badge': 100,
        'member': 100,
        'user': 100,
        'register': 100,
        'programme': 100,
        'events': 100,
        'flexi': 100,
        'finance': 100,
        'quartermaster': 100,
      },
    },
  ],

  viking_terms_offline: {
    '11107': [
      {
        'termid': '12345',
        'name': 'Autumn Term 2025',
        'startdate': '2025-09-01',
        'enddate': '2025-12-15',
      },
    ],
    '63813': [
      {
        'termid': '12345',
        'name': 'Autumn Term 2025',
        'startdate': '2025-09-01',
        'enddate': '2025-12-15',
      },
    ],
    '11113': [
      {
        'termid': '12345',
        'name': 'Autumn Term 2025',
        'startdate': '2025-09-01',
        'enddate': '2025-12-15',
      },
    ],
    '49097': [
      {
        'termid': '12345',
        'name': 'Autumn Term 2025',
        'startdate': '2025-09-01',
        'enddate': '2025-12-15',
      },
    ],
    '_cacheTimestamp': Date.now(),
  },

  viking_startup_data_offline: {
    'globals': {
      'firstname': 'Demo',
      'lastname': 'Leader', 
      'userid': 'demo_user',
      'email': 'demo@example.com',
    },
    '_cacheTimestamp': Date.now(),
  },
};

/**
 * Initialize demo mode with production-based cache structure
 */
export async function initializeDemoMode() {
  if (!isDemoMode()) return false;
  
  logger.info('🎯 Initializing demo mode with production-based data structure', {}, LOG_CATEGORIES.APP);
  if (import.meta.env.DEV) {
    console.log('🎯 Demo mode starting initialization...');
  }
  
  try {
    // Store sections as array - safeSetItem will handle JSON stringification
    if (import.meta.env.DEV) {
      console.log('📦 Storing sections as array:', DEMO_CACHE_DATA.viking_sections_offline);
    }
    safeSetItem('viking_sections_offline', DEMO_CACHE_DATA.viking_sections_offline);

    // Store other demo cache data
    Object.entries(DEMO_CACHE_DATA).forEach(([key, value]) => {
      if (key === 'viking_sections_offline') return; // Already stored above
      
      const dataWithTimestamp = typeof value === 'object' && value !== null && !Array.isArray(value) 
        ? value 
        : { items: value, _cacheTimestamp: Date.now() };
      
      if (import.meta.env.DEV) {
        console.log(`📦 Storing demo data: ${key}`, dataWithTimestamp);
      }
      safeSetItem(key, dataWithTimestamp);
    });

    // Generate events for each section and store as arrays - safeSetItem will handle JSON stringification
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      const demoEvents = generateEventsForSection(section);
      
      // Store events with TWO cache keys to support both patterns:
      // 1. With termId for api.js getEvents() function
      const termId = '12345';
      const eventsKeyWithTerm = `viking_events_${section.sectionid}_${termId}_offline`;
      
      // 2. Without termId for database.js
      const eventsKeyWithoutTerm = `viking_events_${section.sectionid}_offline`;
      
      // Store as flat array for api.js getEvents (it expects flat array in demo mode)
      if (import.meta.env.DEV) {
        console.log(`📦 Storing events for section ${section.sectionid} with term:`, eventsKeyWithTerm);
        console.log('📦 Also storing without term for database.js:', eventsKeyWithoutTerm);
      }
      safeSetItem(eventsKeyWithTerm, demoEvents);
      
      // Store with timestamp format for database.js
      const eventsWithTimestamp = {
        items: demoEvents,
        _cacheTimestamp: Date.now(),
      };
      safeSetItem(eventsKeyWithoutTerm, eventsWithTimestamp);
    });


    // Generate members for each section and consolidated list
    const allMembers = [];
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      const demoMembers = generateMembersForSection(section);
      const membersWithTimestamp = {
        items: demoMembers,
        _cacheTimestamp: Date.now(),
      };
      safeSetItem(`viking_members_${section.sectionid}_offline`, membersWithTimestamp);
      allMembers.push(...demoMembers);
    });

    // Store consolidated member data for sections page (timestamped format)
    const consolidatedMembersWithTimestamp = {
      items: allMembers,
      _cacheTimestamp: Date.now(),
    };
    if (import.meta.env.DEV) {
      console.log('📦 Storing consolidated members:', consolidatedMembersWithTimestamp);
    }
    safeSetItem('viking_members_offline', consolidatedMembersWithTimestamp);

    // Store comprehensive member data for getMembers() function (flat array format)
    if (import.meta.env.DEV) {
      console.log('📦 Storing comprehensive members for getMembers():', allMembers.length, 'members');
    }
    safeSetItem('viking_members_comprehensive_offline', allMembers);

    // Debug: Check what sections data was stored
    if (import.meta.env.DEV) {
      console.log('📊 Demo sections stored:', DEMO_CACHE_DATA.viking_sections_offline);
    }

    // Generate attendance for events
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      for (let i = 1; i <= 6; i++) {
        const events = generateEventsForSection(section);
        const event = events[i - 1];
        const eventId = event.eventid;
        const attendanceData = generateAttendanceForEvent(section, eventId);
        // Use the correct cache key format expected by useAttendanceData hook
        const cacheKey = `viking_attendance_${section.sectionid}_${event.termid}_${event.eventid}_offline`;
        safeSetItem(cacheKey, attendanceData);
      }
    });


    // Generate flexi records for each section
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      // Generate flexi lists (available flexi records for section)
      const flexiLists = generateFlexiListsForSection(section);
      const flexiListsWithTimestamp = {
        identifier: 'extraid',
        label: 'name', 
        items: flexiLists,
        _cacheTimestamp: Date.now(),
      };
      safeSetItem(`viking_flexi_lists_${section.sectionid}_offline`, flexiListsWithTimestamp);

      // Generate flexi structures and data for each flexi record
      flexiLists.forEach(flexiRecord => {
        const flexiStructure = generateFlexiStructure(flexiRecord);
        const flexiStructureWithTimestamp = {
          ...flexiStructure,
          _cacheTimestamp: Date.now(),
        };
        safeSetItem(`viking_flexi_structure_${flexiRecord.extraid}_offline`, flexiStructureWithTimestamp);

        // Generate flexi data for the current term
        const flexiData = generateFlexiData(section, flexiRecord);
        const flexiDataWithTimestamp = {
          items: flexiData,
          _cacheTimestamp: Date.now(),
        };
        safeSetItem(`viking_flexi_data_${flexiRecord.extraid}_${section.sectionid}_12345_offline`, flexiDataWithTimestamp);
      });
    });

    // Generate shared event metadata for Swimming Gala - store with eventid keys!
    // Swimming Gala is index 1 (second event) for each section
    const swimmingGalaMetadata = generateSwimmingGalaSharedMetadata();
    
    // Store metadata for each section's Swimming Gala event with their specific eventid
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      const events = generateEventsForSection(section);
      const swimmingGalaEvent = events[1]; // Swimming Gala is second event (index 1)
      
      // Add _isOwner flag based on section
      const metadataWithOwnerFlag = {
        ...swimmingGalaMetadata,
        _isOwner: section.sectionid === 11107, // Adults section is owner
      };
      
      // Store with the correct eventid key that the code expects
      const metadataKey = `viking_shared_metadata_${swimmingGalaEvent.eventid}`;
      safeSetItem(metadataKey, metadataWithOwnerFlag);
      
      if (import.meta.env.DEV) {
        console.log(`📋 Stored Swimming Gala metadata for section ${section.sectionname} with key: ${metadataKey}, isOwner: ${metadataWithOwnerFlag._isOwner}`);
      }
    });

    // Pre-populate shared attendance cache for Swimming Gala
    // This matches the production behavior where shared attendance is always cached
    console.log('🏊 Starting shared attendance cache generation for Swimming Gala');
    
    // Generate shared attendance data for Swimming Gala
    // Each section needs its own cache entry with its own eventid
    const sharedAttendanceData = {
      identifier: 'scoutsectionid',
      items: [],
      _rateLimitInfo: {
        osm: { limit: 1000, remaining: 995, resetTime: 3600000, rateLimited: false },
        backend: { 
          minute: { remaining: '99', limit: '100', reset: String(Math.floor(Date.now() / 1000) + 60) },
          second: { remaining: '5', limit: '5', reset: String(Math.floor(Date.now() / 1000) + 1) },
          hour: { remaining: '899', limit: '900', reset: String(Math.floor(Date.now() / 1000) + 3600) },
          remaining: '5', limit: '100', 
        },
      },
    };
    
    // Generate attendance records for all sections in shared event (including external)
    swimmingGalaMetadata._allSections.forEach(sectionInfo => {
      if (sectionInfo.groupname === 'TOTAL') return; // Skip total row
      
      // Generate attendance records for this section
      const sectionAttendance = generateProductionFormatAttendanceInline(
        String(sectionInfo.sectionid),
        sectionInfo.sectionname, 
        sectionInfo.groupname,
        sectionInfo.eventid,
        sectionInfo.attendance,
        sectionInfo.none,
      );
      
      sharedAttendanceData.items.push(...sectionAttendance);
    });
    
    // Now create cache entries for each section using THEIR OWN event ID
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      const events = generateEventsForSection(section);
      const swimmingGalaEvent = events[1]; // Swimming Gala is second event
      
      // Use THIS section's eventid in the cache key
      const sharedCacheKey = `viking_shared_attendance_${swimmingGalaEvent.eventid}_${section.sectionid}_offline`;
      
      console.log(`💾 Caching shared attendance with key: ${sharedCacheKey}`);
      console.log(`💾 Data has ${sharedAttendanceData.items.length} items`);
      
      safeSetItem(sharedCacheKey, {
        ...sharedAttendanceData,
        _cacheTimestamp: Date.now(),
      });
      
      if (import.meta.env.DEV) {
        logger.debug('Cached shared attendance for Swimming Gala', {
          eventId: swimmingGalaEvent.eventid,
          sectionId: section.sectionid,
          cacheKey: sharedCacheKey,
          attendeeCount: sharedAttendanceData.items.length,
        }, LOG_CATEGORIES.APP);
      }
    });
    
    // Inline function to generate attendance records during initialization
    function generateProductionFormatAttendanceInline(sectionid, sectionname, groupname, eventid, attendingCount, notAttendingCount) {
      const members = [];
      
      // Generate demo member names based on section
      const memberNamesBySection = {
        '11107': ['Sarah Mitchell', 'David Parker', 'Rachel Thompson', 'Mark Roberts', 'Helen Clarke'],
        '63813': ['Emma Johnson', 'Tom Williams', 'Sophie Davies', 'Oliver Thomas', 'Mia Jackson'], 
        '11113': ['Kate Smith', 'Mike Jones', 'Ben Brown', 'Alice Wilson', 'Charlie Davis'],
        '49097': ['Anna Green', 'Chris Cooper', 'Jamie Ward', 'Maya Bell', 'Sam King'],
        'external_scouts_001': ['Lisa Harper', 'James Peterson', 'Amy Carter', 'Ryan Foster', 'Emma Taylor', 'Nathan Hill', 'Olivia White'],
      };
      
      const namePool = memberNamesBySection[sectionid] || memberNamesBySection['49097'];
      const eventDate = '2025-08-30';
      
      // Generate attending members
      for (let i = 0; i < attendingCount && i < namePool.length; i++) {
        const firstName = namePool[i].split(' ')[0];
        const lastName = namePool[i].split(' ')[1] || 'Member';
        const scoutId = `${sectionid}${String(i + 1000).slice(-3)}`;
        const scoutSectionId = `${scoutId}-${sectionid}`;
        const isAdults = sectionname.toLowerCase().includes('adult');
        const age = isAdults ? '25+' : `${10 + (i % 3)} / ${String(i % 12).padStart(2, '0')}`;
        const dob = isAdults ? '1985-07-22' : `20${14 - (i % 3)}-${String((i % 12) + 1).padStart(2, '0')}-15`;
        
        members.push({
          scoutid: scoutId,
          attending: 'Yes',
          dob: dob,
          startdate: eventDate,
          patrolid: `${sectionid}${i + 1}`,
          sectionid: sectionid === 'external_scouts_001' ? sectionid : parseInt(sectionid),
          eventid: eventid,
          firstname: firstName,
          lastname: lastName,
          photo_guid: null,
          enddate: null,
          scoutsectionid: scoutSectionId,
          age: age,
          groupname: groupname,
          sectionname: sectionname,
          _filterString: `${scoutId} Yes ${dob} ${eventDate} ${sectionid}${i + 1} ${sectionid} ${eventid} ${firstName} ${lastName}   ${scoutSectionId} ${age} ${groupname} ${sectionname}`,
        });
      }
      
      // Generate non-attending members
      const remainingNames = namePool.slice(attendingCount);
      for (let i = 0; i < notAttendingCount && i < remainingNames.length; i++) {
        const firstName = remainingNames[i].split(' ')[0];
        const lastName = remainingNames[i].split(' ')[1] || 'Member';
        const scoutId = `${sectionid}${String(i + attendingCount + 1000).slice(-3)}`;
        const scoutSectionId = `${scoutId}-${sectionid}`;
        const isAdults = sectionname.toLowerCase().includes('adult');
        const age = isAdults ? '25+' : `${10 + ((i + attendingCount) % 3)} / ${String((i + attendingCount) % 12).padStart(2, '0')}`;
        const dob = isAdults ? '1980-03-15' : `20${14 - ((i + attendingCount) % 3)}-${String(((i + attendingCount) % 12) + 1).padStart(2, '0')}-20`;
        
        members.push({
          scoutid: scoutId,
          attending: 'No',
          dob: dob,
          startdate: eventDate,
          patrolid: `${sectionid}${i + attendingCount + 1}`,
          sectionid: sectionid === 'external_scouts_001' ? sectionid : parseInt(sectionid),
          eventid: eventid,
          firstname: firstName,
          lastname: lastName,
          photo_guid: null,
          enddate: null,
          scoutsectionid: scoutSectionId,
          age: age,
          groupname: groupname,
          sectionname: sectionname,
          _filterString: `${scoutId} No ${dob} ${eventDate} ${sectionid}${i + attendingCount + 1} ${sectionid} ${eventid} ${firstName} ${lastName}   ${scoutSectionId} ${age} ${groupname} ${sectionname}`,
        });
      }
      
      return members;
    }

    logger.info('✅ Demo mode cache populated successfully with production structure', {
      sections: DEMO_CACHE_DATA.viking_sections_offline.length,
      totalDataKeys: Object.keys(DEMO_CACHE_DATA).length + (DEMO_CACHE_DATA.viking_sections_offline.length * 3),
      sharedEventsWithCache: 'Swimming Gala',
    }, LOG_CATEGORIES.APP);
    if (import.meta.env.DEV) {
      console.log('✅ Demo mode initialization complete! Check localStorage for cached data.');
    }
    
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
    { name: 'Annual Camp Weekend', location: 'Camp Wilderness', cost: '35.00' },
    { name: 'Swimming Gala (Shared)', location: 'Leisure Centre', cost: '8.00' },
    { name: 'Hiking Adventure', location: 'Surrey Hills', cost: '5.00' },
    { name: 'Craft Workshop', location: 'Scout Hall', cost: '3.00' },
    { name: 'Games Tournament', location: 'Scout Hall', cost: '2.00' },
    { name: 'Pizza Night', location: 'Scout Hall', cost: '10.00' },
  ];

  return baseEvents.map((event, index) => {
    // Each section gets a unique eventid 
    // Events with same name are NOT shared - they're just grouped by name
    const eventId = `demo_event_${section.sectionid}_${index + 1}`;
    
    const eventName = event.name;
    
    return {
      eventid: eventId,
      name: eventName,
      eventname: eventName,
      startdate: getFutureDate(index),
      enddate: getFutureDate(index),
      location: event.location,
      notes: `${event.name} for ${section.sectionname}`,
      cost: event.cost,
      sectionid: section.sectionid,
      sectionname: section.sectionname,
      termid: '12345',
    };
  });
}

function generateMembersForSection(section) {
  // Generate random member count between 18-24 per section
  const memberCount = Math.floor(Math.random() * (24 - 18 + 1)) + 18;
  
  // Always have 2 leaders and 1 young leader per section
  const leaderCount = 2;
  const youngLeaderCount = 1;
  const youngPeopleCount = memberCount - leaderCount - youngLeaderCount;
  
  // Generate unique names per section to avoid cross-section duplicates
  const namesBySection = {
    adults: {
      Leaders: ['Sarah Mitchell', 'David Parker'],
      'Young Leaders': ['Rachel Thompson'],
      'Young People': [
        'Mark Roberts', 'Helen Clarke', 'James Wright', 'Lisa Hughes', 'Paul Stewart',
        'Simon Ward', 'Kate Bell', 'Tom Green', 'Amy White', 'Rob Davis',
        'Lucy Brown', 'Dan Miller', 'Sue Taylor', 'Jim Wilson', 'Ann Clark',
        'Max Reed', 'Eva Cook', 'Leo King', 'Zoe Hill', 'Sam Fox',
      ],
    },
    earlyyears: {
      Leaders: ['Emma Johnson', 'Tom Williams'],
      'Young Leaders': ['Sophie Davies'],
      'Young People': [
        'Lily Evans', 'Oliver Thomas', 'Mia Jackson', 'Lucas White', 'Ella Harris',
        'Noah Stone', 'Ruby Lane', 'Jack Price', 'Chloe West', 'Ryan East',
        'Grace Hunt', 'Liam Shaw', 'Ava Gray', 'Ethan Wood', 'Zara Moon',
        'Jake Star', 'Luna Ray', 'Cole Blue', 'Iris Gold', 'Rex Pine',
      ],
    },
    beavers: {
      Leaders: ['Kate Smith', 'Mike Jones'],
      'Young Leaders': ['Ben Brown'],
      'Young People': [
        'Alice Wilson', 'Charlie Davis', 'Diana Miller', 'Felix Taylor', 'Grace Anderson',
        'Harry Cross', 'Ivy North', 'Jack South', 'Kara Vale', 'Luke Park',
        'Maya Rose', 'Nick Sage', 'Opal Clay', 'Pete Moss', 'Quin Dale',
        'Ruby Fern', 'Seth Pond', 'Tara Glen', 'Uma Brook', 'Vick Lake',
      ],
    },
    cubs: {
      Leaders: ['Anna Green', 'Chris Cooper'],
      'Young Leaders': ['Jamie Ward'],
      'Young People': [
        'Maya Bell', 'Sam King', 'Ruby Reed', 'Jake Cook', 'Zoe Price',
        'Alex Ford', 'Beth Lane', 'Carl Bond', 'Dana Love', 'Evan Hope',
        'Faye Wise', 'Glen Hart', 'Hope Fair', 'Ivan Bold', 'Jade True',
        'Kane Wild', 'Lara Free', 'Mark Pure', 'Nora Kind', 'Owen Good',
      ],
    },
  };
  
  const sectionNames = namesBySection[section.sectiontype] || namesBySection.cubs;
  
  const members = [];
  let memberIndex = 1;
  
  // Add leaders
  for (let i = 0; i < leaderCount; i++) {
    const [firstname, lastname] = sectionNames.Leaders[i % sectionNames.Leaders.length].split(' ');
    members.push({
      scoutid: `demo_${section.sectionid}_${memberIndex++}`,
      firstname,
      lastname,
      person_type: 'Leaders',
      sectionid: section.sectionid,
      sectionname: section.sectionname,
      patrol: `Patrol ${String.fromCharCode(65 + (members.length % 3))}`, // A, B, C
      active: 1,
      dateofbirth: getRandomBirthDate(section.section, 'Leaders'),
    });
  }
  
  // Add young leaders
  for (let i = 0; i < youngLeaderCount; i++) {
    const [firstname, lastname] = sectionNames['Young Leaders'][i % sectionNames['Young Leaders'].length].split(' ');
    members.push({
      scoutid: `demo_${section.sectionid}_${memberIndex++}`,
      firstname,
      lastname,
      person_type: 'Young Leaders',
      sectionid: section.sectionid,
      sectionname: section.sectionname,
      patrol: `Patrol ${String.fromCharCode(65 + (members.length % 3))}`, // A, B, C
      active: 1,
      dateofbirth: getRandomBirthDate(section.section, 'Young Leaders'),
    });
  }
  
  // Add young people
  for (let i = 0; i < youngPeopleCount; i++) {
    const [firstname, lastname] = sectionNames['Young People'][i % sectionNames['Young People'].length].split(' ');
    members.push({
      scoutid: `demo_${section.sectionid}_${memberIndex++}`,
      firstname,
      lastname,
      person_type: 'Young People',
      sectionid: section.sectionid,
      sectionname: section.sectionname,
      patrol: `Patrol ${String.fromCharCode(65 + (members.length % 3))}`, // A, B, C
      active: 1,
      dateofbirth: getRandomBirthDate(section.section, 'Young People'),
    });
  }

  return members;
}

function generateAttendanceForEvent(section, _eventId) {
  const members = generateMembersForSection(section);
  return members.map(member => {
    // Generate realistic attendance distribution
    const randomValue = Math.random();
    let attending;
    
    if (randomValue < 0.5) {
      attending = 'Yes';        // 50% - confirmed attending
    } else if (randomValue < 0.7) {
      attending = 'Invited';    // 20% - invited but not responded
    } else if (randomValue < 0.85) {
      attending = 'No';         // 15% - confirmed not attending
    } else {
      attending = '';           // 15% - not invited (empty string)
    }
    
    return {
      scoutid: member.scoutid,
      attending: attending,
      firstname: member.firstname,
      lastname: member.lastname,
      sectionid: section.sectionid,
      sectionname: section.sectionname,
      patrolid: 12345 + (parseInt(member.scoutid.split('_')[2]) % 3),
      _filterString: `${member.firstname.toLowerCase()} ${member.lastname.toLowerCase()}`,
    };
  });
}

function getFutureDate(offset) {
  const date = new Date();
  // Create events spanning recent past to near future (dashboard shows events >= 1 week ago)
  // offset 0: 3 days from now, offset 1: 10 days from now, offset 2: 17 days from now, etc.
  const dayOffset = 3 + (offset * 7);
  date.setDate(date.getDate() + dayOffset);
  // Removed console.log to reduce noise
  return date.toISOString().split('T')[0];
}

function getRandomBirthDate(sectionType, personType = 'Young People') {
  let ageRange;
  
  // Override age ranges based on person type
  if (personType === 'Leaders') {
    ageRange = [25, 55]; // Adult leaders
  } else if (personType === 'Young Leaders') {
    ageRange = [18, 24]; // Young adult leaders
  } else {
    // Young People - use section-appropriate ages
    const ageRanges = {
      'earlyyears': [4, 6],
      'beavers': [6, 8], 
      'cubs': [8, 11],
      'scouts': [11, 14],
      'explorers': [14, 18],
      'adults': [18, 65],
    };
    ageRange = ageRanges[sectionType] || [8, 11];
  }
  
  const [minAge, maxAge] = ageRange;
  const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
  const birthYear = new Date().getFullYear() - age;
  const birthMonth = Math.floor(Math.random() * 12) + 1;
  const birthDay = Math.floor(Math.random() * 28) + 1;
  
  return `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`;
}

function generateFlexiListsForSection(section) {
  return [
    {
      extraid: `demo_flexi_${section.sectionid}_1`,
      name: 'Viking Event Mgmt',
    },
  ];
}

function generateFlexiStructure(flexiRecord) {
  if (flexiRecord.name === 'Viking Event Mgmt') {
    return {
      extraid: flexiRecord.extraid,
      sectionid: '49097',
      name: 'Viking Event Mgmt',
      config: JSON.stringify([
        {'id': 'f_1', 'name': 'CampGroup', 'width': '150'},
        {'id': 'f_2', 'name': 'SignedInBy', 'width': '150'}, 
        {'id': 'f_3', 'name': 'SignedInWhen', 'width': '150'},
        {'id': 'f_4', 'name': 'SignedOutBy', 'width': '150'},
        {'id': 'f_5', 'name': 'SignedOutWhen', 'width': '150'},
      ]),
      total: 'none',
      extrafields: '[]',
      archived: '0',
      soft_deleted: '0',
      archived_at: null,
      structure: [
        {
          rows: [
            {name: 'First Name', field: 'firstname', width: '150px', formatter: 'boldFormatter'},
            {name: 'Last Name', field: 'lastname', width: '150px'},
          ],
          noscroll: true,
        },
        {
          rows: [
            {name: 'CampGroup', field: 'f_1', width: '150px', formatter: 'boldFormatter', editable: true},
            {name: 'SignedInBy', field: 'f_2', width: '150px', formatter: 'boldFormatter', editable: true},
            {name: 'SignedInWhen', field: 'f_3', width: '150px', formatter: 'boldFormatter', editable: true},
            {name: 'SignedOutBy', field: 'f_4', width: '150px', formatter: 'boldFormatter', editable: true},
            {name: 'SignedOutWhen', field: 'f_5', width: '150px', formatter: 'boldFormatter', editable: true},
          ],
        },
      ],
    };
  }

  return {
    extraid: flexiRecord.extraid,
    name: flexiRecord.name,
  };
}

function generateFlexiData(section, flexiRecord) {
  const members = generateMembersForSection(section);
  
  if (flexiRecord.name === 'Viking Event Mgmt') {
    const campGroups = ['Red Admirals', 'Blue Dolphins', 'Green Turtles', 'Yellow Seahorses'];
    const leaders = ['Sarah Mitchell', 'David Parker', 'Rachel Thompson'];
    const signInTimes = ['09:15', '09:30', '09:45', '10:00'];
    const signOutTimes = ['16:30', '16:45', '17:00', '17:15'];
    
    return members.map((member, index) => {
      // Only some members have been signed in/out (realistic camp scenario)
      const isSignedIn = Math.random() > 0.3; // 70% signed in
      const isSignedOut = isSignedIn && Math.random() > 0.4; // 60% of signed in have also signed out
      
      return {
        scoutid: member.scoutid,
        firstname: member.firstname,
        lastname: member.lastname,
        f_1: campGroups[index % campGroups.length], // CampGroup
        f_2: isSignedIn ? leaders[index % leaders.length] : '', // SignedInBy
        f_3: isSignedIn ? `2025-08-23 ${signInTimes[index % signInTimes.length]}` : '', // SignedInWhen
        f_4: isSignedOut ? leaders[(index + 1) % leaders.length] : '', // SignedOutBy
        f_5: isSignedOut ? `2025-08-23 ${signOutTimes[index % signOutTimes.length]}` : '', // SignedOutWhen
      };
    });
  }

  return [];
}

function generateSwimmingGalaSharedMetadata() {
  // Find the Swimming Gala event from our demo sections (should be event index 1)
  const swimmingGalaEvents = DEMO_CACHE_DATA.viking_sections_offline.map(section => {
    const events = generateEventsForSection(section);
    return events[1]; // Swimming Gala is the second event (index 1)
  });
  
  // Use the first event as the source event template
  const sourceEvent = swimmingGalaEvents[0];
  
  // Calculate consistent attendance numbers (not random)
  const adultAttendance = 1;
  const squirrelAttendance = 2; 
  const beaverAttendance = 3;
  const cubAttendance = 2;
  const externalAttendance = 2; // External section accepted with attendance
  const totalAttendance = adultAttendance + squirrelAttendance + beaverAttendance + cubAttendance + externalAttendance; // All sections

  return {
    _isSharedEvent: true,
    _allSections: [
      // Our 4 demo sections - matching JOTI production structure exactly
      {
        attendance: adultAttendance,
        emailable: true,
        groupname: '1st Walton (Viking) Sea Scouts',
        sectionname: 'Demo Adults',
        eventid: 'demo_event_11107_2',
        sectionid: '11107', // String like production shared metadata
        none: 3,
        status: 'Owner',
        attendancelimit: 0, // 0 like JOTI production
        receiving_eventid: 'demo_event_11107_2',
        _filterString: '1st Walton (Viking) Sea Scouts Demo Adults Owner',
      },
      {
        attendance: squirrelAttendance,
        emailable: true,
        groupname: '1st Walton (Viking) Sea Scouts',
        sectionname: 'Demo Squirrels', 
        eventid: 'demo_event_63813_2',
        sectionid: '63813', // String like production
        none: 5,
        status: 'Accepted',
        attendancelimit: 0,
        receiving_eventid: 'demo_event_63813_2',
        _filterString: '1st Walton (Viking) Sea Scouts Demo Squirrels Accepted',
      },
      {
        attendance: beaverAttendance,
        emailable: true,
        groupname: '1st Walton (Viking) Sea Scouts', 
        sectionname: 'Demo Beavers',
        eventid: 'demo_event_11113_2',
        sectionid: '11113', // String like production
        none: 4,
        status: 'Accepted',
        attendancelimit: 0,
        receiving_eventid: 'demo_event_11113_2',
        _filterString: '1st Walton (Viking) Sea Scouts Demo Beavers Accepted',
      },
      {
        attendance: cubAttendance,
        emailable: true,
        groupname: '1st Walton (Viking) Sea Scouts',
        sectionname: 'Demo Cubs',
        eventid: 'demo_event_49097_2', 
        sectionid: '49097', // String like production
        none: 2,
        status: 'Accepted', 
        attendancelimit: 0,
        receiving_eventid: 'demo_event_49097_2',
        _filterString: '1st Walton (Viking) Sea Scouts Demo Cubs Accepted',
      },
      // External section - accepted with attending members
      {
        attendance: externalAttendance,
        emailable: false, // External sections often not emailable but can still participate
        groupname: '2nd Elmbridge Scout Group',
        sectionname: 'External Scouts',
        eventid: 'external_swimming_gala_2025',
        sectionid: 'external_scouts_001',
        none: 1, // Some not attending
        status: 'Accepted', // External section accepted the invitation
        attendancelimit: 0,
        receiving_eventid: 'external_swimming_gala_2025',
        _filterString: '2nd Elmbridge Scout Group External Scouts Accepted',
      },
      // Total row - matches production exactly
      {
        groupname: 'TOTAL',
        sectionname: '',
        status: '',
        attendance: totalAttendance, // Only attending sections count
        attendancelimit: '',
        none: -1,
      },
    ],
    _sourceEvent: {
      eventid: sourceEvent.eventid,
      name: 'Swimming Gala (Shared)',
      date: '08/30/2025', // Production format MM/dd/yyyy
      startdate_g: '2025-08-30',
      startdate: '08/30/2025', 
      enddate: '08/30/2025',
      starttime: '14:00:00',
      endtime: '17:00:00', 
      cost: '8.00',
      location: 'Leisure Centre',
      approval_status: null,
      rota_offered: 0,
      rota_accepted: 0,
      rota_required: null,
      yes: totalAttendance, // Total attending across all sections
      yes_members: totalAttendance - 1, // Members (non-leaders)
      yes_yls: 0, 
      yes_leaders: 1, // One leader attending (Adult section)
      reserved: 0,
      no: 16, // Total not attending (3+5+4+2+2)
      invited: totalAttendance + 16, // Total invited
      shown: 0,
      x: totalAttendance + 50, // Production often has higher x value
      date_iso: '2025-08-30',
      date_original: '30/08/2025', // Production uses dd/mm/yyyy in original
      startdate_iso: '2025-08-30',
      startdate_original: '30/08/2025',
      enddate_iso: '2025-08-30', 
      enddate_original: '30/08/2025',
      sectionid: 11107, // Numeric like production
      sectionname: 'Demo Adults', 
      termid: '12345',
    },
  };
}

/**
 * Generate attendance records matching exact production shared attendance format
 */
function generateProductionFormatAttendance(sectionid, sectionname, groupname, eventid, attendingCount, notAttendingCount) {
  const members = [];
  
  // Generate demo member names based on section
  const memberNamesBySection = {
    '11107': ['Sarah Mitchell', 'David Parker', 'Rachel Thompson', 'Mark Roberts', 'Helen Clarke'],
    '63813': ['Emma Johnson', 'Tom Williams', 'Sophie Davies', 'Oliver Thomas', 'Mia Jackson'], 
    '11113': ['Kate Smith', 'Mike Jones', 'Ben Brown', 'Alice Wilson', 'Charlie Davis'],
    '49097': ['Anna Green', 'Chris Cooper', 'Jamie Ward', 'Maya Bell', 'Sam King'],
    'external_scouts_001': ['Lisa Harper', 'James Peterson', 'Amy Carter', 'Ryan Foster', 'Emma Taylor'],
  };
  
  const namePool = memberNamesBySection[sectionid] || memberNamesBySection['49097'];
  const eventDate = '2025-08-30'; // Swimming Gala date
  
  // Generate attending members with full production structure
  for (let i = 0; i < attendingCount && i < namePool.length; i++) {
    const firstName = namePool[i].split(' ')[0];
    const lastName = namePool[i].split(' ')[1] || 'Member';
    const scoutId = `${sectionid}${String(i + 1000).slice(-3)}`; // Generate realistic scout IDs
    const scoutSectionId = `${scoutId}-${sectionid}`;
    
    // Generate age based on section type - Adults get "25+", others get "yy / mm" format
    const isAdults = sectionname.toLowerCase().includes('adult');
    const age = isAdults ? '25+' : `${10 + (i % 3)} / ${String(i % 12).padStart(2, '0')}`;
    const dob = isAdults ? '1985-07-22' : `20${14 - (i % 3)}-${String((i % 12) + 1).padStart(2, '0')}-15`;
    
    members.push({
      scoutid: scoutId,
      attending: 'Yes',
      dob: dob,
      startdate: eventDate,
      patrolid: `${sectionid}${i + 1}`, // Sample patrol ID
      sectionid: sectionid === 'external_scouts_001' ? sectionid : parseInt(sectionid), // Numeric except for external
      eventid: eventid,
      firstname: firstName,
      lastname: lastName,
      photo_guid: null, // No photos in demo
      enddate: null,
      scoutsectionid: scoutSectionId,
      age: age,
      groupname: groupname,
      sectionname: sectionname,
      _filterString: `${scoutId} Yes ${dob} ${eventDate} ${sectionid}${i + 1} ${sectionid} ${eventid} ${firstName} ${lastName}   ${scoutSectionId} ${age} ${groupname} ${sectionname}`,
    });
  }
  
  // Generate non-attending members
  const remainingNames = namePool.slice(attendingCount);
  for (let i = 0; i < notAttendingCount && i < remainingNames.length; i++) {
    const firstName = remainingNames[i].split(' ')[0];
    const lastName = remainingNames[i].split(' ')[1] || 'Member';
    const scoutId = `${sectionid}${String(i + attendingCount + 1000).slice(-3)}`;
    const scoutSectionId = `${scoutId}-${sectionid}`;
    
    // Generate age for non-attending members - same logic as attending
    const isAdults = sectionname.toLowerCase().includes('adult');
    const age = isAdults ? '25+' : `${10 + ((i + attendingCount) % 3)} / ${String((i + attendingCount) % 12).padStart(2, '0')}`;
    const dob = isAdults ? '1980-03-15' : `20${14 - ((i + attendingCount) % 3)}-${String(((i + attendingCount) % 12) + 1).padStart(2, '0')}-20`;
    
    members.push({
      scoutid: scoutId,
      attending: 'No',
      dob: dob,
      startdate: eventDate,
      patrolid: `${sectionid}${i + attendingCount + 1}`,
      sectionid: sectionid === 'external_scouts_001' ? sectionid : parseInt(sectionid), // Numeric except for external
      eventid: eventid,
      firstname: firstName,
      lastname: lastName,
      photo_guid: null,
      enddate: null,
      scoutsectionid: scoutSectionId,
      age: age,
      groupname: groupname,
      sectionname: sectionname,
      _filterString: `${scoutId} No ${dob} ${eventDate} ${sectionid}${i + attendingCount + 1} ${sectionid} ${eventid} ${firstName} ${lastName}   ${scoutSectionId} ${age} ${groupname} ${sectionname}`,
    });
  }
  
  return members;
}

/**
 * Demo mode configuration object
 */
export const demoConfig = {
  get enabled() { return isDemoMode(); },
  initialize: initializeDemoMode,
};

export default demoConfig;