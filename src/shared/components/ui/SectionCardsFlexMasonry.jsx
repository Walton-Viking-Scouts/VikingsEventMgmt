import React, { useMemo } from 'react';
import { CameraIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { groupContactInfo } from '../../utils/contactGroups.js';
import { categorizeMedicalData, MEDICAL_DATA_STATES } from '../../utils/medicalDataUtils.js';

const RESPONSIVE_BREAKPOINTS = {
  LARGE: 1024,
  MEDIUM: 768,
};

const COLUMN_COUNTS = {
  LARGE: 3,
  MEDIUM: 2,
  BASE: 1,
};

const HEIGHT_ESTIMATES = {
  HEADER: 64,
  MEMBER_ROW: 32,
};

const SectionCardsFlexMasonry = ({ sections, isYoungPerson, onMemberClick }) => {
  const { columns } = useMemo(() => {
    const getColumnCount = () => {
      if (typeof window === 'undefined') return COLUMN_COUNTS.BASE;
      const width = window.innerWidth;
      if (width >= RESPONSIVE_BREAKPOINTS.LARGE) return COLUMN_COUNTS.LARGE;
      if (width >= RESPONSIVE_BREAKPOINTS.MEDIUM) return COLUMN_COUNTS.MEDIUM;
      return COLUMN_COUNTS.BASE;
    };

    const columnCount = getColumnCount();

    const distributeCards = (cards, numColumns) => {
      const columns = Array(numColumns).fill(null).map(() => ({
        cards: [],
        height: 0,
      }));

      const getEstimatedHeight = (section) => {
        return HEIGHT_ESTIMATES.HEADER + (section.members.length * HEIGHT_ESTIMATES.MEMBER_ROW);
      };

      cards.forEach(section => {
        const estimatedHeight = getEstimatedHeight(section);

        const shortestColumn = columns.reduce(
          (min, col) => (col.height < min.height ? col : min),
          columns[0],
        );
        
        shortestColumn.cards.push(section);
        shortestColumn.height += estimatedHeight;
      });

      return columns;
    };

    const distributedColumns = distributeCards(sections, columnCount);

    return {
      columns: distributedColumns,
    };
  }, [sections]);

  return (
    <div 
      className="flex gap-4 w-full"
      role="region"
      aria-label="Section attendance cards in masonry layout"
      data-oid="section-cards"
    >
      {columns.map((column, columnIndex) => (
        <div 
          key={columnIndex} 
          className="flex-1 flex flex-col gap-4"
          style={{ minHeight: 0 }}
        >
          {column.cards.map((section) => (
            <div
              key={section.sectionid}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              role="article"
              aria-labelledby={`section-title-${section.sectionid}`}
              aria-describedby={`section-stats-${section.sectionid}`}
            >
              <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h4 
                    id={`section-title-${section.sectionid}`}
                    className="text-lg font-semibold text-gray-900"
                  >
                    {section.sectionname}
                  </h4>
                  <div 
                    id={`section-stats-${section.sectionid}`}
                    className="flex gap-3 text-sm text-gray-600"
                  >
                    <span>{section.members.length} total</span>
                    <span>•</span>
                    <span>{section.youngPeopleCount} YP</span>
                    <span>•</span>
                    <span>{section.adultsCount} adults</span>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-200">
                {section.members.map((member, memberIndex) => (
                  <div
                    key={`${section.sectionid}-${member.scoutid || memberIndex}`}
                    className="px-4 py-1 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                        <button
                          onClick={() => onMemberClick?.(member)}
                          className="text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left"
                        >
                          {member.firstname} {member.lastname}
                        </button>
                        {(() => {
                          const contactGroups = groupContactInfo(member);
                          const consentGroup = contactGroups.consents || contactGroups.permissions;
                          const essentialInfo = contactGroups.essential_information;

                          const icons = [];

                          if (consentGroup) {
                            const photographsConsent = consentGroup.photographs || consentGroup.Photographs;
                            if (photographsConsent === 'No' || photographsConsent === 'no') {
                              icons.push(
                                <span key="camera" className="relative inline-block" title="No photography consent">
                                  <CameraIcon className="w-5 h-5 text-red-600" />
                                  <svg className="absolute inset-0 w-5 h-5" viewBox="0 0 24 24">
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
                                  className="w-5 h-5 text-yellow-600"
                                  title="Has medical details or allergies"
                                />,
                              );
                            }

                            if (hasDietaryRequirements) {
                              icons.push(
                                <span key="dietary" className="text-base" title="Has dietary requirements">
                                  🍽️
                                </span>,
                              );
                            }
                          }

                          return icons.length > 0 ? icons : null;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        isYoungPerson(member.age)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {isYoungPerson(member.age) ? 'YP' : 'Adult'}
                      </span>
                      <div className="text-sm text-gray-500 w-16 text-right">
                        {member.age || 'N/A'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default SectionCardsFlexMasonry;