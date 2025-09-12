// Demo mode configuration and initialization
// Handles demo mode initialization and data pre-population using production data structure

import { safeSetItem } from '../shared/utils/storageUtils.js';
import logger, { LOG_CATEGORIES } from '../shared/services/utils/logger.js';

// Global variable declarations for ESLint
/* global URLSearchParams */

/**
 * Detects if the application should run in demonstration mode for offline Scout event management.
 * Checks multiple detection methods including URL parameters, subdomain patterns, and environment variables
 * to determine if demo mode should be enabled for showcasing features without live OSM data.
 * 
 * @returns {boolean} True if demo mode should be enabled, false for production operation
 * @since 1.0.0
 * @example
 * // Check if running in demo mode before initializing data
 * if (isDemoMode()) {
 *   console.log('Running in demonstration mode');
 *   await initializeDemoMode();
 * }
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
    
    // Demo mode detection (logging removed to prevent console spam)
    
    if (demoParam || modeParam) {
      return true;
    }
    
    // Check subdomain
    if (window.location.hostname && window.location.hostname.startsWith('demo.')) {
      return true;
    }
    
    // Check path
    if (window.location.pathname && window.location.pathname.startsWith('/demo')) {
      return true;
    }
  } catch (error) {
    // Fallback to environment variable if window access fails
    logger.warn('Demo mode detection failed, falling back to environment variable', {
      error: error.message,
    }, LOG_CATEGORIES.APP);
  }
  
  // Environment variable fallback
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

// Internal cache to keep member identities consistent across generators
const DEMO_MEMBERS_BY_SECTION = new Map();

/**
 * Production-based demo data structure containing anonymized Scout section and event information.
 * Provides realistic demo data that mirrors actual OSM cache structure for comprehensive testing
 * and demonstration of Scout event management features across different section types.
 * 
 * @type {object} Demo cache data with sections, terms, and startup information
 * @property {Array<object>} viking_sections_offline - Scout sections (Adults, Squirrels, Beavers, Cubs)
 * @property {object} viking_terms_offline - Term definitions by section ID
 * @property {object} viking_startup_data_offline - Global user and system configuration
 * @since 1.0.0
 */
