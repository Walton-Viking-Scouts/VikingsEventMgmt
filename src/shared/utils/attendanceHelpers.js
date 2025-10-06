/**
 * Attendance status utility functions for the Viking Event Management application
 */

/**
 * Attendance status constants
 */
export const ATTENDANCE_STATUS = {
  YES: { value: 1, string: 'Yes' },
  NO: { value: 0, string: 'No' },
  INVITED: { value: 2, string: 'Invited' },
  NOT_INVITED: { value: 3, string: 'Not Invited' },
};

/**
 * Gets the normalized attendance status from a raw attending value
 * @param {number|string} attending - The attending value (can be number or string)
 * @returns {string} The normalized status ('yes', 'no', 'invited', 'notInvited')
 */
export const getAttendanceStatus = (attending) => {
  if (attending === ATTENDANCE_STATUS.YES.value || attending === ATTENDANCE_STATUS.YES.string || attending === 'Yes') {
    return 'yes';
  } else if (attending === ATTENDANCE_STATUS.NO.value || attending === ATTENDANCE_STATUS.NO.string || attending === 'No') {
    return 'no';
  } else if (attending === ATTENDANCE_STATUS.INVITED.value || attending === ATTENDANCE_STATUS.INVITED.string || attending === 'Invited') {
    return 'invited';
  } else if (attending === ATTENDANCE_STATUS.NOT_INVITED.value || attending === ATTENDANCE_STATUS.NOT_INVITED.string || attending === 'Not Invited') {
    return 'notInvited';
  }
  return 'notInvited';
};

/**
 * Checks if an attendance record matches the given attendance filters
 * @param {number|string} attending - The attending value from the record
 * @param {Object} attendanceFilters - The filter object with yes, no, invited, notInvited booleans
 * @returns {boolean} True if the record matches the filters
 */
export const checkAttendanceMatch = (attending, attendanceFilters) => {
  return (
    ((attending === ATTENDANCE_STATUS.YES.value || attending === ATTENDANCE_STATUS.YES.string || attending === 'Yes') && attendanceFilters.yes) ||
    ((attending === ATTENDANCE_STATUS.NO.value || attending === ATTENDANCE_STATUS.NO.string || attending === 'No') && attendanceFilters.no) ||
    ((attending === ATTENDANCE_STATUS.INVITED.value || attending === ATTENDANCE_STATUS.INVITED.string || attending === 'Invited') && attendanceFilters.invited) ||
    ((attending === ATTENDANCE_STATUS.NOT_INVITED.value || attending === ATTENDANCE_STATUS.NOT_INVITED.string || attending === 'Not Invited') && attendanceFilters.notInvited)
  );
};

/**
 * Increments the appropriate counter on a member object based on attendance status
 * @param {Object} member - The member object with yes, no, invited, notInvited counters
 * @param {number|string} attending - The attending value
 */
export const incrementAttendanceCount = (member, attending) => {
  const status = getAttendanceStatus(attending);
  if (status && member[status] !== undefined) {
    member[status]++;
  }
};

/**
 * Updates counts for a category (yes, no, invited, notInvited) on a section object
 * @param {Object} section - The section object with attendance category counters
 * @param {string} category - The category to update ('yes', 'no', 'invited', 'notInvited')
 * @param {string} roleType - The role type ('yp', 'yl', 'l')
 */
export const updateSectionCounts = (section, category, roleType) => {
  section[category][roleType]++;
  section[category].total++;
  section.total[roleType]++;
  section.total.total++;
};

/**
 * Updates section counts based on attendance value and role type
 * @param {Object} section - The section object
 * @param {number|string} attending - The attending value
 * @param {string} roleType - The role type ('yp', 'yl', 'l')
 */
export const updateSectionCountsByAttendance = (section, attending, roleType) => {
  const status = getAttendanceStatus(attending);
  if (status) {
    updateSectionCounts(section, status, roleType);
  }
};