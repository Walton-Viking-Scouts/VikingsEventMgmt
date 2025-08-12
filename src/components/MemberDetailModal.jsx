import React, { useEffect, useRef, useState } from "react";
import { Button, Badge, Card } from "./ui";
import { isMobileLayout } from "../utils/platform.js";

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
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden"; // Prevent background scroll
      // Clear any existing error notifications when modal opens
      setErrorNotification(null);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Handle ESC key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => document.removeEventListener("keydown", handleEscKey);
  }, [isOpen, onClose]);

  if (!isOpen || !member) return null;

  // Helper function to calculate age
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birth = new Date(dateOfBirth);
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      return age - 1;
    }
    return age;
  };

  // Helper function to format phone number for calling
  const formatPhoneForCall = (phone) => {
    if (!phone) return null;
    // Remove all non-digit characters for tel: link
    const cleanPhone = phone.replace(/\D/g, "");

    // Validate phone number length and pattern
    if (!isValidPhoneNumber(cleanPhone)) {
      return null;
    }

    return cleanPhone;
  };

  // Helper function to validate phone number
  const isValidPhoneNumber = (phoneDigits) => {
    if (!phoneDigits || typeof phoneDigits !== "string") {
      return false;
    }

    // Check length: most phone numbers are between 7-15 digits
    // UK numbers: 10-11 digits, US: 10 digits, International: up to 15 digits
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return false;
    }

    // Check if it contains only digits
    if (!/^\d+$/.test(phoneDigits)) {
      return false;
    }

    // Additional validation: avoid obvious invalid patterns
    // Reject numbers with all same digits (e.g., 0000000000)
    if (/^(\d)\1+$/.test(phoneDigits)) {
      return false;
    }

    // Reject numbers starting with 0 or 1 for international format
    // (unless it's a UK number which can start with 0)
    if (
      phoneDigits.length >= 10 &&
      phoneDigits.startsWith("1") &&
      phoneDigits.length === 10
    ) {
      return false; // US numbers starting with 1 (area code can't be 1)
    }

    return true;
  };

  // Helper function to handle phone call
  const handlePhoneCall = (phone) => {
    if (!phone) return;
    const cleanPhone = formatPhoneForCall(phone);
    if (cleanPhone) {
      window.location.href = `tel:${cleanPhone}`;
    } else {
      console.warn("Invalid phone number format:", phone);
      setErrorNotification(
        "Invalid phone number format. Please check the number and try again.",
      );
      // Auto-hide error after 5 seconds
      setTimeout(() => setErrorNotification(null), 5000);
    }
  };

  // Helper function to group contact information
  const groupContactInfo = (member) => {
    const groups = {};

    // Process flattened contact fields
    Object.entries(member).forEach(([key, value]) => {
      if (key.includes("__") && value) {
        const [groupName, fieldName] = key.split("__");
        if (!groups[groupName]) {
          groups[groupName] = {};
        }
        groups[groupName][fieldName] = value;
      }
    });

    // Add legacy fields to appropriate groups
    if (member.email || member.phone) {
      if (!groups.member_contact) {
        groups.member_contact = {};
      }
      if (member.email) groups.member_contact.email = member.email;
      if (member.phone) groups.member_contact.phone = member.phone;
    }

    return groups;
  };

  const contactGroups = groupContactInfo(member);
  const age = calculateAge(member.date_of_birth);

  // Group labels for display
  // Note: Backend cleaning process converts "Doctor's Surgery" → "doctor_s_surgery"
  const groupLabels = {
    primary_contact: "Primary Contact",
    primary_contact_1: "Primary Contact 1",
    primary_contact_2: "Primary Contact 2",
    emergency_contact: "Emergency Contact",
    emergency_contact_1: "Emergency Contact 1",
    emergency_contact_2: "Emergency Contact 2",
    doctor: "Doctor",
    doctor_s_surgery: "Doctor's Surgery", // Maps from "Doctor's Surgery" after apostrophe → underscore conversion
    member_contact: "Member Contact",
    medical_information: "Medical Information",
    gender: "Gender",
    permissions: "Permissions",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      data-oid="ctlwrzn"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`member-modal-title-${member.member_id || member.scoutid}`}
        aria-describedby={`member-modal-description-${member.member_id || member.scoutid}`}
        className={`
          bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden
          ${isMobile ? "mx-2" : "mx-4"}
        `}
        data-oid="poa22s3"
      >
        {/* Header */}
        <div
          className="bg-scout-blue text-white px-6 py-4 flex items-center justify-between"
          data-oid="otg7:qc"
        >
          <div className="flex items-center space-x-4" data-oid="uxoiw9z">
            <div className="flex-shrink-0" data-oid="ol6q-vu">
              {member.photo_guid ? (
                <img
                  src={`/api/photo/${member.photo_guid}`}
                  alt={`${member.firstname} ${member.lastname}`}
                  className="w-12 h-12 rounded-full object-cover"
                  data-oid="-1:jhkp"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full bg-scout-purple flex items-center justify-center text-white font-semibold"
                  data-oid=":644.fa"
                >
                  {member.firstname?.[0]}
                  {member.lastname?.[0]}
                </div>
              )}
            </div>
            <div data-oid="rr40a8i">
              <h2
                id={`member-modal-title-${member.member_id || member.scoutid}`}
                className="text-xl font-semibold"
                data-oid="-:_fr-d"
              >
                {member.firstname} {member.lastname}
              </h2>
              <div
                id={`member-modal-description-${member.member_id || member.scoutid}`}
                className="flex items-center space-x-2 text-scout-blue-light"
                data-oid=":2m22uy"
              >
                {age && <span data-oid="4pdx4sj">Age {age}</span>}
                {member.patrol && (
                  <span data-oid="ck4p58_">• {member.patrol}</span>
                )}
                {!age && !member.patrol && (
                  <span data-oid="xya.:31">
                    Member details and contact information
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-scout-blue-light transition-colors"
            data-oid="_vquhs:"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              data-oid="frg8eov"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
                data-oid="uabr--b"
              />
            </svg>
          </button>
        </div>

        {/* Error Notification */}
        {errorNotification && (
          <div
            className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4 rounded"
            data-oid="lc.8qv6"
          >
            <div className="flex items-center" data-oid="ljum9cu">
              <svg
                className="w-5 h-5 text-red-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
                data-oid="anzr:sa"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                  data-oid="z0e0w_m"
                />
              </svg>
              <p className="text-sm text-red-700" data-oid="kh9l9e-">
                {errorNotification}
              </p>
              <button
                onClick={() => setErrorNotification(null)}
                className="ml-auto text-red-400 hover:text-red-600"
                aria-label="Dismiss error"
                data-oid="6q0_8bo"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  data-oid="bar9k1o"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                    data-oid="sljx0oe"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Content - Scrollable */}
        <div
          className="overflow-y-auto max-h-[calc(90vh-120px)]"
          data-oid="p0gc190"
        >
          <div className="p-6 space-y-6" data-oid="u2nf227">
            {/* Basic Information */}
            <Card data-oid="z1w97c-">
              <Card.Header data-oid="jz0qe01">
                <Card.Title data-oid="dngfyw.">Basic Information</Card.Title>
              </Card.Header>
              <Card.Body className="space-y-3" data-oid="6ncbpub">
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  data-oid=":.xwp0m"
                >
                  <div data-oid="gq807kf">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      data-oid="e3wya:z"
                    >
                      Member ID
                    </label>
                    <p className="text-sm text-gray-900" data-oid="561d8gy">
                      {member.scoutid || member.member_id}
                    </p>
                  </div>
                  <div data-oid="5o45iw_">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      data-oid="574qto_"
                    >
                      Date of Birth
                    </label>
                    <p className="text-sm text-gray-900" data-oid="qix58ad">
                      {member.date_of_birth
                        ? new Date(member.date_of_birth).toLocaleDateString()
                        : "Not provided"}
                    </p>
                  </div>
                  <div data-oid="rsd7njb">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      data-oid="7c3o0.a"
                    >
                      Section(s)
                    </label>
                    <div className="flex flex-wrap gap-1" data-oid="pn4p_bz">
                      {(() => {
                        const sections = (
                          member.sections || [member.sectionname]
                        ).filter(Boolean);
                        return sections.length > 0 ? (
                          sections.map((section, idx) => (
                            <Badge
                              key={idx}
                              variant="scout-blue"
                              size="sm"
                              data-oid="a1yr63o"
                            >
                              {section}
                            </Badge>
                          ))
                        ) : (
                          <span
                            className="text-sm text-gray-500"
                            data-oid="wxyudwj"
                          >
                            No sections assigned
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div data-oid="3qel6ww">
                    <label
                      className="block text-sm font-medium text-gray-700 mb-1"
                      data-oid=".r1wb9m"
                    >
                      Member Type
                    </label>
                    <Badge
                      variant={
                        member.person_type === "Leaders"
                          ? "scout-purple"
                          : member.person_type === "Young Leaders"
                            ? "scout-blue"
                            : "scout-green"
                      }
                      size="sm"
                      data-oid="t:on0yf"
                    >
                      {member.person_type || "Young People"}
                    </Badge>
                  </div>
                  {member.started && (
                    <div data-oid="vko9msv">
                      <label
                        className="block text-sm font-medium text-gray-700 mb-1"
                        data-oid="ehky1wn"
                      >
                        Started
                      </label>
                      <p className="text-sm text-gray-900" data-oid="660.t5a">
                        {new Date(member.started).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {member.patrol_role_level_label && (
                    <div data-oid="g81t_lt">
                      <label
                        className="block text-sm font-medium text-gray-700 mb-1"
                        data-oid="sh.3r4h"
                      >
                        Role
                      </label>
                      <p className="text-sm text-gray-900" data-oid="bizuhqh">
                        {member.patrol_role_level_label}
                      </p>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>

            {/* Contact Information */}
            {Object.entries(contactGroups).map(([groupKey, groupData]) => (
              <Card key={groupKey} data-oid="tsk2spt">
                <Card.Header data-oid="n_cfa06">
                  <Card.Title data-oid="czcw6-j">
                    {groupLabels[groupKey] ||
                      groupKey
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Card.Title>
                </Card.Header>
                <Card.Body className="space-y-3" data-oid="74x8a8e">
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    data-oid="auo5yj-"
                  >
                    {Object.entries(groupData).map(([fieldKey, fieldValue]) => (
                      <div key={fieldKey} data-oid="vrgaqx4">
                        <label
                          className="block text-sm font-medium text-gray-700 mb-1"
                          data-oid="j-55mwt"
                        >
                          {fieldKey
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </label>
                        {fieldKey.includes("phone") ? (
                          <button
                            type="button"
                            onClick={() => handlePhoneCall(fieldValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handlePhoneCall(fieldValue);
                              }
                            }}
                            aria-label={`Call ${fieldValue}`}
                            className="text-sm text-scout-blue hover:text-scout-blue-dark underline cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-scout-blue focus:ring-offset-2 rounded"
                            data-oid="e:.:k4."
                          >
                            {fieldValue}
                          </button>
                        ) : fieldKey.includes("email") ? (
                          <a
                            href={`mailto:${fieldValue}`}
                            rel="noopener noreferrer"
                            aria-label={`Send email to ${fieldValue}`}
                            className="text-sm text-scout-blue hover:text-scout-blue-dark underline cursor-pointer transition-colors"
                            data-oid="tps-f:n"
                          >
                            {fieldValue}
                          </a>
                        ) : (
                          <p
                            className="text-sm text-gray-900 whitespace-pre-wrap"
                            data-oid="6u:o:5h"
                          >
                            {fieldValue}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            ))}

            {/* Legacy emergency contacts if available */}
            {member.emergency_contacts &&
              member.emergency_contacts.length > 0 && (
                <Card data-oid="46hyz.p">
                  <Card.Header data-oid="txvme2o">
                    <Card.Title data-oid="r5qjm4i">
                      Emergency Contacts (Legacy)
                    </Card.Title>
                  </Card.Header>
                  <Card.Body className="space-y-3" data-oid="z9c.z-t">
                    {member.emergency_contacts.map((contact, idx) => (
                      <div
                        key={idx}
                        className="border-b border-gray-200 pb-3 last:border-b-0"
                        data-oid="xvqlb4f"
                      >
                        <div
                          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                          data-oid="8_8xwjb"
                        >
                          {Object.entries(contact).map(([key, value]) => (
                            <div key={key} data-oid="-n191l4">
                              <label
                                className="block text-sm font-medium text-gray-700 mb-1"
                                data-oid="mkydts1"
                              >
                                {key
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (l) => l.toUpperCase())}
                              </label>
                              {key.includes("phone") ? (
                                <button
                                  onClick={() => handlePhoneCall(value)}
                                  className="text-sm text-scout-blue hover:text-scout-blue-dark underline cursor-pointer transition-colors"
                                  data-oid="g:sk68k"
                                >
                                  {value}
                                </button>
                              ) : (
                                <p
                                  className="text-sm text-gray-900"
                                  data-oid="va2c3qo"
                                >
                                  {value}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              )}

            {/* Medical Information (Legacy) */}
            {member.medical_notes && (
              <Card data-oid="g8v.829">
                <Card.Header data-oid="2mtx.o6">
                  <Card.Title className="text-orange-600" data-oid="wtt:-38">
                    Medical Information
                  </Card.Title>
                </Card.Header>
                <Card.Body data-oid="g011xp4">
                  <div
                    className="bg-orange-50 border border-orange-200 rounded-md p-3"
                    data-oid="iv29o5d"
                  >
                    <div className="flex items-start" data-oid="jnr4gi0">
                      <svg
                        className="w-5 h-5 text-orange-600 mt-0.5 mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        data-oid="sy36wje"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                          data-oid="ms4n8y0"
                        />
                      </svg>
                      <p
                        className="text-sm text-orange-800 whitespace-pre-wrap"
                        data-oid="vsz5jk6"
                      >
                        {member.medical_notes}
                      </p>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="bg-gray-50 px-6 py-4 flex justify-end"
          data-oid="hndh-om"
        >
          <Button variant="outline" onClick={onClose} data-oid=".tx51cr">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MemberDetailModal;
