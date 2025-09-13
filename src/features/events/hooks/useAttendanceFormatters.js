import { useMemo } from 'react';
import { findMemberSectionName } from '../../../shared/utils/sectionHelpers.js';
import { groupContactInfo } from '../../../shared/utils/contactGroups.js';

/**
 * Custom hook for formatting attendance data and member information
 * 
 * Provides formatting utilities for attendance records including UK date/time
 * formatting and comprehensive member data retrieval with section lookups
 * and contact information processing.
 * 
 * @param {Array} members - Array of member data for lookups and formatting
 * @param {Array} sectionsCache - Cached section data for member section lookups
 * @returns {{formatUKDateTime: Function, getComprehensiveMemberData: Function}} Formatting utilities
 */
export function useAttendanceFormatters(members, sectionsCache) {
  const formatUKDateTime = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      return dateString;
    }
  };

  const getComprehensiveMemberData = useMemo(() => {
    return (attendanceRecord) => {
      const scoutidAsNumber = parseInt(attendanceRecord.scoutid, 10);
      const cachedMember = members?.find((m) => m.scoutid === scoutidAsNumber);
      
      if (!cachedMember) {
        return {
          ...attendanceRecord,
          name: attendanceRecord.firstname + ' ' + attendanceRecord.lastname,
          sectionName: findMemberSectionName(
            attendanceRecord.sectionid,
            sectionsCache,
          ),
        };
      }
      
      const contactGroups = groupContactInfo(cachedMember);
      
      const getField = (groupNames, fieldNames) => {
        for (const groupName of groupNames) {
          const group = contactGroups[groupName];
          if (group) {
            for (const fieldName of fieldNames) {
              if (group[fieldName] && group[fieldName] !== '') {
                return group[fieldName];
              }
            }
          }
        }
        return null;
      };
      
      const combineFields = (groupNames, fieldNames, separator = ', ') => {
        const values = [];
        for (const groupName of groupNames) {
          const group = contactGroups[groupName];
          if (group) {
            for (const fieldName of fieldNames) {
              if (group[fieldName] && group[fieldName] !== '' && !values.includes(group[fieldName])) {
                values.push(group[fieldName]);
              }
            }
          }
        }
        return values.length > 0 ? values.join(separator) : null;
      };

      // Primary contacts
      const primaryContacts = (() => {
        const contacts = [];
        
        const pc1_name = combineFields(['primary_contact_1'], ['first_name', 'last_name'], ' ') || 
                         getField(['primary_contact_1'], ['name']);
        const pc1_phone = combineFields(['primary_contact_1'], ['phone_1', 'phone_2']) || 
                          getField(['primary_contact_1'], ['phone']);
        const pc1_email = combineFields(['primary_contact_1'], ['email_1', 'email_2']) || 
                          getField(['primary_contact_1'], ['email']);
        
        if (pc1_name || pc1_phone || pc1_email) {
          contacts.push({ name: pc1_name, phone: pc1_phone, email: pc1_email });
        }
        
        const pc2_name = combineFields(['primary_contact_2'], ['first_name', 'last_name'], ' ') || 
                         getField(['primary_contact_2'], ['name']);
        const pc2_phone = combineFields(['primary_contact_2'], ['phone_1', 'phone_2']) || 
                          getField(['primary_contact_2'], ['phone']);
        const pc2_email = combineFields(['primary_contact_2'], ['email_1', 'email_2']) || 
                          getField(['primary_contact_2'], ['email']);
        
        if (pc2_name || pc2_phone || pc2_email) {
          contacts.push({ name: pc2_name, phone: pc2_phone, email: pc2_email });
        }
        
        return contacts;
      })();

      // Emergency contacts
      const emergencyContacts = (() => {
        const contacts = [];
        
        const ec_name = combineFields(['emergency_contact'], ['first_name', 'last_name'], ' ') ||
                        getField(['emergency_contact'], ['name']);
        const ec_phone = combineFields(['emergency_contact'], ['phone_1', 'phone_2']) ||
                         getField(['emergency_contact'], ['phone']);
        const ec_email = combineFields(['emergency_contact'], ['email_1', 'email_2']) ||
                         getField(['emergency_contact'], ['email']);
        
        if (ec_name || ec_phone || ec_email) {
          contacts.push({ name: ec_name, phone: ec_phone, email: ec_email });
        }
        
        return contacts;
      })();

      return {
        ...attendanceRecord,
        name: cachedMember.firstname + ' ' + cachedMember.lastname,
        sectionName: findMemberSectionName(cachedMember.sectionid, sectionsCache),
        dob: cachedMember.date_of_birth,
        allergies: cachedMember.custom_data?.allergies,
        dietaryRequirements: cachedMember.custom_data?.dietary_requirements,
        medicalConditions: cachedMember.custom_data?.medical_conditions,
        primaryContacts,
        emergencyContacts,
      };
    };
  }, [members, sectionsCache]);

  return {
    formatUKDateTime,
    getComprehensiveMemberData,
  };
}