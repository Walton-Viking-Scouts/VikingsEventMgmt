import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Badge } from '../../../shared/components/ui';
import DraggableMember from './DraggableMember.jsx';

/**
 * CampGroupCard - Individual card component for displaying camp group members
 * Shows group name, leaders/young leaders in header, young people in body
 * Enhanced with drag & drop functionality for moving members between groups
 * 
 * Error Handling Contract:
 * - onMemberMove callback handles all auth/network failures with user-facing error messages
 * - Provides contextual error information including from/to group details
 * - Implements optimistic UI updates with rollback on failure
 * - Uses toast notifications for consistent error UX across the application
 * 
 * @param {Object} props - Component props
 * @param {Object} props.group - Group data with name, leaders, youngPeople arrays
 * @param {Function} props.onMemberClick - Optional callback when member is clicked
 * @param {Function} props.onMemberMove - Callback when a member is dropped into this group
 *   Expected to handle failures gracefully with user notifications and state rollback
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
  const cardRef = useRef(null);

  const { name, leaders = [], youngPeople = [] } = group || {};

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
        const dragData = JSON.parse(
          e.dataTransfer.getData('application/json') || '{}',
        );
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

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    setCanDrop(false);
    // Don't process drops if dragging is disabled
    if (dragDisabled) {
      return;
    }
    if (!onMemberMove) {
      return;
    }
    
    let dragData;
    try {
      // Handle both desktop drag/drop and mobile touch drop
      if (e.type === 'mobile-drop') {
        dragData = e.detail;
      } else {
        dragData = JSON.parse(e.dataTransfer.getData('application/json'));
      }


      // Don't allow dropping on the same group
      if (String(dragData.fromGroupNumber) === String(group.number)) {
        return;
      }

      // Note: We proceed with the move and let the API handler deal with auth/network issues
      // This allows for proper error handling and user feedback through the onMemberMove callback
      // Since only Young People are displayed and draggable (per DRAGGABLE_MEMBER_TYPES),
      // we can safely create a member object with person_type: 'Young People'
      // Prefer dragData.member when available (complete object from drag source)
      let member;
      if (dragData.member) {
        // Use complete member object from drag data
        member = dragData.member;
      } else {
        // Fall back to constructing minimal object from dragData fields
        member = {
          scoutid: dragData.memberId,
          name: dragData.memberName,
          person_type: 'Young People',
          sectionid: dragData.sectionid,
        };
        
        // Last resort: lookup in drop target group for missing fields (may not find anything)
        const originalMember = [...(group.youngPeople || [])].find(m => 
          String(m.scoutid) === String(dragData.memberId),
        );
        if (originalMember) {
          member = { ...member, ...originalMember };
        }
      }
      
      // TODO: Ensure DraggableMember emits a full member object on mobile drags 
      // so dragData.member is provided to the drop handler


      // Call the move handler
      onMemberMove({
        member: member,
        fromGroupNumber: dragData.fromGroupNumber,
        fromGroupName: dragData.fromGroupName,
        toGroupNumber: group.number,
        toGroupName: group.name,
      });
    } catch (error) {
      // Silently ignore malformed drag data - validation happens during drop
    }
  }, [dragDisabled, onMemberMove, group]);

  // Add mobile drop event listener
  useEffect(() => {
    const cardElement = cardRef.current;
    if (!cardElement) return;

    const handleMobileDrop = (e) => {
      handleDrop(e);
    };

    cardElement.addEventListener('mobile-drop', handleMobileDrop);
    
    return () => {
      cardElement.removeEventListener('mobile-drop', handleMobileDrop);
    };
  }, [handleDrop]);

  if (!group) {
    return null;
  }

  const MemberName = ({ member }) => (
    <span
      className={`text-sm break-words ${
        member.SignedOutBy || member.SignedOutWhen || member.vikingEventData?.SignedOutBy || member.vikingEventData?.SignedOutWhen ? 'text-gray-400' : ''
      } ${onMemberClick ? 'cursor-pointer hover:text-scout-blue hover:underline' : ''}`}
      onClick={() => handleMemberClick(member)}
      title={`${member.firstname} ${member.lastname}`}
    >
      {member.firstname} {member.lastname}
    </span>
  );


  return (
    <Card
      ref={cardRef}
      className={`
        camp-group-card transition-all duration-200 w-full
        ${isDragInProgress ? 'drop-zone-available' : ''}
        ${isDragOver && canDrop ? 'bg-scout-blue/10 border-scout-blue border-2 shadow-lg' : ''}
        ${isDragOver && !canDrop ? 'bg-red-50 border-red-300 border-2' : ''}
        ${className}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-drop-zone="true"
      data-group-number={group.number}
    >
      {/* Header with group name and leaders */}
      <Card.Header className="pb-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 break-words whitespace-normal">
              {name} <span className="text-base font-medium text-gray-600">({youngPeople.length})</span>
            </h3>
          </div>
        </div>

        {/* Leaders section */}
        {leaders.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1 mb-1">
              <svg
                className="w-3 h-3 text-scout-purple"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs font-medium text-gray-700">
                Leaders ({leaders.length})
              </span>
            </div>

            <div className="space-y-1">
              {leaders.map((leader) => (
                <div key={leader.scoutid} className="flex items-center gap-1">
                  <Badge
                    variant={
                      leader.person_type === 'Leaders'
                        ? 'scout-purple'
                        : 'scout-blue'
                    }
                    size="sm"
                    className="flex-shrink-0"
                  >
                    {leader.person_type === 'Leaders' ? 'L' : 'YL'}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <MemberName member={leader} />
                  </div>
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
            <div className="flex items-center gap-1 mb-2">
              <svg
                className="w-3 h-3 text-scout-green"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs font-medium text-gray-700">
                Young People ({youngPeople.length})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {youngPeople.map((youngPerson) => (
                <DraggableMember
                  key={youngPerson.scoutid}
                  member={youngPerson}
                  group={group}
                  onMemberClick={handleMemberClick}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  isDragging={
                    String(draggingMemberId) === String(youngPerson.scoutid)
                  }
                  disabled={dragDisabled}
                />
              ))}
            </div>
          </div>
        ) : (
          <div
            className={`
            text-center py-4 text-gray-500 transition-all
            ${isDragInProgress ? 'py-8 border-2 border-dashed border-gray-300 bg-gray-50/50 rounded-lg' : ''}
          `}
          >
            <svg
              className="mx-auto h-8 w-8 text-gray-400 mb-2"
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
            <p className="text-sm">
              {isDragInProgress
                ? 'Drop member here'
                : 'No young people assigned'}
            </p>
          </div>
        )}
      </Card.Body>

      {/* Footer with additional info if needed */}
      {leaders.length === 0 && youngPeople.length === 0 && (
        <Card.Footer className="text-center text-gray-500 text-sm">
          No members assigned to this group
        </Card.Footer>
      )}
    </Card>
  );
}

export default CampGroupCard;
