import React from 'react';
import { Card, Badge } from './ui';

/**
 * CampGroupCard - Individual card component for displaying camp group members
 * Shows group name, leaders/young leaders in header, young people in body
 * 
 * @param {Object} props - Component props
 * @param {Object} props.group - Group data with name, leaders, youngPeople arrays
 * @param {Function} props.onMemberClick - Optional callback when member is clicked
 * @param {string} props.className - Additional CSS classes
 */
function CampGroupCard({ group, onMemberClick, className = '' }) {
  if (!group) {
    return null;
  }

  const { name, number, leaders = [], youngPeople = [] } = group;

  const handleMemberClick = (member) => {
    if (onMemberClick && typeof onMemberClick === 'function') {
      onMemberClick(member);
    }
  };

  const MemberName = ({ member }) => (
    <span 
      className={`text-sm ${onMemberClick ? 'cursor-pointer hover:text-scout-blue hover:underline' : ''}`}
      onClick={() => handleMemberClick(member)}
      title={`${member.firstname} ${member.lastname}`}
    >
      {member.firstname} {member.lastname}
    </span>
  );

  return (
    <Card className={`camp-group-card ${className}`}>
      {/* Header with group name and leaders */}
      <Card.Header className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {name}
            </h3>
          </div>
          
          {/* Group number badge */}
          <Badge 
            variant={number === 'Unassigned' ? 'secondary' : 'scout-blue'} 
            size="sm"
          >
            {number === 'Unassigned' ? 'Unassigned' : `Group ${number}`}
          </Badge>
        </div>

        {/* Leaders section */}
        {leaders.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-scout-purple" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                Leaders ({leaders.length})
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {leaders.map((leader) => (
                <div key={leader.scoutid} className="flex items-center">
                  <Badge 
                    variant={leader.person_type === 'Leaders' ? 'scout-purple' : 'scout-blue'} 
                    size="sm"
                    className="mr-1"
                  >
                    {leader.person_type === 'Leaders' ? 'L' : 'YL'}
                  </Badge>
                  <MemberName member={leader} />
                </div>
              ))}
            </div>
          </div>
        )}
      </Card.Header>

      {/* Body with young people */}
      <Card.Body className="pt-0">
        {youngPeople.length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-scout-green" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                Young People ({youngPeople.length})
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {youngPeople.map((youngPerson) => (
                <div 
                  key={youngPerson.scoutid} 
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <MemberName member={youngPerson} />
                    
                    {/* Show Viking Event Management fields if available */}
                    <div className="text-xs text-gray-500 mt-1 space-y-1">
                      {youngPerson.SignedInBy && (
                        <div>Signed in by: {youngPerson.SignedInBy}</div>
                      )}
                      {youngPerson.SignedInWhen && (
                        <div>Signed in: {new Date(youngPerson.SignedInWhen).toLocaleString()}</div>
                      )}
                      {youngPerson.SignedOutBy && (
                        <div>Signed out by: {youngPerson.SignedOutBy}</div>
                      )}
                      {youngPerson.SignedOutWhen && (
                        <div>Signed out: {new Date(youngPerson.SignedOutWhen).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Show attendance status if available */}
                  {youngPerson.attending !== undefined && (
                    <Badge 
                      variant={youngPerson.attending === 'Yes' ? 'success' : 
                        youngPerson.attending === 'No' ? 'danger' : 'secondary'} 
                      size="xs"
                    >
                      {youngPerson.attending === 'Yes' ? '✓' : 
                        youngPerson.attending === 'No' ? '✗' : '?'}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a5 5 0 11-5 5 5 5 0 015-5z" />
            </svg>
            <p className="text-sm">No young people assigned</p>
          </div>
        )}
      </Card.Body>

      {/* Footer with additional info if needed */}
      {(leaders.length === 0 && youngPeople.length === 0) && (
        <Card.Footer className="text-center text-gray-500 text-sm">
          No members assigned to this group
        </Card.Footer>
      )}
    </Card>
  );
}

export default CampGroupCard;