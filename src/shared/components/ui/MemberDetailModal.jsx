import React, { useEffect, useRef, useState } from 'react';
import { isMobileLayout } from '../../utils/platform.js';
import { groupContactInfo } from '../../utils/contactGroups.js';
import { calculateAge } from '../../utils/ageUtils.js';
import { handlePhoneCall } from '../../utils/phoneUtils.js';
import { MedicalDataPill } from './MedicalDataDisplay.jsx';

function MemberDetailModal({ member, isOpen, onClose }) {
  const modalRef = useRef(null);
  const isMobile = isMobileLayout();
  const [errorNotification, setErrorNotification] = useState(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
      // Clear any existing error notifications when modal opens
      setErrorNotification(null);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  if (!isOpen || !member) return null;

  // Handle phone call with error notification
  const onPhoneCall = (phone) => {
    handlePhoneCall(phone, (errorMessage) => {
      setErrorNotification(errorMessage);
      // Auto-hide error after 5 seconds
      setTimeout(() => setErrorNotification(null), 5000);
    });
  };


  const contactGroups = groupContactInfo(member);
  const age = calculateAge(member.date_of_birth);

  // Helper to check if a field is medical data that should use color coding
  const isMedicalField = (fieldKey) => {
    const medicalFields = ['allergies', 'medical_details', 'dietary_requirements'];
    return medicalFields.includes(fieldKey.toLowerCase());
  };

  // Group labels for display
  // Note: Backend cleaning process converts "Doctor's Surgery" → "doctor_s_surgery"
  const groupLabels = {
    primary_contact: 'Primary Contact',
    primary_contact_1: 'Primary Contact 1',
    primary_contact_2: 'Primary Contact 2',
    emergency_contact: 'Emergency Contact',
    emergency_contact_1: 'Emergency Contact 1',
    emergency_contact_2: 'Emergency Contact 2',
    doctor: 'Doctor',
    doctor_s_surgery: 'Doctor\'s Surgery', // Maps from "Doctor's Surgery" after apostrophe → underscore conversion
    member_contact: 'Member Contact',
    medical_information: 'Medical Information',
    gender: 'Gender',
    permissions: 'Permissions',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      data-oid="4a:p5i2"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`member-modal-title-${member.member_id || member.scoutid}`}
        aria-describedby={`member-modal-description-${member.member_id || member.scoutid}`}
        className={`
          bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden
          ${isMobile ? 'mx-2' : 'mx-4'}
        `}
        data-oid="-nqy1gk"
      >
        {/* Header */}
        <div
          className="bg-scout-blue text-white px-6 py-4 flex items-center justify-between"
          data-oid="0w81yxn"
        >
          <div className="flex items-center space-x-4" data-oid="s48hbia">
            <div className="flex-shrink-0" data-oid="jhbdbsm">
              {member.photo_guid ? (
                <img
                  src={`/api/photo/${member.photo_guid}`}
                  alt={`${member.firstname} ${member.lastname}`}
                  className="w-12 h-12 rounded-full object-cover"
                  data-oid="8w..8_t"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full bg-scout-purple flex items-center justify-center text-white font-semibold"
                  data-oid="ts8319g"
                >
                  {member.firstname?.[0]}
                  {member.lastname?.[0]}
                </div>
              )}
            </div>
            <div data-oid="qo9qxuk">
              <h2
                id={`member-modal-title-${member.member_id || member.scoutid}`}
                className="text-xl font-semibold"
                data-oid="ydxryqt"
              >
                {member.firstname} {member.lastname}
              </h2>
              <div
                id={`member-modal-description-${member.member_id || member.scoutid}`}
                className="flex items-center space-x-2 text-scout-blue-light"
                data-oid="ssubb.5"
              >
                {age && <span data-oid="dlr.a_x">Age {age}</span>}
                {member.patrol && (
                  <span data-oid="cc.tx.o">• {member.patrol}</span>
                )}
                {!age && !member.patrol && (
                  <span data-oid="v5wn5fm">
                    Member details and contact information
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-scout-blue-light transition-colors"
            data-oid="oqfmm.o"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              data-oid="tjvij6f"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
                data-oid="r1_8bsk"
              />
            </svg>
          </button>
        </div>

        {/* Error Notification */}
        {errorNotification && (
          <div
            className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4 rounded"
            data-oid="ws7wvy."
          >
            <div className="flex items-center" data-oid="zx1e4ek">
              <svg
                className="w-5 h-5 text-red-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
                data-oid="xkzyiul"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                  data-oid="ps.-nft"
                />
              </svg>
              <p className="text-sm text-red-700" data-oid="oc5ok9u">
                {errorNotification}
              </p>
              <button
                onClick={() => setErrorNotification(null)}
                className="ml-auto text-red-400 hover:text-red-600"
                aria-label="Dismiss error"
                data-oid="cq5cip4"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  data-oid="mfdgtl3"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                    data-oid="td1:l-j"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Content - Scrollable */}
        <div
          className="overflow-y-auto max-h-[calc(90vh-120px)]"
          data-oid="c6evg-j"
        >
          <div className="p-6 space-y-6" data-oid="f:7u082">
            {/* Basic Information */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm" data-oid="pbzk4gk">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg" data-oid="adj.8h8">
                <h3 className="text-lg font-semibold text-gray-900 m-0" data-oid="c56cxhk">Basic Information</h3>
              </div>
              <div className="p-4 space-y-3" data-oid="c3959gi">
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  data-oid="5cmma5x"
                >
                  <div data-oid=".0u8h_r">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      data-oid="1_x6fxy"
                    >
                      Member ID
                    </label>
                    <p className="text-sm text-gray-900" data-oid="oy4zgml">
                      {member.scoutid || member.member_id}
                    </p>
                  </div>
                  <div data-oid="ux8_pxo">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      data-oid="qwx_7vd"
                    >
                      Date of Birth
                    </label>
                    <p className="text-sm text-gray-900" data-oid="w3:7qgm">
                      {member.date_of_birth
                        ? new Date(member.date_of_birth).toLocaleDateString()
                        : 'Not provided'}
                    </p>
                  </div>
                  <div data-oid="jicupny">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      data-oid="6f99mvw"
                    >
                      Section(s)
                    </label>
                    <div className="flex flex-wrap gap-1" data-oid="1fp8xb2">
                      {(() => {
                        const sections = (
                          member.sections || [member.sectionname]
                        ).filter(Boolean);
                        return sections.length > 0 ? (
                          sections.map((section, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center font-medium rounded-full px-2.5 py-0.5 text-xs bg-scout-blue text-white"
                              data-oid="x9k1uyl"
                            >
                              {section}
                            </span>
                          ))
                        ) : (
                          <span
                            className="text-sm text-gray-500"
                            data-oid=":mktyw7"
                          >
                            No sections assigned
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div data-oid="b17_do0">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      data-oid="2:_mv-b"
                    >
                      Member Type
                    </label>
                    <span
                      className={`inline-flex items-center font-medium rounded-full px-2.5 py-0.5 text-xs ${
                        member.person_type === 'Leaders'
                          ? 'bg-scout-purple text-white'
                          : member.person_type === 'Young Leaders'
                            ? 'bg-scout-blue text-white'
                            : 'bg-scout-green text-white'
                      }`}
                      data-oid="_snnuwg"
                    >
                      {member.person_type || 'Young People'}
                    </span>
                  </div>
                  {member.started && (
                    <div data-oid="b72e5m-">
                      <label
                        className="block text-sm font-medium text-gray-700 mb-1"
                        data-oid="du3fy4c"
                      >
                        Started
                      </label>
                      <p className="text-sm text-gray-900" data-oid="705k0e2">
                        {new Date(member.started).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {member.patrol_role_level_label && (
                    <div data-oid="jpbseuq">
                      <label
                        className="block text-sm font-medium text-gray-700 mb-1"
                        data-oid="1:x5cht"
                      >
                        Role
                      </label>
                      <p className="text-sm text-gray-900" data-oid="uawxzfs">
                        {member.patrol_role_level_label}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Essential Information - moved up for immediate visibility */}
            {contactGroups.essential_information && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm" data-oid="_hcy7t3">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg" data-oid="ukfj_ep">
                  <h3 className="text-lg font-semibold text-gray-900 m-0" data-oid="3ilra-k">
                    Essential Information
                  </h3>
                </div>
                <div className="p-4 space-y-3" data-oid="k1mgp:k">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-oid="28l6-m6">
                    {Object.entries(contactGroups.essential_information).map(([fieldKey, fieldValue]) => (
                      <div key={fieldKey} data-oid="vvzdn00">
                        <label className="block text-sm font-medium text-gray-700 mb-1" data-oid="0-.-z__">
                          {fieldKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </label>
                        {fieldKey.includes('phone') ? (
                          <button
                            type="button"
                            onClick={() => onPhoneCall(fieldValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onPhoneCall(fieldValue);
                              }
                            }}
                            aria-label={`Call ${fieldValue}`}
                            className="text-sm text-scout-blue hover:text-scout-blue-dark underline cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-scout-blue focus:ring-offset-2 rounded"
                            data-oid="j21j0lb"
                          >
                            {fieldValue}
                          </button>
                        ) : fieldKey.includes('email') ? (
                          <a
                            href={`mailto:${fieldValue}`}
                            rel="noopener noreferrer"
                            aria-label={`Send email to ${fieldValue}`}
                            className="text-sm text-scout-blue hover:text-scout-blue-dark underline cursor-pointer transition-colors"
                            data-oid="q4r:6l_"
                          >
                            {fieldValue}
                          </a>
                        ) : isMedicalField(fieldKey) ? (
                          <MedicalDataPill 
                            value={fieldValue} 
                            fieldName={fieldKey}
                            className="text-sm"
                          />
                        ) : (
                          <p className="text-sm text-gray-900 whitespace-pre-wrap" data-oid="yj2ex-_">
                            {fieldValue}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Consents */}
            {(contactGroups.consents || contactGroups.permissions) && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm" data-oid="_hcy7t3">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg" data-oid="ukfj_ep">
                  <h3 className="text-lg font-semibold text-gray-900 m-0" data-oid="3ilra-k">
                    Consents
                  </h3>
                </div>
                <div className="p-4 space-y-3" data-oid="k1mgp:k">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-oid="28l6-m6">
                    {Object.entries(contactGroups.consents || contactGroups.permissions || {}).map(([fieldKey, fieldValue]) => (
                      <div key={fieldKey} data-oid="vvzdn00">
                        <label className="block text-sm font-medium text-gray-700 mb-1" data-oid="0-.-z__">
                          {fieldKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </label>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap" data-oid="yj2ex-_">
                          {fieldValue}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Remaining Contact Information */}
            {Object.entries(contactGroups)
              .filter(([groupKey]) => !['essential_information', 'consents', 'permissions'].includes(groupKey))
              .map(([groupKey, groupData]) => (
                <div key={groupKey} className="bg-white rounded-lg border border-gray-200 shadow-sm" data-oid="_hcy7t3">
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg" data-oid="ukfj_ep">
                    <h3 className="text-lg font-semibold text-gray-900 m-0" data-oid="3ilra-k">
                      {groupLabels[groupKey] ||
                      groupKey
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </h3>
                  </div>
                  <div className="p-4 space-y-3" data-oid="k1mgp:k">
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                      data-oid="28l6-m6"
                    >
                      {Object.entries(groupData).map(([fieldKey, fieldValue]) => (
                        <div key={fieldKey} data-oid="vvzdn00">
                          <label
                            className="block text-sm font-medium text-gray-700 mb-1"
                            data-oid="0-.-z__"
                          >
                            {fieldKey
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </label>
                          {fieldKey.includes('phone') ? (
                            <button
                              type="button"
                              onClick={() => onPhoneCall(fieldValue)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onPhoneCall(fieldValue);
                                }
                              }}
                              aria-label={`Call ${fieldValue}`}
                              className="text-sm text-scout-blue hover:text-scout-blue-dark underline cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-scout-blue focus:ring-offset-2 rounded"
                              data-oid="j21j0lb"
                            >
                              {fieldValue}
                            </button>
                          ) : fieldKey.includes('email') ? (
                            <a
                              href={`mailto:${fieldValue}`}
                              rel="noopener noreferrer"
                              aria-label={`Send email to ${fieldValue}`}
                              className="text-sm text-scout-blue hover:text-scout-blue-dark underline cursor-pointer transition-colors"
                              data-oid="q4r:6l_"
                            >
                              {fieldValue}
                            </a>
                          ) : isMedicalField(fieldKey) ? (
                            <MedicalDataPill 
                              value={fieldValue} 
                              fieldName={fieldKey}
                              className="text-sm"
                            />
                          ) : (
                            <p
                              className="text-sm text-gray-900 whitespace-pre-wrap"
                              data-oid="yj2ex-_"
                            >
                              {fieldValue}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

            {/* Legacy emergency contacts if available */}
            {member.emergency_contacts &&
              member.emergency_contacts.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm" data-oid="5j0ykq7">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg" data-oid="50z4nlo">
                  <h3 className="text-lg font-semibold text-gray-900 m-0" data-oid="9w1o:j5">
                      Emergency Contacts (Legacy)
                  </h3>
                </div>
                <div className="p-4 space-y-3" data-oid="1n:bfai">
                  {member.emergency_contacts.map((contact, idx) => (
                    <div
                      key={idx}
                      className="border-b border-gray-200 pb-3 last:border-b-0"
                      data-oid="c074mao"
                    >
                      <div
                        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                        data-oid="n14le-2"
                      >
                        {Object.entries(contact).map(([key, value]) => (
                          <div key={key} data-oid="0.tysyp">
                            <label
                              className="block text-sm font-medium text-gray-700 mb-1"
                              data-oid="s.mc1r:"
                            >
                              {key
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </label>
                            {key.includes('phone') ? (
                              <button
                                onClick={() => onPhoneCall(value)}
                                className="text-sm text-scout-blue hover:text-scout-blue-dark underline cursor-pointer transition-colors"
                                data-oid="wf8xba-"
                              >
                                {value}
                              </button>
                            ) : (
                              <p
                                className="text-sm text-gray-900"
                                data-oid="vviarjy"
                              >
                                {value}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div
          className="bg-gray-50 px-6 py-4 flex justify-end"
          data-oid="kg_9nkz"
        >
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-scout-blue focus:ring-offset-2 transition-colors"
            data-oid="u6m635w"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default MemberDetailModal;