import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { getListOfMembers } from '../services/api.js';
import { getToken } from '../services/auth.js';
import { Button, Card, Input, Alert } from './ui';
import LoadingScreen from './LoadingScreen.jsx';
import MemberDetailModal from './MemberDetailModal.jsx';
import ComprehensiveMemberTable from './ComprehensiveMemberTable.jsx';
import { isMobileLayout } from '../utils/platform.js';

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
  const [sortField, setSortField] = useState('lastname');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const isMobile = isMobileLayout();
  const sectionIds = useMemo(
    () => sections.map((s) => s.sectionid),
    [sections],
  );
  const sectionIdsKey = sectionIds.join(',');

  const loadMembers = useCallback(async () => {
    if (!mountedRef.current) return;

    // Clear error state immediately so Retry hides error UI
    setError(null);
    setLoading(true);

    // Increment requestId to guard against race conditions
    const currentRequestId = ++requestIdRef.current;

    try {
      const token = getToken();
      const members = await getListOfMembers(sections, token);

      // Only apply state updates if component is mounted AND this is the latest request
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setMembers(members);
      }
    } catch (e) {
      // Only apply error state if component is mounted AND this is the latest request
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setError(e?.message ?? 'Unable to load members. Please try again.');
      }
    } finally {
      // Only turn off loading for the matching requestId so stale requests cannot override
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, [sections]); // sections changes are captured directly

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (propsMembers) {
      // Cancel any in-flight async load and use provided data
      requestIdRef.current++;
      setMembers(propsMembers);
      setLoading(false);
      setError(null);
    } else {
      // Load members if not provided
      loadMembers();
    }
  }, [sectionIdsKey, propsMembers, loadMembers]);

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return '';
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }
      return age;
    } catch {
      return '';
    }
  };


  // Filter and sort members
  const filteredAndSortedMembers = useMemo(() => {
    const filtered = members.filter((member) => {
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

    filtered.sort((a, b) => {
      let aValue = a[sortField] || '';
      let bValue = b[sortField] || '';

      // Special handling for specific fields
      if (sortField === 'name') {
        aValue = `${a.lastname || ''} ${a.firstname || ''}`;
        bValue = `${b.lastname || ''} ${b.firstname || ''}`;
      } else if (sortField === 'sections') {
        aValue = (a.sections || []).join(', ');
        bValue = (b.sections || []).join(', ');
      } else if (sortField === 'age') {
        aValue = calculateAge(a.date_of_birth);
        bValue = calculateAge(b.date_of_birth);
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [members, searchTerm, sortField, sortDirection]);

  const _handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const exportToCSV = () => {
    if (filteredAndSortedMembers.length === 0) {
      alert('No members to export');
      return;
    }

    // Define CSV headers based on available data
    const headers = [
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Sections',
      'Patrol',
      'Person Type',
      'Age',
      'Date of Birth',
      'Address',
      'Postcode',
      'Emergency Contacts',
      'Medical Notes',
      'Dietary Requirements',
      'Active',
      'Started',
      'Joined',
    ];

    // Convert members to CSV rows using enhanced data
    const csvRows = [
      headers.join(','),
      ...filteredAndSortedMembers.map((member) => {
        const emergencyContacts = (member.emergency_contacts || [])
          .map((contact) =>
            `${contact.name} (${contact.phone}) ${contact.email}`.trim(),
          )
          .join('; ');

        return [
          `"${member.firstname || ''}"`,
          `"${member.lastname || ''}"`,
          `"${member.email || ''}"`,
          `"${member.phone || ''}"`,
          `"${(member.sections || []).join('; ')}"`,
          `"${member.patrol || ''}"`,
          `"${member.person_type || 'Young People'}"`,
          `"${calculateAge(member.date_of_birth)}"`,
          `"${member.date_of_birth || ''}"`,
          `"${member.address || ''}"`,
          `"${member.postcode || ''}"`,
          `"${emergencyContacts}"`,
          `"${member.medical_notes || ''}"`,
          `"${member.dietary_requirements || ''}"`,
          `"${member.active ? 'Yes' : 'No'}"`,
          `"${member.started || ''}"`,
          `"${member.joined || ''}"`,
        ].join(',');
      }),
    ];

    // Create and download CSV file
    const csvContent = csvRows.join('\n');
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
  };

  const _SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <span className="text-gray-300">↕</span>;
    }
    return (
      <span className="text-scout-blue">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Handle member click to show detail modal
  const handleMemberClick = (member) => {
    console.log('✅ MembersList (WORKING) member structure:', {
      scoutid: member.scoutid,
      firstname: member.firstname,
      lastname: member.lastname,
      date_of_birth: member.date_of_birth,
      email: member.email,
      phone: member.phone,
      emergency_contacts: member.emergency_contacts,
      medical_notes: member.medical_notes,
      sections: member.sections,
      allKeys: Object.keys(member).sort(),
    });
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
      <Alert variant="danger" className="m-4">
        <Alert.Title>Error Loading Members</Alert.Title>
        <Alert.Description>{error}</Alert.Description>
        <Alert.Actions>
          <Button variant="scout-blue" onClick={loadMembers} type="button">
            Retry
          </Button>
          <Button variant="outline" onClick={onBack} type="button">
            Back to Dashboard
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div className={embedded ? '' : 'px-4 sm:px-6 lg:px-8'}>
      {/* Header - only show if not embedded */}
      {showHeader && (
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">
              Members ({filteredAndSortedMembers.length})
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
              disabled={filteredAndSortedMembers.length === 0}
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
        {filteredAndSortedMembers.length === 0 ? (
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
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a5 5 0 11-5 5 5 5 0 015-5z"
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
        ) : isMobile ? (
          // Mobile: Card layout
          <ComprehensiveMemberTable
            members={filteredAndSortedMembers}
            onMemberClick={handleMemberClick}
            showFilters={true}
          />
        ) : (
          // Desktop: Use shared comprehensive table component
          <ComprehensiveMemberTable
            members={filteredAndSortedMembers}
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
