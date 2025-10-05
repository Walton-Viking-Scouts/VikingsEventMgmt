export function resolveSectionName(member) {
  if (typeof member === 'object' && member !== null) {
    return member.section
      || member.sections?.[0]?.section
      || member.sections?.[0]?.sectionname
      || member.sectionname
      || 'Unknown';
  }
  return member || 'Unknown';
}
