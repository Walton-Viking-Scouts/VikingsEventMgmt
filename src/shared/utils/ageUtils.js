/**
 * Calculate age from date of birth and format for display
 * @param {string|Date} dateOfBirth - Date of birth
 * @returns {string} Formatted age display (">25" for adults over 25, actual age otherwise)
 */
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return '';
  
  try {
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return '';
    
    const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    
    // Show ">25" for adults over 25 (leader privacy)
    return age > 25 ? '>25' : age.toString();
  } catch (error) {
    return '';
  }
}

/**
 * Calculate actual numeric age (for calculations, not display)
 * @param {string|Date} dateOfBirth - Date of birth  
 * @returns {number} Actual age in years
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