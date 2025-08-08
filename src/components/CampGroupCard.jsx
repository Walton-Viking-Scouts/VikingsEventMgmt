import React, { useState } from 'react';
import { Card, Badge } from './ui';
import DraggableMember from './DraggableMember.jsx';

/**
 * CampGroupCard - Individual card component for displaying camp group members
 * Shows group name, leaders/young leaders in header, young people in body
 * Enhanced with drag & drop functionality for moving members between groups
 * 
 * @param {Object} props - Component props
 * @param {Object} props.group - Group data with name, leaders, youngPeople arrays
 * @param {Function} props.onMemberClick - Optional callback when member is clicked
 * @param {Function} props.onMemberMove - Callback when a member is dropped into this group
 * @param {Function} props.onDragStart - Callback when drag operation starts from this group
 * @param {Function} props.onDragEnd - Callback when drag operation ends
 * @param {boolean} props.isDragInProgress - Whether any drag operation is in progress
 * @param {string} props.draggingMemberId - ID of member currently being dragged
 * @param {boolean} props.dragDisabled - Whether drag & drop functionality is disabled
 * @param {string} props.className - Additional CSS classes
 */
function CampGroupCard({ 
  group, 
  onMemberClick, 
  onMemberMove,
  onDragStart,
  onDragEnd,
  isDragInProgress = false,
  draggingMemberId = null,
  dragDisabled = false,
  className = '',
}) {
  // Drop zone state
  const [isDragOver, setIsDragOver] = useState(false);
  const [canDrop, setCanDrop] = useState(false);

  if (!group) {
    return null;
  }

  const { name, number, leaders = [], youngPeople = [] } = group;

  const handleMemberClick = (member) => {
    if (onMemberClick && typeof onMemberClick === 'function') {
      onMemberClick(member);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault(); // Allow drop
    
    if (!isDragOver) {
      setIsDragOver(true);
    }
    
    // Check if drop is acceptable to show correct visual feedback
    let acceptable = false;
    if (!dragDisabled) {
      try {
        const dragData = JSON.parse(e.dataTransfer.getData('application/json') || '{}');
        // Don't allow dropping on the same group
        acceptable = String(dragData.fromGroupNumber) !== String(group.number);
      } catch (_) {
        // If we can't parse drag data, assume it's acceptable for visual feedback
        acceptable = true;
      }
    }
    
    setCanDrop(acceptable);
    e.dataTransfer.dropEffect = acceptable ? 'move' : 'none';
  };

  const handleDragLeave = (e) => {
    // Only clear if we're actually leaving the drop zone
    // (not just moving to a child element)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
      setCanDrop(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    setCanDrop(false);
    
    if (!onMemberMove) {
      return;
    }
    
    try {
      const dragData = JSON.parse(e.dataTransfer.getData('application/json'));
      
      // Don't allow dropping on the same group
      if (String(dragData.fromGroupNumber) === String(group.number)) {
        return;
      }
      
      // Call the move handler
      onMemberMove({
        member: dragData.member,
        fromGroupNumber: dragData.fromGroupNumber,
        fromGroupName: dragData.fromGroupName,
        toGroupNumber: group.number,
        toGroupName: group.name,
      });
      
    } catch (error) {
      console.error('Error processing drop:', error);
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
    <Card 
      className={`
        camp-group-card transition-all duration-200
        ${isDragInProgress ? 'drop-zone-available' : ''}
        ${isDragOver && canDrop ? 'bg-scout-blue/10 border-scout-blue border-2 shadow-lg' : ''}
        ${isDragOver && !canDrop ? 'bg-red-50 border-red-300 border-2' : ''}
        ${className}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
                <DraggableMember
                  key={youngPerson.scoutid}
                  member={youngPerson}
                  group={group}
                  onMemberClick={handleMemberClick}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  isDragging={draggingMemberId === youngPerson.scoutid}
                  disabled={dragDisabled}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className={`
            text-center py-4 text-gray-500 transition-all
            ${isDragInProgress ? 'py-8 border-2 border-dashed border-gray-300 bg-gray-50/50 rounded-lg' : ''}
          `}>
            <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a5 5 0 11-5 5 5 5 0 015-5z" />
            </svg>
            <p className="text-sm">
              {isDragInProgress ? 'Drop member here' : 'No young people assigned'}
            </p>
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