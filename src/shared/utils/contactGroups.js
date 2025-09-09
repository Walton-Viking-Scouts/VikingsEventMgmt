/**
 * Utility function to group contact information from member data
 * Handles both flattened fields (contact__field) and nested contact_groups
 * Preserves falsy values (false, 0) that are meaningful for consents and flags
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

  // Also process nested contact_groups data if available
  if (member.contact_groups) {
    Object.entries(member.contact_groups).forEach(([groupName, groupData]) => {
      if (groupData && typeof groupData === 'object') {
        const normalizedGroupName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (!groups[normalizedGroupName]) {
          groups[normalizedGroupName] = {};
        }
        // Merge nested data with flattened data (nested takes precedence)
        Object.entries(groupData).forEach(([fieldName, fieldValue]) => {
          const normalizedFieldName = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const isEmptyString = typeof fieldValue === 'string' && fieldValue.trim() === '';
          if (fieldValue !== undefined && fieldValue !== null && !isEmptyString) {
            groups[normalizedGroupName][normalizedFieldName] = fieldValue;
          }
        });
      }
    });
  }

  return groups;
}