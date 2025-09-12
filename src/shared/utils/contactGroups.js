/**
 * Utility function to group contact information from member data
 * Handles both flattened fields (contact__field) and nested contact_groups
 * Preserves falsy values (false, 0) that are meaningful for consents and flags
 * @param member
 */
export function groupContactInfo(member) {
  const groups = {};

  // Process flattened contact fields
  Object.entries(member).forEach(([key, value]) => {
    if (
      key.includes('__') &&
      value !== undefined &&
      value !== null &&
      !(typeof value === 'string' && value.trim() === '')
    ) {
      const [groupName, fieldName] = key.split('__');
      if (!groups[groupName]) {
        groups[groupName] = {};
      }
      groups[groupName][fieldName] = value;
    }
  });

  // Add legacy fields to appropriate groups
  const hasEmail = member.email !== undefined && member.email !== null && String(member.email).trim() !== '';
  const hasPhone = member.phone !== undefined && member.phone !== null && String(member.phone).trim() !== '';
  if (hasEmail || hasPhone) {
    if (!groups.member_contact) {
      groups.member_contact = {};
    }
    if (hasEmail) groups.member_contact.email = member.email;
    if (hasPhone) groups.member_contact.phone = member.phone;
  }

  // Note: Backend now only creates flattened fields, no nested contact_groups processing needed

  return groups;
}