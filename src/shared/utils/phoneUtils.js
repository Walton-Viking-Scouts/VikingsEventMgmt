/**
 * Phone number utilities for Viking Event Management
 * E.164-compliant validation and formatting for international numbers
 */

/**
 * Format a phone number for calling by cleaning and validating it
 * @param {string} phone - Raw phone number input
 * @returns {string|null} - Cleaned phone number or null if invalid
 */
export function formatPhoneForCall(phone) {
  if (!phone) return null;
  
  // Clean phone number: preserve single leading +, remove all other non-digits
  let cleanPhone = String(phone).trim();
  // Remove all non-digits except a single leading +
  cleanPhone = cleanPhone.replace(/[^\d+]/g, '');
  // Remove any extra + signs (keep only the first one if it's at the start)
  cleanPhone = cleanPhone.replace(/(?!^)\+/g, '');

  // Validate phone number length and pattern
  if (!isValidPhoneNumber(cleanPhone)) {
    return null;
  }

  return cleanPhone;
}

/**
 * Validate phone number - E.164-friendly for international formats
 * @param {string} input - Phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function isValidPhoneNumber(input) {
  if (!input) return false;
  
  // Convert to string and clean: preserve single leading +, remove all other non-digits
  let cleanInput = typeof input === 'string' ? input : String(input);
  cleanInput = cleanInput.trim().replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  
  // Check if it contains only digits with optional leading +
  if (!/^\+?\d+$/.test(cleanInput)) {
    return false;
  }

  // Extract digits for length and pattern validation
  const digits = cleanInput.replace(/^\+/, '');

  // Reject numbers with all same digits (e.g., 0000000000, 1111111111)
  if (/^(\d)\1+$/.test(digits)) {
    return false;
  }

  // Reject obviously invalid numbers (E.164 allows 7-15 digits)
  if (digits.length < 7 || digits.length > 15) {
    return false;
  }

  // Allow most reasonable phone number lengths
  // 7-15 digits covers most international formats including:
  // - US/Canada: 10 digits (2125551234) or 11 with country code (12125551234)
  // - UK: 10-11 digits (01234567890, 07123456789)
  // - International: varies but typically 7-15 digits with optional + prefix
  return true;
}

/**
 * Handle phone call with error handling
 * @param {string} phone - Phone number to call
 * @param {function} onError - Error callback function
 */
export function handlePhoneCall(phone, onError) {
  if (!phone) return;
  
  const cleanPhone = formatPhoneForCall(phone);
  if (cleanPhone) {
    window.location.href = `tel:${cleanPhone}`;
  } else {
    // Mask phone number for privacy in logs (avoid logging PII)
    const masked = String(phone).replace(/\d(?=\d{2})/g, '•');
    console.warn('Invalid phone number format:', masked);
    
    if (onError) {
      onError('Invalid phone number format. Please check the number and try again.');
    }
  }
}