/**
 * Extracts the comprehensive member view (contacts, medical, consents) from a
 * raw member record's contact groups. Shared by the event Detailed tab and
 * the Sections member table — previously copy-pasted in both.
 *
 * @module memberDataExtractor
 */

import { groupContactInfo } from './contactGroups.js';
import { resolveSectionName } from './memberUtils.js';

/**
 * Builds a flat, display-ready view of a member's key data.
 * @param {Object} member - Raw member record (with contact_groups)
 * @returns {Object} Extracted member data
 */
export function getComprehensiveMemberData(member) {
  const contactGroups = groupContactInfo(member);
  const combineFields = (groupNames, fieldNames, separator = ', ') => {
    const values = [];
    for (const groupName of Array.isArray(groupNames) ? groupNames : [groupNames]) {
      const group = contactGroups[groupName];
      if (group) {
        for (const fieldName of Array.isArray(fieldNames) ? fieldNames : [fieldNames]) {
          if (group[fieldName]) values.push(group[fieldName]);
        }
      }
    }
    return values.join(separator);
  };

  return {
    name: `${member.firstname || member.first_name} ${member.lastname || member.last_name}`,
    section: resolveSectionName(member),
    patrol: member.patrol || '',
    age: member.age || member.yrs || '',
    primary_contacts: (() => {
      const contacts = [];
      const pc1_name = combineFields(['primary_contact_1'], ['first_name', 'last_name'], ' ') || '';
      const pc1_phone = combineFields(['primary_contact_1'], ['phone_1', 'phone_2']) || '';
      const pc1_email = combineFields(['primary_contact_1'], ['email_1', 'email_2']) || '';
      if (pc1_name || pc1_phone || pc1_email) {
        contacts.push({ name: pc1_name, phone: pc1_phone, email: pc1_email, label: 'PC1' });
      }
      const pc2_name = combineFields(['primary_contact_2'], ['first_name', 'last_name'], ' ') || '';
      const pc2_phone = combineFields(['primary_contact_2'], ['phone_1', 'phone_2']) || '';
      const pc2_email = combineFields(['primary_contact_2'], ['email_1', 'email_2']) || '';
      if (pc2_name || pc2_phone || pc2_email) {
        contacts.push({ name: pc2_name, phone: pc2_phone, email: pc2_email, label: 'PC2' });
      }
      return contacts;
    })(),
    emergency_contacts: (() => {
      const contacts = [];
      const ec_name = combineFields(['emergency_contact'], ['first_name', 'last_name'], ' ') || '';
      const ec_phone = combineFields(['emergency_contact'], ['phone_1', 'phone_2']) || '';
      if (ec_name || ec_phone) {
        contacts.push({ name: ec_name, phone: ec_phone, label: 'Emergency' });
      }
      return contacts;
    })(),
    essential_information: contactGroups.essential_information || {},
    allergies: contactGroups.essential_information?.allergies || '',
    medical_details: contactGroups.essential_information?.medical_details || '',
    dietary_requirements: contactGroups.essential_information?.dietary_requirements || '',
    tetanus_year_of_last_jab: contactGroups.essential_information?.tetanus_year_of_last_jab || '',
    swimmer: contactGroups.essential_information?.swimmer || '',
    other_useful_information: contactGroups.essential_information?.other_useful_information || '',
    confirmed_by_parents: contactGroups.essential_information?.confirmed_by_parents || '',
    consents: contactGroups.consents || contactGroups.permissions || {},
  };
}

/**
 * Escapes a value for a CSV cell.
 * @param {*} value - Cell value
 * @returns {string} Quoted, escaped cell
 */
export function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/**
 * Triggers a browser download of CSV rows (BOM-prefixed for Excel).
 * @param {Array<string>} rows - Pre-joined CSV row strings
 * @param {string} filename - Download filename
 */
export function downloadCSV(rows, filename) {
  const csvContent = '\uFEFF' + rows.join('\n');
  const blob = new globalThis.Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