const DEMO_CACHE_DATA = {
  viking_sections_offline: [
    {
      'sectionid': 999901,
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
      'sectionid': 999902,
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
      'sectionid': 999903,
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
      'sectionid': 999904,
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
    '999901': [
      {
        'termid': '12345',
        'name': 'Autumn Term 2025',
        'startdate': '2025-09-01',
        'enddate': '2025-12-15',
      },
    ],
    '999902': [
      {
        'termid': '12345',
        'name': 'Autumn Term 2025',
        'startdate': '2025-09-01',
        'enddate': '2025-12-15',
      },
    ],
    '999903': [
      {
        'termid': '12345',
        'name': 'Autumn Term 2025',
        'startdate': '2025-09-01',
        'enddate': '2025-12-15',
      },
    ],
    '999904': [
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
 * Initializes comprehensive demo mode by populating local storage with realistic Scout event data.
 * Creates complete demonstration environment including sections, members, events, attendance records,
 * flexi records, and shared event metadata to showcase full Scout event management capabilities.
 * 
 * @returns {Promise<boolean>} Promise resolving to true if initialization succeeded, false otherwise
 * @since 1.0.0
 * @example
 * // Initialize demo mode during application startup
 * const demoInitialized = await initializeDemoMode();
 * if (demoInitialized) {
 *   console.log('Demo mode ready with sample Scout data');
 * }
 */
export async function initializeDemoMode() {
  if (!isDemoMode()) return false;
  
  logger.info('🎯 Initializing demo mode with production-based data structure', {}, LOG_CATEGORIES.APP);
  
  try {
    // Store sections as array with demo prefix - safeSetItem will handle JSON stringification
    safeSetItem('demo_viking_sections_offline', DEMO_CACHE_DATA.viking_sections_offline);

    // Store other demo cache data with demo prefix for consistency
    Object.entries(DEMO_CACHE_DATA).forEach(([key, value]) => {
      if (key === 'viking_sections_offline') return; // Already stored above
      
      const dataWithTimestamp = typeof value === 'object' && value !== null && !Array.isArray(value) 
        ? value 
        : { items: value, _cacheTimestamp: Date.now() };
      
      // Add demo prefix to all cache keys for consistency
      const demoKey = `demo_${key}`;
      safeSetItem(demoKey, dataWithTimestamp);
    });

    // Generate events for each section and store as arrays - safeSetItem will handle JSON stringification
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      const demoEvents = generateEventsForSection(section);
      
      // Store events with TWO cache keys to support both patterns:
      // 1. With termId for api.js getEvents() function - DEMO PREFIXED
      const termId = '12345';
      const eventsKeyWithTerm = `demo_viking_events_${section.sectionid}_${termId}_offline`;
      
      // 2. Without termId for database.js - DEMO PREFIXED
      const eventsKeyWithoutTerm = `demo_viking_events_${section.sectionid}_offline`;
      
      // Store as flat array for api.js getEvents (it expects flat array in demo mode)
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
      // Cache members for cross-dataset identity consistency
      DEMO_MEMBERS_BY_SECTION.set(section.sectionid, demoMembers);
      const membersWithTimestamp = {
        items: demoMembers,
        _cacheTimestamp: Date.now(),
      };
      safeSetItem(`demo_viking_members_${section.sectionid}_offline`, membersWithTimestamp);
      allMembers.push(...demoMembers);
    });

    // Store consolidated member data for sections page (timestamped format)
    const consolidatedMembersWithTimestamp = {
      items: allMembers,
      _cacheTimestamp: Date.now(),
    };
    safeSetItem('demo_viking_members_offline', consolidatedMembersWithTimestamp);

    // Store comprehensive member data for getMembers() function (flat array format)
    safeSetItem('demo_viking_members_comprehensive_offline', allMembers);

    // Demo sections stored successfully

    // Generate attendance for events
    DEMO_CACHE_DATA.viking_sections_offline.forEach(section => {
      for (let i = 1; i <= 6; i++) {
        const events = generateEventsForSection(section);
        const event = events[i - 1];
        const eventId = event.eventid;
        const attendanceData = generateAttendanceForEvent(section, eventId);
        // Use demo-prefixed cache key format
        const cacheKey = `demo_viking_attendance_${section.sectionid}_${event.termid}_${event.eventid}_offline`;
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
      safeSetItem(`demo_viking_flexi_lists_${section.sectionid}_offline`, flexiListsWithTimestamp);

      // Generate flexi structures and data for each flexi record
      flexiLists.forEach(flexiRecord => {
        const flexiStructure = generateFlexiStructure(flexiRecord);
        const flexiStructureWithTimestamp = {
          ...flexiStructure,
          _cacheTimestamp: Date.now(),
        };
        safeSetItem(`demo_viking_flexi_structure_${flexiRecord.extraid}_offline`, flexiStructureWithTimestamp);

        // Generate flexi data for the current term
        const flexiData = generateFlexiData(section, flexiRecord);
        const flexiDataWithTimestamp = {
          items: flexiData,
          _cacheTimestamp: Date.now(),
        };
        safeSetItem(`demo_viking_flexi_data_${flexiRecord.extraid}_${section.sectionid}_12345_offline`, flexiDataWithTimestamp);
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
        _isOwner: section.sectionid === 999901, // Adults section is owner
      };
      
      // Store with the correct eventid key that the code expects - demo prefixed
      const metadataKey = `demo_viking_shared_metadata_${swimmingGalaEvent.eventid}`;
      safeSetItem(metadataKey, metadataWithOwnerFlag);
      
    });

    // Pre-populate shared attendance cache for Swimming Gala
    // This matches the production behavior where shared attendance is always cached
    
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
      
      // Use THIS section's eventid in the cache key - demo prefixed
      const sharedCacheKey = `demo_viking_shared_attendance_${swimmingGalaEvent.eventid}_${section.sectionid}_offline`;
      
      
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
    
    /**
     * Generates production-format attendance records for shared Scout events during demo initialization.
     * Creates realistic attendance data including member details, ages, patrol assignments,
     * and filter strings that match OSM production format for seamless demo operation.
     * 
     * @param {string} sectionid - OSM section identifier (e.g., '999904', 'external_scouts_001')
     * @param {string} sectionname - Display name of the Scout section (e.g., 'Demo Cubs')
     * @param {string} groupname - Scout group name for organizational context
     * @param {string} eventid - Event identifier for attendance tracking
     * @param {number} attendingCount - Number of members marked as attending
     * @param {number} notAttendingCount - Number of members marked as not attending
     * @returns {Array<object>} Array of attendance records with full OSM production structure
     * @since 1.0.0
     * @example
     * // Generate shared event attendance for Swimming Gala
     * const attendance = generateProductionFormatAttendanceInline(
     *   '999904', 'Demo Cubs', '1st Walton Sea Scouts', 'event123', 5, 2
     * );
     */
    function generateProductionFormatAttendanceInline(sectionid, sectionname, groupname, eventid, attendingCount, notAttendingCount) {
      const members = [];
      
      // Generate demo member names based on section
      const memberNamesBySection = {
        '999901': ['Sarah Mitchell', 'David Parker', 'Rachel Thompson', 'Mark Roberts', 'Helen Clarke'],
        '999902': ['Emma Johnson', 'Tom Williams', 'Sophie Davies', 'Oliver Thomas', 'Mia Jackson'], 
        '999903': ['Kate Smith', 'Mike Jones', 'Ben Brown', 'Alice Wilson', 'Charlie Davis'],
        '999904': ['Anna Green', 'Chris Cooper', 'Jamie Ward', 'Maya Bell', 'Sam King'],
        'external_scouts_001': ['Lisa Harper', 'James Peterson', 'Amy Carter', 'Ryan Foster', 'Emma Taylor', 'Nathan Hill', 'Olivia White'],
      };
      
      const namePool = memberNamesBySection[sectionid] || memberNamesBySection['999904'];
      const eventDate = '2025-08-30';
      
      // Generate attending members
      for (let i = 0; i < attendingCount && i < namePool.length; i++) {
        const firstName = namePool[i].split(' ')[0];
        const lastName = namePool[i].split(' ')[1] || 'Member';
        // Handle non-numeric section IDs like 'external_scouts_001'
        const scoutId = sectionid === 'external_scouts_001' 
          ? `${90000 + i + 1}` // External scouts start from 90001
          : `${String(parseInt(sectionid) * 1000 + i + 1)}`;
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
        // Handle non-numeric section IDs like 'external_scouts_001'
        const scoutId = sectionid === 'external_scouts_001' 
          ? `${90000 + attendingCount + i + 1}` // External scouts continue numbering
          : `${String(parseInt(sectionid) * 1000 + attendingCount + i + 1)}`;
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
    
    return true;
    
  } catch (error) {
    logger.error('❌ Failed to initialize demo mode', {
      error: error.message,
    }, LOG_CATEGORIES.ERROR);
    return false;
  }
}

/**
 * Generates realistic Scout events for a specific section including camps, shared activities,
 * and regular meetings. Creates events with appropriate costs, locations, and timing
 * that demonstrate the full range of Scout event management capabilities.
 * 
 * @param {object} section - Scout section object with sectionid and sectionname properties
 * @param {number|string} section.sectionid - Unique section identifier
 * @param {string} section.sectionname - Display name of the section
 * @returns {Array<object>} Array of event objects with OSM-compatible structure
 * @since 1.0.0
 * @example
 * // Generate events for Cubs section
 * const cubsSection = { sectionid: 999904, sectionname: 'Demo Cubs' };
 * const events = generateEventsForSection(cubsSection);
 * console.log(`Generated ${events.length} events for ${cubsSection.sectionname}`);
 */
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

/**
 * Generates realistic Scout membership data for a section including leaders, young leaders,
 * and young people with appropriate names, ages, and patrol assignments that reflect
 * typical Scout section demographics and organizational structure.
 * 
 * @param {object} section - Scout section configuration object
 * @param {number|string} section.sectionid - Unique section identifier for member ID generation
 * @param {string} section.sectionname - Display name used in member records
 * @param {string} section.sectiontype - Section type determining age-appropriate member data
 * @returns {Array<object>} Array of member objects with Scout-specific demographics
 * @since 1.0.0
 * @example
 * // Generate members for Beavers section
 * const beaversSection = {
 *   sectionid: 999903,
 *   sectionname: 'Demo Beavers',
 *   sectiontype: 'beavers'
 * };
 * const members = generateMembersForSection(beaversSection);
 */
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
      scoutid: String(parseInt(section.sectionid) * 1000 + memberIndex++),
      firstname,
      lastname,
      person_type: 'Leaders',
      sectionid: section.sectionid,
      sectionname: section.sectionname,
      patrol: `Patrol ${String.fromCharCode(65 + (members.length % 3))}`, // A, B, C
      active: 1,
      dateofbirth: getRandomBirthDate(section.section, 'Leaders'),
      date_of_birth: getRandomBirthDate(section.section, 'Leaders'),
    });
  }
  
  // Add young leaders
  for (let i = 0; i < youngLeaderCount; i++) {
    const [firstname, lastname] = sectionNames['Young Leaders'][i % sectionNames['Young Leaders'].length].split(' ');
    members.push({
      scoutid: String(parseInt(section.sectionid) * 1000 + memberIndex++),
      firstname,
      lastname,
      person_type: 'Young Leaders',
      sectionid: section.sectionid,
      sectionname: section.sectionname,
      patrol: `Patrol ${String.fromCharCode(65 + (members.length % 3))}`, // A, B, C
      active: 1,
      dateofbirth: getRandomBirthDate(section.section, 'Young Leaders'),
      date_of_birth: getRandomBirthDate(section.section, 'Young Leaders'),
    });
  }
  
  // Add young people
  for (let i = 0; i < youngPeopleCount; i++) {
    const [firstname, lastname] = sectionNames['Young People'][i % sectionNames['Young People'].length].split(' ');
    members.push({
      scoutid: String(parseInt(section.sectionid) * 1000 + memberIndex++),
      firstname,
      lastname,
      person_type: 'Young People',
      sectionid: section.sectionid,
      sectionname: section.sectionname,
      patrol: `Patrol ${String.fromCharCode(65 + (members.length % 3))}`, // A, B, C
      active: 1,
      dateofbirth: getRandomBirthDate(section.section, 'Young People'),
      date_of_birth: getRandomBirthDate(section.section, 'Young People'),
    });
  }

  return members;
}

/**
 * Generates realistic attendance records for a Scout event with varied response patterns.
 * Creates attendance data showing confirmed attendees, invited members, and non-attendees
 * to demonstrate typical Scout event participation and response management.
 * 
 * @param {object} section - Scout section object containing member information
 * @returns {Array<object>} Array of attendance records with response status and member details
 * @since 1.0.0
 * @example
 * // Generate attendance for annual camp
 * const cubsSection = { sectionid: 999904, sectionname: 'Demo Cubs' };
 * const attendance = generateAttendanceForEvent(cubsSection, 'camp_2025');
 * console.log(`${attendance.filter(a => a.attending === 'Yes').length} members attending`);
 */
function generateAttendanceForEvent(section) {
  // Use cached members to maintain identity consistency
  const members = DEMO_MEMBERS_BY_SECTION.get(section.sectionid) || generateMembersForSection(section);
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
      patrolid: (() => {
        const n = parseInt(String(member.scoutid).replace(/\D/g, ''), 10);
        return 12345 + (Number.isNaN(n) ? 0 : (n % 3));
      })(),
      _filterString: `${member.firstname.toLowerCase()} ${member.lastname.toLowerCase()}`,
    };
  });
}

