/**
 * @file Age calculation utilities for Viking Event Management
 * 
 * This module provides age calculation functions with privacy-conscious formatting
 * for Scout environments. Implements leader privacy protection by showing "Adult"
 * for anyone 18 or older, while displaying actual ages for young people under 18.
 * 
 * Age calculations are essential for Scout programs which have strict age-based
 * section requirements and safeguarding policies. The privacy features protect
 * adult leader information while maintaining operational transparency for youth
 * members where age verification is needed for activities and badges.
 * 
 * @module ageUtils
 * @version 2.3.7
 * @since 1.0.0 - Initial age calculation support
 * @author Vikings Event Management Team
 */

/**
 * Calculates age from date of birth with privacy-conscious formatting for display
 *
 * Computes age in years and applies Scout-appropriate privacy formatting.
 * For young people (under 18), displays the actual age for section
 * placement and activity suitability verification. For adults 18 or older
 * (including young leaders), shows "Adult" to protect privacy while confirming
 * adult status for safeguarding compliance.
 * 
 * This privacy approach balances operational needs (knowing young people's
 * exact ages for activities) with leader privacy (adults don't need exact
 * ages displayed to other members).
 * 
 * @param {string|Date} dateOfBirth - Date of birth in any format parseable by Date constructor
 * @returns {string} Formatted age display - actual age for under 18, "Adult" for 18 or older
 * 
 * @example
 * // Young person ages (shown exactly for section/activity verification)
 * const scoutAge = calculateAge('2010-05-15'); // Scout born in 2010
 * console.log(scoutAge); // "14" (actual age for activity planning)
 * 
 * const beaverAge = calculateAge('2018-11-20'); // Beaver born in 2018  
 * console.log(beaverAge); // "6" (exact age for section suitability)
 * 
 * @example
 * // Adult leader ages (privacy protected)
 * const youngLeader = calculateAge('2006-08-10'); // 18-year-old young leader
 * console.log(youngLeader); // "Adult" (privacy protected)
 *
 * const seniorLeader = calculateAge('1985-03-22'); // 39-year-old leader
 * console.log(seniorLeader); // "Adult" (privacy protected)
 * 
 * @example
 * // Handle various date formats and edge cases
 * console.log(calculateAge('1995-12-31')); // "Adult" (adult leader)
 * console.log(calculateAge('2012/06/18')); // "12" (young scout)
 * console.log(calculateAge(new Date('2008-09-03'))); // "16" (accepts Date objects)
 * console.log(calculateAge('')); // "" (handles empty input)
 * console.log(calculateAge('invalid-date')); // "" (handles invalid input)
 * 
 * @example
 * // Usage in Scout member displays
 * const renderMemberAge = (member) => {
 *   const ageDisplay = calculateAge(member.dob);
 *   const ageLabel = ageDisplay === 'Adult' ? 'Adult Leader' : `Age ${ageDisplay}`;
 *   
 *   return (
 *     <div className="member-info">
 *       <span className="name">{member.firstname} {member.lastname}</span>
 *       <span className="age">{ageLabel}</span>
 *     </div>
 *   );
 * };
 * 
 * @example
 * // Age-based section validation
 * const validateSectionAge = (member, targetSection) => {
 *   const age = calculateAge(member.dob);
 *
 *   if (age === 'Adult') {
 *     return true; // Adults can lead any section
 *   }
 *   
 *   const numericAge = parseInt(age);
 *   const sectionAgeRanges = {
 *     'Beavers': [6, 8],
 *     'Cubs': [8, 10.5],
 *     'Scouts': [10.5, 14],
 *     'Explorers': [14, 18],
 *     'Network': [18, 25]
 *   };
 *   
 *   const [minAge, maxAge] = sectionAgeRanges[targetSection] || [0, 100];
 *   return numericAge >= minAge && numericAge <= maxAge;
 * };
 * 
 * @since 1.0.0
 */
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return '';
  
  try {
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return '';
    
    const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    // Show "Adult" for anyone 18 or older (leader privacy)
    return age >= 18 ? 'Adult' : age.toString();
  } catch (error) {
    return '';
  }
}

