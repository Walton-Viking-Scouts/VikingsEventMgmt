import React, { useState } from 'react';
import { Badge } from './ui';

/**
 * DraggableMember - Wrapper component that makes members draggable between camp groups
 * 
 * @param {Object} props - Component props
 * @param {Object} props.member - Member data (scoutid, firstname, lastname, etc.)
 * @param {Object} props.group - Current group this member belongs to
 * @param {Function} props.onMemberClick - Optional callback when member is clicked
 * @param {Function} props.onDragStart - Callback when drag operation starts
 * @param {Function} props.onDragEnd - Callback when drag operation ends
 * @param {boolean} props.isDragging - Whether this member is currently being dragged
 * @param {boolean} props.disabled - Whether dragging is disabled
 * @param {string} props.className - Additional CSS classes
 */
function DraggableMember({ 
  member, 
  group, 
  onMemberClick,
  onDragStart,
  onDragEnd,
  isDragging = false,
  disabled = false,
  className = '',
}) {
  const [dragPreview, setDragPreview] = useState(false);

  // Only Young People can be dragged between groups
  const isDraggable = member.person_type === 'Young People' && !disabled;

  const handleDragStart = (e) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }

    // Set drag data
    const dragData = {
      memberId: member.scoutid,
      memberName: `${member.firstname} ${member.lastname}`,
      fromGroupNumber: group.number,
      fromGroupName: group.name,
      member: member,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    
    // Visual feedback
    setDragPreview(true);
    
    // Notify parent
    if (onDragStart) {
      onDragStart(dragData);
    }
  };

  const handleDragEnd = () => {
    setDragPreview(false);
    
    // Notify parent
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const handleMemberClick = (e) => {
    // Don't trigger click during drag operations
    if (isDragging) {
      e.preventDefault();
      return;
    }
    
    if (onMemberClick && typeof onMemberClick === 'function') {
      onMemberClick(member);
    }
  };

  const memberName = `${member.firstname} ${member.lastname}`;

  return (
    <div 
      className={`
        flex items-center justify-between p-2 bg-gray-50 rounded-md transition-all
        ${isDraggable ? 'cursor-move hover:bg-gray-100' : 'cursor-default'}
        ${dragPreview ? 'opacity-50 transform rotate-1 scale-95' : ''}
        ${isDragging ? 'opacity-30' : ''}
        ${className}
      `}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={isDraggable ? `Drag ${memberName} to another group` : memberName}
    >
      <div className="flex-1">
        <span 
          className={`text-sm ${onMemberClick ? 'cursor-pointer hover:text-scout-blue hover:underline' : ''}`}
          onClick={handleMemberClick}
        >
          {memberName}
        </span>
        
        {/* Show Viking Event Management fields if available */}
        <div className="text-xs text-gray-500 mt-1 space-y-1">
          {member.SignedInBy && (
            <div>Signed in by: {member.SignedInBy}</div>
          )}
          {member.SignedInWhen && (
            <div>Signed in: {new Date(member.SignedInWhen).toLocaleString()}</div>
          )}
          {member.SignedOutBy && (
            <div>Signed out by: {member.SignedOutBy}</div>
          )}
          {member.SignedOutWhen && (
            <div>Signed out: {new Date(member.SignedOutWhen).toLocaleString()}</div>
          )}
        </div>
      </div>
      
      {/* Drag handle indicator for draggable members */}
      {isDraggable && (
        <div className="ml-2 text-gray-400 hover:text-gray-600">
          <svg 
            className="w-4 h-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 9l4-4 4 4M8 15l4 4 4-4" 
            />
          </svg>
        </div>
      )}
      
      {/* Show attendance status if available */}
      {member.attending !== undefined && (
        <Badge 
          variant={member.attending === 'Yes' ? 'success' : 
            member.attending === 'No' ? 'danger' : 'secondary'} 
          size="xs"
          className="ml-2"
        >
          {member.attending === 'Yes' ? '✓' : 
            member.attending === 'No' ? '✗' : '?'}
        </Badge>
      )}
    </div>
  );
}

export default DraggableMember;