/**
 * Calculates future dates for Scout events based on an offset to create realistic event scheduling.
 * Generates dates spanning from recent past to near future to demonstrate dashboard functionality
 * and event timeline management in the Scout event system.
 * 
 * @param {number} offset - Zero-based event index for date calculation (0 = 3 days from now)
 * @returns {string} ISO date string (YYYY-MM-DD) for the calculated event date
 * @since 1.0.0
 * @example
 * // Generate dates for multiple events
 * const eventDates = [];
 * for (let i = 0; i < 6; i++) {
 *   eventDates.push(getFutureDate(i)); // Creates events at weekly intervals
 * }
 */
function getFutureDate(offset) {
  const date = new Date();
  // Create events spanning recent past to near future (dashboard shows events >= 1 week ago)
  // offset 0: 3 days from now, offset 1: 10 days from now, offset 2: 17 days from now, etc.
  const dayOffset = 3 + (offset * 7);
  date.setDate(date.getDate() + dayOffset);
  // Removed console.log to reduce noise
  return date.toISOString().split('T')[0];
}

/**
 * Generates age-appropriate birth dates for Scout members based on section type and role.
 * Creates realistic demographics that reflect typical Scout age ranges from Squirrels (4-6)
 * through to adult leaders, ensuring authentic demonstration data for Scout management.
 * 
 * @param {string} sectionType - Scout section type (earlyyears, beavers, cubs, scouts, explorers, adults)
 * @param {string} [personType='Young People'] - Member role (Leaders, Young Leaders, Young People)
 * @returns {string} Birth date in ISO format (YYYY-MM-DD)
 * @since 1.0.0
 * @example
 * // Generate birth date for Cubs member
 * const cubBirthDate = getRandomBirthDate('cubs', 'Young People');
 * 
 * // Generate birth date for adult leader
 * const leaderBirthDate = getRandomBirthDate('cubs', 'Leaders');
 */
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