/**
 * Calculates actual numeric age in years for internal calculations and logic
 * 
 * Computes the precise age in years without privacy formatting, returning
 * the actual numeric value. This function is intended for internal calculations,
 * age-based logic, section transitions, and other programmatic uses where
 * the exact age is needed regardless of privacy considerations.
 * 
 * Unlike calculateAge(), this function always returns the real numeric age
 * without any privacy masking. Use this for business logic and calculations,
 * but use calculateAge() for user-facing displays.
 * 
 * @param {string|Date} dateOfBirth - Date of birth in any format parseable by Date constructor
 * @returns {number} Actual age in years as a number (0 if invalid input)
 * 
 * @example
 * // Use for section transition calculations
 * const checkSectionTransition = (member) => {
 *   const actualAge = calculateActualAge(member.dob);
 *   
 *   if (member.currentSection === 'Cubs' && actualAge >= 10.5) {
 *     return {
 *       shouldTransition: true,
 *       targetSection: 'Scouts',
 *       message: `${member.firstname} is ready to move up to Scouts`
 *     };
 *   }
 *   
 *   if (member.currentSection === 'Scouts' && actualAge >= 14) {
 *     return {
 *       shouldTransition: true,
 *       targetSection: 'Explorers', 
 *       message: `${member.firstname} can now join Explorers`
 *     };
 *   }
 *   
 *   return { shouldTransition: false };
 * };
 * 
 * @example
 * // Age-based activity restrictions
 * const canParticipateInActivity = (member, activity) => {
 *   const age = calculateActualAge(member.dob);
 *   
 *   const activityRequirements = {
 *     'Rock Climbing': { minAge: 8, maxAge: 100 },
 *     'Pioneering': { minAge: 10, maxAge: 100 },
 *     'Night Hike': { minAge: 10, maxAge: 25 }, // Young people only
 *     'Archery': { minAge: 8, maxAge: 100 }
 *   };
 *   
 *   const requirements = activityRequirements[activity.name];
 *   if (!requirements) return true; // No age restrictions
 *   
 *   return age >= requirements.minAge && age <= requirements.maxAge;
 * };
 * 
 * @example
 * // Statistical analysis without privacy concerns
 * const analyzeAgeDistribution = (members) => {
 *   const ages = members.map(member => calculateActualAge(member.dob));
 *   
 *   return {
 *     averageAge: ages.reduce((sum, age) => sum + age, 0) / ages.length,
 *     youngestMember: Math.min(...ages),
 *     oldestMember: Math.max(...ages),
 *     ageGroups: {
 *       under10: ages.filter(age => age < 10).length,
 *       teens: ages.filter(age => age >= 10 && age < 20).length,
 *       adults: ages.filter(age => age >= 20).length
 *     }
 *   };
 * };
 * 
 * @example
 * // Compare with display function
 * const member = { dob: '1985-06-15' }; // 39 years old
 *
 * const displayAge = calculateAge(member.dob);    // "Adult" (privacy protected)
 * const actualAge = calculateActualAge(member.dob); // 39 (exact for calculations)
 *
 * console.log(`Display: ${displayAge}, Actual: ${actualAge}`);
 * // Output: "Display: Adult, Actual: 39"
 * 
 * @example
 * // Error handling for invalid dates
 * console.log(calculateActualAge('')); // 0
 * console.log(calculateActualAge('invalid')); // 0
 * console.log(calculateActualAge(null)); // 0
 * console.log(calculateActualAge(undefined)); // 0
 * 
 * @since 1.0.0
 */
export function calculateActualAge(dateOfBirth) {
  if (!dateOfBirth) return 0;
  
  try {
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return 0;
    
    return Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  } catch (error) {
    return 0;
  }
}