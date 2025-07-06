import React, { useState, useEffect, useMemo } from 'react';
import { getListOfMembers } from '../services/api.js';
import { getToken } from '../services/auth.js';
import { Button, Card, Input, Alert, Badge } from './ui';
import LoadingScreen from './LoadingScreen.jsx';
import { isMobileLayout } from '../utils/platform.js';

function MembersList({ sections, onBack }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('lastname');
  const [sortDirection, setSortDirection] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    sections: true,
    email: true,
    phone: true,
    patrol: true,
    rank: true,
    age: true,
  });

  const isMobile = isMobileLayout();
  const sectionIds = sections.map(s => s.sectionid);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = getToken();
        const members = await getListOfMembers(sections, token);
        setMembers(members);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sections]);

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return '';
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch {
      return '';
    }
  };

  // Filter and sort members
  const filteredAndSortedMembers = useMemo(() => {
    const filtered = members.filter(member => {
      const searchLower = searchTerm.toLowerCase();
      const fullName = `${member.firstname || ''} ${member.lastname || ''}`.toLowerCase();
      const email = (member.email || '').toLowerCase();
      const sectionsText = (member.sections || []).join(' ').toLowerCase();
      
      return fullName.includes(searchLower) || 
             email.includes(searchLower) || 
             sectionsText.includes(searchLower);
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

  const handleSort = (field) => {
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

    // Define CSV headers
    const headers = [
      'First Name',
      'Last Name', 
      'Email',
      'Phone',
      'Sections',
      'Patrol',
      'Rank',
      'Age',
      'Date of Birth',
      'Gender',
      'Address',
      'Postcode',
      'Emergency Contact Name',
      'Emergency Contact Phone',
      'Medical Notes',
      'Dietary Requirements',
    ];

    // Convert members to CSV rows
    const csvRows = [
      headers.join(','),
      ...filteredAndSortedMembers.map(member => [
        `"${member.firstname || ''}"`,
        `"${member.lastname || ''}"`,
        `"${member.email || ''}"`,
        `"${member.phone || ''}"`,
        `"${(member.sections || []).join('; ')}"`,
        `"${member.patrol || ''}"`,
        `"${member.rank || ''}"`,
        `"${calculateAge(member.date_of_birth)}"`,
        `"${member.date_of_birth || ''}"`,
        `"${member.gender || ''}"`,
        `"${member.address || ''}"`,
        `"${member.postcode || ''}"`,
        `"${member.emergency_contact_name || ''}"`,
        `"${member.emergency_contact_phone || ''}"`,
        `"${member.medical_notes || ''}"`,
        `"${member.dietary_requirements || ''}"`,
      ].join(',')),
    ];

    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `members_${sectionIds.join('_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <span className="text-gray-300">↕</span>;
    }
    return (
      <span className="text-scout-blue">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
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
          <Button variant="scout-blue" onClick={async () => {
            await load();
          }} type="button">
            Retry
          </Button>
          <Button variant="outline" onClick={onBack} type="button">
            Back to Events
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">
            Members ({filteredAndSortedMembers.length})
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Members from selected sections: {sections.map(s => s.sectionname).join(', ')}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3">
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={filteredAndSortedMembers.length === 0}
            type="button"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </Button>
          <Button variant="outline" onClick={onBack} type="button">
            Back to Events
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search members by name, email, or section..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        
        {/* Column visibility toggle for desktop */}
        {!isMobile && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(visibleColumns).map(([column, visible]) => (
              <Button
                key={column}
                variant={visible ? 'scout-blue' : 'outline'}
                size="sm"
                onClick={() => setVisibleColumns(prev => ({ ...prev, [column]: !visible }))}
                type="button"
              >
                {column}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Members table/cards */}
      <div className="mt-6">
        {filteredAndSortedMembers.length === 0 ? (
          <Card>
            <Card.Body className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a5 5 0 11-5 5 5 5 0 015-5z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No members found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm ? 'Try adjusting your search terms.' : 'No members available for the selected sections.'}
              </p>
            </Card.Body>
          </Card>
        ) : isMobile ? (
          // Mobile: Card layout
          <div className="space-y-4">
            {filteredAndSortedMembers.map((member) => (
              <Card key={member.scoutid}>
                <Card.Body>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {member.firstname} {member.lastname}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(member.sections || []).map((section, idx) => (
                          <Badge key={idx} variant="scout-blue" size="sm">
                            {section}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {calculateAge(member.date_of_birth) && (
                      <Badge variant="secondary">
                        Age {calculateAge(member.date_of_birth)}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="mt-3 space-y-1 text-sm text-gray-600">
                    {member.email && (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                        </svg>
                        {member.email}
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                        </svg>
                        {member.phone}
                      </div>
                    )}
                    {(member.patrol || member.rank) && (
                      <div className="flex items-center space-x-4">
                        {member.patrol && <span>Patrol: {member.patrol}</span>}
                        {member.rank && <span>Rank: {member.rank}</span>}
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        ) : (
          // Desktop: Table layout
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    {visibleColumns.name && (
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Name</span>
                          <SortIcon field="name" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.sections && (
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('sections')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Sections</span>
                          <SortIcon field="sections" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.email && (
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('email')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Email</span>
                          <SortIcon field="email" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.phone && (
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('phone')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Phone</span>
                          <SortIcon field="phone" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.patrol && (
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('patrol')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Patrol</span>
                          <SortIcon field="patrol" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.rank && (
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('rank')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Rank</span>
                          <SortIcon field="rank" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.age && (
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('age')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Age</span>
                          <SortIcon field="age" />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedMembers.map((member) => (
                    <tr key={member.scoutid} className="hover:bg-gray-50">
                      {visibleColumns.name && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {member.firstname} {member.lastname}
                          </div>
                        </td>
                      )}
                      {visibleColumns.sections && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {(member.sections || []).map((section, idx) => (
                              <Badge key={idx} variant="scout-blue" size="sm">
                                {section}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      )}
                      {visibleColumns.email && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {member.email}
                        </td>
                      )}
                      {visibleColumns.phone && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {member.phone}
                        </td>
                      )}
                      {visibleColumns.patrol && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {member.patrol}
                        </td>
                      )}
                      {visibleColumns.rank && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {member.rank}
                        </td>
                      )}
                      {visibleColumns.age && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {calculateAge(member.date_of_birth)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default MembersList;