/**
 * Generates flexible record configuration for Scout event management demonstrations.
 * Creates flexi record definitions that showcase the Viking Event Management system's
 * ability to track custom event data like camp groups and sign-in/sign-out procedures.
 * 
 * @param {object} section - Scout section object for context-specific flexi records
 * @param {number|string} section.sectionid - Section identifier for flexi record naming
 * @returns {Array<object>} Array of flexi record configurations for demonstration
 * @since 1.0.0
 * @example
 * // Generate flexi records for Cubs section
 * const cubsSection = { sectionid: 999904 };
 * const flexiRecords = generateFlexiListsForSection(cubsSection);
 */
function generateFlexiListsForSection(section) {
  return [
    {
      extraid: `demo_flexi_${section.sectionid}_1`,
      name: 'Viking Event Mgmt',
    },
  ];
}

/**
 * Generates the structural configuration for flexible Scout event tracking records.
 * Defines column layouts, field properties, and formatting rules for the Viking Event
 * Management flexi record system used in Scout camp and event administration.
 * 
 * @param {object} flexiRecord - Flexi record configuration object
 * @param {string} flexiRecord.extraid - Unique identifier for the flexi record
 * @param {string} flexiRecord.name - Display name of the flexi record type
 * @returns {object} Complete flexi structure with column definitions and formatting rules
 * @since 1.0.0
 * @example
 * // Generate structure for Viking Event Management flexi record
 * const flexiRecord = { extraid: 'demo_flexi_999904_1', name: 'Viking Event Mgmt' };
 * const structure = generateFlexiStructure(flexiRecord);
 */
