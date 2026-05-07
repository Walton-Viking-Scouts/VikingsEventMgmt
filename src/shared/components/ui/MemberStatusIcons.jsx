import React from 'react';
import { CameraIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { groupContactInfo } from '../../utils/contactGroups.js';
import { categorizeMedicalData, MEDICAL_DATA_STATES } from '../../utils/medicalDataUtils.js';

/**
 * Renders the small per-member status icon cluster used on Register, Attendance,
 * and Camp Group views. Centralises the previously duplicated logic so the four
 * call sites stay in sync when the icon set changes.
 *
 * Icons rendered (all conditional):
 *  - 📷 with strikethrough — explicit "no" photography consent
 *  - ⚠️                   — has medical details or allergies
 *  - 🍽️                  — has dietary requirements
 *  - 🛟                   — confirmed non-swimmer or unknown swimmer status
 *
 * @param {Object} props
 * @param {Object} props.member - Full member record. Contact-group fields are
 *   read via `groupContactInfo(member)` so the caller doesn't need to
 *   pre-compute them.
 * @param {('sm'|'base')} [props.size='sm'] - Visual size. `sm` matches the
 *   compact RegisterTab cluster; `base` matches the larger Attendance tiles.
 * @returns {React.ReactNode|null} Icon array, or null when no flags apply.
 */
function MemberStatusIcons({ member, size = 'sm' }) {
  if (!member) return null;

  const contactGroups = groupContactInfo(member);
  const consentGroup = contactGroups.consents || contactGroups.permissions;
  const essentialInfo = contactGroups.essential_information;

  const iconClass = size === 'base' ? 'w-5 h-5' : 'w-4 h-4';
  const emojiClass = size === 'base' ? 'text-base' : 'text-sm';

  const icons = [];

  if (consentGroup) {
    const photographsConsent = consentGroup.photographs || consentGroup.Photographs;
    if (photographsConsent === 'No' || photographsConsent === 'no') {
      icons.push(
        <span key="camera" className="relative inline-block" title="No photography consent">
          <CameraIcon className={`${iconClass} text-red-600`} />
          <svg className={`absolute inset-0 ${iconClass}`} viewBox="0 0 24 24">
            <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" className="text-red-600" />
          </svg>
        </span>,
      );
    }
  }

  if (essentialInfo) {
    const allergiesState = categorizeMedicalData(essentialInfo.allergies, 'allergies');
    const medicalState = categorizeMedicalData(essentialInfo.medical_details, 'medical_details');
    const dietaryState = categorizeMedicalData(essentialInfo.dietary_requirements, 'dietary_requirements');

    const hasMedicalOrAllergies =
      allergiesState === MEDICAL_DATA_STATES.HAS_DATA ||
      medicalState === MEDICAL_DATA_STATES.HAS_DATA;

    const hasDietaryRequirements = dietaryState === MEDICAL_DATA_STATES.HAS_DATA;

    if (hasMedicalOrAllergies) {
      icons.push(
        <ExclamationTriangleIcon
          key="medical"
          className={`${iconClass} text-yellow-600`}
          title="Has medical details or allergies"
        />,
      );
    }

    if (hasDietaryRequirements) {
      icons.push(
        <span key="dietary" className={emojiClass} title="Has dietary requirements">
          🍽️
        </span>,
      );
    }

    const swimmer = essentialInfo.swimmer;
    const isNonSwimmer = swimmer === 'No' || swimmer === 'no' || swimmer === null || swimmer === undefined || swimmer === '';
    if (isNonSwimmer) {
      icons.push(
        <span
          key="swimmer"
          className={emojiClass}
          title={swimmer === 'No' || swimmer === 'no' ? 'Non-swimmer' : 'Swimmer status unknown'}
        >
          🛟
        </span>,
      );
    }
  }

  return icons.length > 0 ? <>{icons}</> : null;
}

export default MemberStatusIcons;
