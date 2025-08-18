// Demo mode configuration and detection
// Handles demo mode initialization and data pre-population

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
    if (urlParams.get('demo') === 'true' || urlParams.get('mode') === 'demo') {
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

/**
 * Demo Scout sections configuration
 */
export const DEMO_SECTIONS = [
  {
    sectionid: 123,
    sectionname: '1st Demo Scout Group - Beavers',
    section: 'beavers',
    sectiontype: 'Colony',
    level: 'READ',
    permissions: { member: 100, programme: 100, events: 100 },
    isDefault: 0,
  },
  {
    sectionid: 124,
    sectionname: '1st Demo Scout Group - Cubs', 
    section: 'cubs',
    sectiontype: 'Pack',
    level: 'READ',
    permissions: { member: 100, programme: 100, events: 100 },
    isDefault: 0,
  },
  {
    sectionid: 125,
    sectionname: '1st Demo Scout Group - Scouts',
    section: 'scouts', 
    sectiontype: 'Troop',
    level: 'READ',
    permissions: { member: 100, programme: 100, events: 100 },
    isDefault: 1,
  },
  {
    sectionid: 126,
    sectionname: '1st Demo Scout Group - Explorers',
    section: 'explorers',
    sectiontype: 'Unit', 
    level: 'READ',
    permissions: { member: 100, programme: 100, events: 100 },
    isDefault: 0,
  },
];

/**
 * Demo event templates (10 events total - no weekly meetings)
 */
export const DEMO_EVENTS = [
  {
    eventid: 'event_001',
    name: 'Summer Camp 2024',
    startdate: '2024-07-15',
    enddate: '2024-07-17',
    location: 'Gilwell Park',
    notes: 'Annual summer camp adventure with activities and camping',
    cost: '45.00',
  },
  {
    eventid: 'event_002', 
    name: 'Hiking Adventure',
    startdate: '2024-06-08',
    enddate: '2024-06-08',
    location: 'South Downs',
    notes: 'Day hike through beautiful countryside',
    cost: '8.50',
  },
  {
    eventid: 'event_003',
    name: 'Swimming Session',
    startdate: '2024-05-18',
    enddate: '2024-05-18', 
    location: 'Local Swimming Pool',
    notes: 'Swimming and water safety session',
    cost: '5.00',
  },
  {
    eventid: 'event_004',
    name: 'Winter Weekend Camp',
    startdate: '2024-02-10',
    enddate: '2024-02-11',
    location: 'Scout Activity Centre',
    notes: 'Weekend camp with winter activities',
    cost: '35.00',
  },
  {
    eventid: 'event_005',
    name: 'Cinema Trip',
    startdate: '2024-04-20',
    enddate: '2024-04-20',
    location: 'Local Cinema',
    notes: 'Group cinema trip to latest family film',
    cost: '12.50',
  },
  {
    eventid: 'event_006',
    name: 'Rock Climbing',
    startdate: '2024-03-16', 
    enddate: '2024-03-16',
    location: 'Climbing Centre',
    notes: 'Indoor rock climbing and bouldering',
    cost: '15.00',
  },
  {
    eventid: 'event_007',
    name: 'Spring Adventure Weekend',
    startdate: '2024-04-06',
    enddate: '2024-04-07',
    location: 'Activity Centre',
    notes: 'Weekend of outdoor activities and challenges', 
    cost: '28.00',
  },
  {
    eventid: 'event_008',
    name: 'Laser Tag',
    startdate: '2024-05-04',
    enddate: '2024-05-04',
    location: 'Laser Quest Arena',
    notes: 'Team-based laser tag competition',
    cost: '10.00',
  },
  {
    eventid: 'event_009', 
    name: 'Community Service Day',
    startdate: '2024-03-02',
    enddate: '2024-03-02',
    location: 'Local Community Centre',
    notes: 'Helping with local community projects',
    cost: '0.00',
  },
  {
    eventid: 'event_010',
    name: 'Bowling Night',
    startdate: '2024-06-22',
    enddate: '2024-06-22',
    location: 'Ten Pin Bowling',
    notes: 'Fun bowling evening with pizza',
    cost: '18.00',
  },
];

/**
 * Generate realistic member names for demo
 */
export const DEMO_MEMBER_NAMES = {
  beavers: [
    { firstname: 'Emma', lastname: 'Johnson' },
    { firstname: 'Oliver', lastname: 'Smith' },
    { firstname: 'Sophia', lastname: 'Williams' },
    { firstname: 'Jack', lastname: 'Brown' },
    { firstname: 'Isabella', lastname: 'Jones' },
    { firstname: 'Harry', lastname: 'Davis' },
    { firstname: 'Amelia', lastname: 'Miller' },
    { firstname: 'Charlie', lastname: 'Wilson' },
    { firstname: 'Mia', lastname: 'Moore' },
    { firstname: 'Oscar', lastname: 'Taylor' },
    { firstname: 'Grace', lastname: 'Anderson' },
    { firstname: 'Leo', lastname: 'Thomas' },
  ],
  cubs: [
    { firstname: 'Lucy', lastname: 'Jackson' },
    { firstname: 'George', lastname: 'White' },
    { firstname: 'Emily', lastname: 'Harris' },
    { firstname: 'Noah', lastname: 'Martin' },
    { firstname: 'Poppy', lastname: 'Thompson' },
    { firstname: 'Alfie', lastname: 'Garcia' },
    { firstname: 'Freya', lastname: 'Martinez' },
    { firstname: 'Archie', lastname: 'Robinson' },
    { firstname: 'Ella', lastname: 'Clark' },
    { firstname: 'Arthur', lastname: 'Rodriguez' },
    { firstname: 'Charlotte', lastname: 'Lewis' },
    { firstname: 'Freddie', lastname: 'Lee' },
  ],
  scouts: [
    { firstname: 'Lily', lastname: 'Walker' },
    { firstname: 'William', lastname: 'Hall' },
    { firstname: 'Ava', lastname: 'Allen' },
    { firstname: 'James', lastname: 'Young' },
    { firstname: 'Ivy', lastname: 'Hernandez' },
    { firstname: 'Thomas', lastname: 'King' },
    { firstname: 'Evie', lastname: 'Wright' },
    { firstname: 'Henry', lastname: 'Lopez' },
    { firstname: 'Rosie', lastname: 'Hill' },
    { firstname: 'Alexander', lastname: 'Scott' },
    { firstname: 'Daisy', lastname: 'Green' },
    { firstname: 'Sebastian', lastname: 'Adams' },
  ],
  explorers: [
    { firstname: 'Maya', lastname: 'Baker' },
    { firstname: 'Daniel', lastname: 'Gonzalez' },
    { firstname: 'Ruby', lastname: 'Nelson' },
    { firstname: 'Lucas', lastname: 'Carter' },
    { firstname: 'Zara', lastname: 'Mitchell' },
    { firstname: 'Benjamin', lastname: 'Perez' },
    { firstname: 'Phoebe', lastname: 'Roberts' },
    { firstname: 'Matthew', lastname: 'Turner' },
    { firstname: 'Scarlett', lastname: 'Phillips' },
    { firstname: 'Joshua', lastname: 'Campbell' },
    { firstname: 'Florence', lastname: 'Parker' },
    { firstname: 'Isaac', lastname: 'Evans' },
  ],
};

/**
 * Initialize demo mode with pre-populated cache
 */
export async function initializeDemoMode() {
  if (!isDemoMode()) return false;
  
  logger.info('🎯 Initializing demo mode with mock data', {}, LOG_CATEGORIES.APP);
  
  try {
    // Pre-populate sections
    const sectionsWithTimestamp = {
      ...DEMO_SECTIONS,
      _cacheTimestamp: Date.now(),
    };
    safeSetItem('viking_sections_offline', sectionsWithTimestamp);
    
    // Pre-populate terms
    const demoTerms = {
      items: [
        {
          termid: 'term_2024',
          name: 'Autumn 2024',
          startdate: '2024-09-01',
          enddate: '2024-12-15',
        },
      ],
      _cacheTimestamp: Date.now(),
    };
    safeSetItem('viking_terms_offline', demoTerms);
    
    // Pre-populate startup data
    const demoStartupData = {
      globals: {
        firstname: 'Demo',
        lastname: 'Leader',
        userid: 'demo_user',
        email: 'demo@example.com',
      },
      _cacheTimestamp: Date.now(),
    };
    safeSetItem('viking_startup_data_offline', demoStartupData);
    
    // Pre-populate events for each section
    DEMO_SECTIONS.forEach(section => {
      const sectionEvents = DEMO_EVENTS.map(event => ({
        ...event,
        sectionid: section.sectionid,
        sectionname: section.sectionname,
        termid: 'term_2024',
      }));
      
      const eventsWithTimestamp = {
        items: sectionEvents,
        _cacheTimestamp: Date.now(),
      };
      safeSetItem(`viking_events_${section.sectionid}_offline`, eventsWithTimestamp);
    });
    
    // Generate members for each section
    DEMO_SECTIONS.forEach(section => {
      const sectionType = section.section;
      const members = DEMO_MEMBER_NAMES[sectionType].map((name, index) => ({
        scoutid: `${section.sectionid}_member_${index + 1}`,
        firstname: name.firstname,
        lastname: name.lastname,
        sectionid: section.sectionid,
        sectionname: section.sectionname,
        patrol: getPatrolForSection(sectionType, index),
        active: 1,
        dateofbirth: generateBirthDate(sectionType),
      }));
      
      const membersWithTimestamp = {
        items: members,
        _cacheTimestamp: Date.now(),
      };
      safeSetItem(`viking_members_${section.sectionid}_offline`, membersWithTimestamp);
    });
    
    logger.info('✅ Demo mode cache populated successfully', {
      sections: DEMO_SECTIONS.length,
      events: DEMO_EVENTS.length,
      totalMembers: Object.values(DEMO_MEMBER_NAMES).flat().length,
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
 * Get appropriate patrol for section and member index
 */
function getPatrolForSection(sectionType, memberIndex) {
  const patrols = {
    beavers: ['Red', 'Blue', 'Green'],
    cubs: ['Akela', 'Baloo', 'Bagheera'], 
    scouts: ['Eagles', 'Hawks', 'Falcons'],
    explorers: ['Alpha', 'Beta', 'Gamma'],
  };
  
  const sectionPatrols = patrols[sectionType] || ['Patrol'];
  return sectionPatrols[memberIndex % sectionPatrols.length];
}

/**
 * Generate realistic birth date for section type
 */
function generateBirthDate(sectionType) {
  const ageRanges = {
    beavers: [6, 8],
    cubs: [8, 10],
    scouts: [10, 14], 
    explorers: [14, 18],
  };
  
  const [minAge, maxAge] = ageRanges[sectionType] || [10, 14];
  const age = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
  const birthYear = new Date().getFullYear() - age;
  const birthMonth = Math.floor(Math.random() * 12) + 1;
  const birthDay = Math.floor(Math.random() * 28) + 1;
  
  return `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`;
}

/**
 * Demo mode configuration object
 */
export const demoConfig = {
  get enabled() { return isDemoMode(); },
  sections: DEMO_SECTIONS,
  events: DEMO_EVENTS,
  memberNames: DEMO_MEMBER_NAMES,
  initialize: initializeDemoMode,
};

export default demoConfig;