function generateFlexiStructure(flexiRecord) {
  if (flexiRecord.name === 'Viking Event Mgmt') {
    return {
      extraid: flexiRecord.extraid,
      sectionid: '999904',
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

/**
 * Generates realistic Scout event tracking data for flexible record demonstrations.
 * Creates sample data showing camp group assignments, sign-in/sign-out procedures,
 * and member tracking that demonstrates Scout event management workflows.
 * 
 * @param {object} section - Scout section object containing member information
 * @param {object} flexiRecord - Flexi record configuration for data generation
 * @param {string} flexiRecord.name - Flexi record type determining data structure
 * @returns {Array<object>} Array of flexi data records with Scout member tracking information
 * @since 1.0.0
 * @example
 * // Generate Viking Event Management data for Cubs section
 * const flexiData = generateFlexiData(cubsSection, {
 *   name: 'Viking Event Mgmt',
 *   extraid: 'demo_flexi_999904_1'
 * });
 */
function generateFlexiData(section, flexiRecord) {
  // Use cached members to maintain identity consistency
  const members = DEMO_MEMBERS_BY_SECTION.get(section.sectionid) || generateMembersForSection(section);
  
  if (flexiRecord.name === 'Viking Event Mgmt') {
    const campGroups = ['Red Admirals', 'Blue Dolphins', 'Green Turtles', 'Yellow Seahorses'];
    const leaders = ['Sarah Mitchell', 'David Parker', 'Rachel Thompson'];
    const signInTimes = ['09:15', '09:30', '09:45', '10:00'];
    const signOutTimes = ['16:30', '16:45', '17:00', '17:15'];
    
    return members.map((member, index) => {
      // Only some members have been signed in/out (realistic camp scenario)
      const isSignedIn = Math.random() > 0.3; // 70% signed in
      const isSignedOut = isSignedIn && Math.random() > 0.4; // 60% of signed in have also signed out
      
      // Make some members unassigned for more realistic demo
      const hasGroup = Math.random() > 0.2; // 80% have groups assigned
      const campGroup = hasGroup ? campGroups[index % campGroups.length] : '';
      
      return {
        scoutid: member.scoutid,
        firstname: member.firstname,
        lastname: member.lastname,
        person_type: member.person_type, // Preserve person_type for drag/drop functionality
        f_1: campGroup, // CampGroup (f_1 standardized for demo)
        f_2: isSignedIn ? leaders[index % leaders.length] : '', // SignedInBy
        f_3: isSignedIn ? `2025-08-23 ${signInTimes[index % signInTimes.length]}` : '', // SignedInWhen
        f_4: isSignedOut ? leaders[(index + 1) % leaders.length] : '', // SignedOutBy
        f_5: isSignedOut ? `2025-08-23 ${signOutTimes[index % signOutTimes.length]}` : '', // SignedOutWhen
        // Also include transformed field names for consistency
        CampGroup: campGroup,
        SignedInBy: isSignedIn ? leaders[index % leaders.length] : '',
        SignedInWhen: isSignedIn ? `2025-08-23 ${signInTimes[index % signInTimes.length]}` : '',
        SignedOutBy: isSignedOut ? leaders[(index + 1) % leaders.length] : '',
        SignedOutWhen: isSignedOut ? `2025-08-23 ${signOutTimes[index % signOutTimes.length]}` : '',
      };
    });
  }

  return [];
}

/**
 * Generates comprehensive metadata for shared Scout events like Swimming Galas.
 * Creates realistic multi-section event data including attendance figures, participating
 * sections, and event details that demonstrate cross-section Scout event coordination.
 * 
 * @returns {object} Complete shared event metadata with section participation details
 * @since 1.0.0
 * @example
 * // Generate Swimming Gala shared event metadata
 * const metadata = generateSwimmingGalaSharedMetadata();
 * console.log(`Swimming Gala has ${metadata._allSections.length} participating sections`);
 */
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
        eventid: 'demo_event_999901_2',
        sectionid: '999901', // Fake demo section ID
        none: 3,
        status: 'Owner',
        attendancelimit: 0, // 0 like JOTI production
        receiving_eventid: 'demo_event_999901_2',
        _filterString: '1st Walton (Viking) Sea Scouts Demo Adults Owner',
      },
      {
        attendance: squirrelAttendance,
        emailable: true,
        groupname: '1st Walton (Viking) Sea Scouts',
        sectionname: 'Demo Squirrels', 
        eventid: 'demo_event_999902_2',
        sectionid: '999902', // Fake demo section ID
        none: 5,
        status: 'Accepted',
        attendancelimit: 0,
        receiving_eventid: 'demo_event_999902_2',
        _filterString: '1st Walton (Viking) Sea Scouts Demo Squirrels Accepted',
      },
      {
        attendance: beaverAttendance,
        emailable: true,
        groupname: '1st Walton (Viking) Sea Scouts', 
        sectionname: 'Demo Beavers',
        eventid: 'demo_event_999903_2',
        sectionid: '999903', // Fake demo section ID
        none: 4,
        status: 'Accepted',
        attendancelimit: 0,
        receiving_eventid: 'demo_event_999903_2',
        _filterString: '1st Walton (Viking) Sea Scouts Demo Beavers Accepted',
      },
      {
        attendance: cubAttendance,
        emailable: true,
        groupname: '1st Walton (Viking) Sea Scouts',
        sectionname: 'Demo Cubs',
        eventid: 'demo_event_999904_2', 
        sectionid: '999904', // Fake demo section ID
        none: 2,
        status: 'Accepted', 
        attendancelimit: 0,
        receiving_eventid: 'demo_event_999904_2',
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
      sectionid: 999901, // Fake numeric section ID for demo
      sectionname: 'Demo Adults', 
      termid: '12345',
    },
  };
}

