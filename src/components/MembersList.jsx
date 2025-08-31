import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { getListOfMembers } from '../services/api.js';
import { getToken } from '../services/auth.js';
import { Button, Card, Input } from './ui';
import { AlertAdapter } from '../adapters';
import { useNotification } from '../contexts/notifications/NotificationContext';
import LoadingScreen from './LoadingScreen.jsx';
import MemberDetailModal from './MemberDetailModal.jsx';
import ComprehensiveMemberTable from './ComprehensiveMemberTable.jsx';
import { getMedicalFieldsFromMember } from '../utils/medicalDataUtils.js';

function MembersList({
  sections,
  members: propsMembers,
  onBack,
  embedded = false,
  showHeader = true,
}) {
  const [members, setMembers] = useState(propsMembers || []);
  const [loading, setLoading] = useState(!propsMembers);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  const { notifyWarning, notifySuccess, notifyError } = useNotification();

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const sectionIds = useMemo(
    () => sections.map((s) => s.sectionid),
    [sections],
  );
  const sectionIdsKey = sectionIds.join(',');

  const loadMembers = useCallback(async () => {
    if (!mountedRef.current) return;

    setError(null);
    setLoading(true);
    const currentRequestId = ++requestIdRef.current;

    try {
      const token = getToken();
      const members = await getListOfMembers(sections, token);

      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setMembers(members);
      }
    } catch (err) {
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        console.error('Error loading members:', err);
        setError(`Failed to load members: ${err.message || 'Unknown error'}`);
      }
    } finally {
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, [sections]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (propsMembers) {
      requestIdRef.current++;
      setMembers(propsMembers);
      setLoading(false);
      setError(null);
    } else {
      loadMembers();
    }
  }, [sectionIdsKey, propsMembers, loadMembers]);

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return '';

    try {
      const birth = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch {
      return '';
    }
  };

  // Filter members (sorting is handled by ComprehensiveMemberTable)
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const searchLower = searchTerm.toLowerCase();
      const fullName =
        `${member.firstname || ''} ${member.lastname || ''}`.toLowerCase();
      const email = (member.email || '').toLowerCase();
      const sectionsText = (member.sections || []).join(' ').toLowerCase();

      return (
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        sectionsText.includes(searchLower)
      );
    });
  }, [members, searchTerm]);

  const exportToCSV = () => {
    if (filteredMembers.length === 0) {
      notifyWarning('No members to export');
      return;
    }

    try {
      const headers = [
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Sections',
        'Patrol',
        'Type',
        'Age',
        'Date of Birth',
        'Address',
        'Postcode',
        'Emergency Contacts',
        'Allergies',
        'Medical Details',
        'Dietary Requirements',
        'Allergies Status',
        'Medical Status',
        'Dietary Status',
        'Photo Consent',
        'Sensitive Info Consent',
        'Paracetamol Consent',
        'Ibuprofen Consent',
        'Suncream Consent',
        'Active',
        'Started',
        'Joined',
      ];

      const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csvRows = [
        headers.map(csv).join(','),
        ...filteredMembers.map((member) => {
          const emergencyContacts = (member.emergency_contacts || [])
            .map((c) => {
              const parts = [];
              if (c?.name && String(c.name).trim() !== '') parts.push(String(c.name).trim());
              if (c?.phone && String(c.phone).trim() !== '') parts.push(`(${String(c.phone).trim()})`);
              if (c?.email && String(c.email).trim() !== '') parts.push(String(c.email).trim());
              return parts.join(' ').trim();
            })
            .filter((s) => s.length > 0)
            .join('; ');

          const medicalFields = getMedicalFieldsFromMember(member);

          const groupContactInfo = (member) => {
            const groups = {};
            Object.entries(member).forEach(([key, value]) => {
              if (key.includes('__') && value) {
                const [groupName, fieldName] = key.split('__');
                if (!groups[groupName]) {
                  groups[groupName] = {};
                }
                groups[groupName][fieldName] = value;
              }
            });
            return groups;
          };

          const contactGroups = groupContactInfo(member);
          const getField = (groupNames, fieldNames) => {
            for (const groupName of Array.isArray(groupNames) ? groupNames : [groupNames]) {
              const group = contactGroups[groupName];
              if (group) {
                for (const fieldName of Array.isArray(fieldNames) ? fieldNames : [fieldNames]) {
                  if (group[fieldName]) return group[fieldName];
                }
              }
            }
            return '';
          };

          return [
            csv(member.firstname),
            csv(member.lastname),
            csv(member.email),
            csv(member.phone),
            csv((member.sections || []).join('; ')),
            csv(member.patrol),
            csv(member.person_type || 'Young People'),
            csv(calculateAge(member.date_of_birth)),
            csv(member.date_of_birth),
            csv(member.address),
            csv(member.postcode),
            csv(emergencyContacts),
            csv(medicalFields.allergies.csvValue),
            csv(medicalFields.medical_details.csvValue),
            csv(medicalFields.dietary_requirements.csvValue),
            csv(medicalFields.allergies.indicator.label),
            csv(medicalFields.medical_details.indicator.label),
            csv(medicalFields.dietary_requirements.indicator.label),
            csv(getField(['consents'], ['photographs', 'photos']) || member.consents__photographs || ''),
            csv(getField(['consents'], ['sensitive_information']) || member.consents__sensitive_information || ''),
            csv(getField(['consents'], ['paracetamol']) || member.consents__paracetamol || ''),
            csv(getField(['consents'], ['ibuprofen']) || member.consents__ibuprofen || ''),
            csv(getField(['consents'], ['suncream', 'sun_cream']) || member.consents__suncream || ''),
            csv(member.active === true ? 'Yes' : member.active === false ? 'No' : ''),
            csv(member.started),
            csv(member.joined),
          ].join(',');
        }),
      ];

      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new globalThis.Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `members_${sectionIds.join('_')}_${new Date().toISOString().split('T')[0]}.csv`,
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      
      notifySuccess(`Exported ${filteredMembers.length} member records`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      notifyError('Failed to export member data');
    }
  };

  // Handle member click to show detail modal
  const handleMemberClick = (member) => {
    if (import.meta.env?.DEV) {
      console.log('MembersList — member selected:', {
        scoutid: member.scoutid,
        name: member.name || `${member.firstname} ${member.lastname}`,
        keyCount: Object.keys(member).length,
      });
    }
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
  };

  if (loading) {
    return <LoadingScreen message="Loading members..." />;
  }

  if (error) {
    return (
      <AlertAdapter variant="error" className="m-4">
        <AlertAdapter.Title>Error Loading Members</AlertAdapter.Title>
        <AlertAdapter.Description>{error}</AlertAdapter.Description>
        <AlertAdapter.Actions>
          <Button variant="scout-blue" onClick={loadMembers} type="button">
            Retry
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack} type="button">
              Back to Dashboard
            </Button>
          )}
        </AlertAdapter.Actions>
      </AlertAdapter>
    );
  }

  return (
    <div className={embedded ? '' : 'px-4 sm:px-6 lg:px-8'}>
      {/* Header - only show if not embedded */}
      {showHeader && (
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">
              Members ({filteredMembers.length})
            </h1>
            <p className="mt-2 text-sm text-gray-700">
              Members from selected sections:{' '}
              {sections.map((s) => s.sectionname).join(', ')}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3">
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredMembers.length === 0}
              type="button"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export CSV
            </Button>
            {onBack && (
              <Button variant="outline" onClick={onBack} type="button">
                Back to Dashboard
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Search filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search members by name, email, or section..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {/* Members table/cards */}
      <div className="mt-6">
        {filteredMembers.length === 0 ? (
          <Card>
            <Card.Body className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No members found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm
                  ? 'Try adjusting your search terms.'
                  : 'No members available for the selected sections.'}
              </p>
            </Card.Body>
          </Card>
        ) : (
          <ComprehensiveMemberTable
            members={filteredMembers}
            onMemberClick={handleMemberClick}
            showFilters={true}
          />
        )}
      </div>

      {/* Member Detail Modal */}
      <MemberDetailModal
        member={selectedMember}
        isOpen={showMemberModal}
        onClose={handleModalClose}
      />
    </div>
  );
}

export default MembersList;