/**
 * Generates attendance records matching exact OSM production shared attendance format.
 * Creates comprehensive member attendance data including demographics, patrol assignments,
 * and filter strings that enable seamless integration with Scout event management systems.
 * 
 * @param {string} sectionid - OSM section identifier (numeric or external format)
 * @param {string} sectionname - Display name of the Scout section
 * @param {string} groupname - Scout group name for organizational context
 * @param {string} eventid - Unique event identifier for attendance tracking
 * @param {number} attendingCount - Number of members confirmed as attending
 * @param {number} notAttendingCount - Number of members confirmed as not attending
 * @returns {Array<object>} Array of attendance records with full OSM production structure
 * @since 1.0.0
 * @example
 * // Generate shared attendance for Swimming Gala
 * const attendance = _generateProductionFormatAttendance(
 *   '999904', 'Demo Cubs', '1st Walton Sea Scouts',
 *   'swimming_gala_2025', 8, 3
 * );
 */
function _generateProductionFormatAttendance(sectionid, sectionname, groupname, eventid, attendingCount, notAttendingCount) {
  const members = [];
  
  // Generate demo member names based on section
  const memberNamesBySection = {
    '999901': ['Sarah Mitchell', 'David Parker', 'Rachel Thompson', 'Mark Roberts', 'Helen Clarke'],
    '999902': ['Emma Johnson', 'Tom Williams', 'Sophie Davies', 'Oliver Thomas', 'Mia Jackson'], 
    '999903': ['Kate Smith', 'Mike Jones', 'Ben Brown', 'Alice Wilson', 'Charlie Davis'],
    '999904': ['Anna Green', 'Chris Cooper', 'Jamie Ward', 'Maya Bell', 'Sam King'],
    'external_scouts_001': ['Lisa Harper', 'James Peterson', 'Amy Carter', 'Ryan Foster', 'Emma Taylor'],
  };
  
  const namePool = memberNamesBySection[sectionid] || memberNamesBySection['999904'];
  const eventDate = '2025-08-30'; // Swimming Gala date
  
  // Generate attending members with full production structure
  for (let i = 0; i < attendingCount && i < namePool.length; i++) {
    const firstName = namePool[i].split(' ')[0];
    const lastName = namePool[i].split(' ')[1] || 'Member';
    // Handle non-numeric section IDs like 'external_scouts_001'
    const scoutId = sectionid === 'external_scouts_001' 
      ? `${90000 + i + 1}` // External scouts start from 90001
      : `${String(parseInt(sectionid) * 1000 + i + 1)}`;
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
    // Handle non-numeric section IDs like 'external_scouts_001'
    const scoutId = sectionid === 'external_scouts_001' 
      ? `${90000 + attendingCount + i + 1}` // External scouts continue numbering
      : `${String(parseInt(sectionid) * 1000 + attendingCount + i + 1)}`;
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
 * Demo mode configuration object providing centralized access to demonstration functionality.
 * Offers methods to detect demo mode status and initialize comprehensive Scout event management
 * demonstration data for offline showcasing and testing of application features.
 * 
 * @type {object} Demo configuration with detection and initialization capabilities
 * @property {boolean} enabled - Computed property indicating if demo mode is currently active
 * @property {Function} initialize - Async function to populate demo data in local storage
 * @since 1.0.0
 * @example
 * // Check and initialize demo mode
 * if (demoConfig.enabled) {
 *   const initialized = await demoConfig.initialize();
 *   console.log('Demo mode initialization:', initialized ? 'success' : 'failed');
 * }
 */
export const demoConfig = {
  get enabled() { return isDemoMode(); },
  initialize: initializeDemoMode,
};

export default demoConfig;