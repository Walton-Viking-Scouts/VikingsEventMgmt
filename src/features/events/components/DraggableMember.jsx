import React, { useState } from 'react';
import PropTypes from 'prop-types';

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
  const [touchStartTime, setTouchStartTime] = useState(null);
  const [touchStartPos, setTouchStartPos] = useState(null);
  const [isTouchDragging, setIsTouchDragging] = useState(false);

  const handleDragStart = (e) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    
    if (onDragStart) {
      onDragStart(e, member, group);
    }

    // Set drag data for drop handling
    const dragData = {
      memberId: member.scoutid,
      memberName: member.firstname + ' ' + member.lastname,
      fromGroupNumber: group.number,
      fromGroupName: group.name,
      member: member,
      sectionid: member.sectionid,
    };

    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (e) => {
    if (onDragEnd) {
      onDragEnd(e, member);
    }
  };

  const handleClick = (e) => {
    // Don't trigger click if we're dragging
    if (isTouchDragging) {
      e.preventDefault();
      return;
    }

    if (onMemberClick) {
      onMemberClick(member);
    }
  };

  // Touch handling for mobile drag and drop
  const handleTouchStart = (e) => {
    if (disabled) return;

    const touch = e.touches[0];
    setTouchStartTime(Date.now());
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    setIsTouchDragging(false);
  };

  const handleTouchMove = (e) => {
    if (disabled || !touchStartTime || !touchStartPos) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    const timeDelta = Date.now() - touchStartTime;

    // Start drag if we've moved far enough or held long enough
    if ((deltaX > 10 || deltaY > 10) || timeDelta > 500) {
      setIsTouchDragging(true);
      
      // Trigger drag start for touch
      if (onDragStart) {
        const fakeEvent = {
          type: 'touchdrag',
          dataTransfer: {
            setData: () => {},
            effectAllowed: 'move',
          },
        };
        onDragStart(fakeEvent, member, group);
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (disabled) return;

    if (isTouchDragging) {
      // Find drop target
      const touch = e.changedTouches[0];
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropZone = elementBelow?.closest('[data-drop-zone="true"]');
      
      if (dropZone) {
        const dragData = {
          memberId: member.scoutid,
          memberName: member.firstname + ' ' + member.lastname,
          fromGroupNumber: group.number,
          fromGroupName: group.name,
          member: member,
          sectionid: member.sectionid,
        };

        // Dispatch custom mobile-drop event
        const mobileDropEvent = new window.CustomEvent('mobile-drop', {
          detail: dragData,
        });
        dropZone.dispatchEvent(mobileDropEvent);
      }

      if (onDragEnd) {
        onDragEnd(e, member);
      }
    }

    // Reset touch state
    setTouchStartTime(null);
    setTouchStartPos(null);
    setIsTouchDragging(false);
  };

  // Determine if member is signed out (for greying)
  const isSignedOut = member.SignedOutBy || member.SignedOutWhen || 
                     member.vikingEventData?.SignedOutBy || member.vikingEventData?.SignedOutWhen;

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      className={`
        relative bg-white border border-gray-200 rounded p-2 transition-all duration-200
        ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
        ${isDragging ? 'opacity-50 transform scale-95 shadow-lg border-scout-blue bg-scout-blue/5' : 'hover:shadow-md hover:border-gray-300'}
        ${isTouchDragging ? 'opacity-75 transform scale-105 shadow-lg z-10' : ''}
        ${className}
      `}
      style={{
        touchAction: disabled ? 'auto' : 'none',
      }}
    >
      {/* Drag handle icon */}
      {!disabled && (
        <div className="absolute top-1 right-1 text-gray-400 hover:text-gray-600">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1zM15 16V4a1 1 0 00-1-1h-2a1 1 0 00-1 1v12a1 1 0 001 1h2a1 1 0 001-1zM19 20H5a1 1 0 01-1-1v-2a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1z" />
          </svg>
        </div>
      )}

      {/* Member info */}
      <div className={`text-sm font-medium transition-colors ${
        isSignedOut ? 'text-gray-400' : 'text-gray-900'
      }`}>
        {member.firstname} {member.lastname}
      </div>
      
      {/* Additional member info if available */}
      {member.patrol && (
        <div className="text-xs text-gray-500 mt-1">{member.patrol}</div>
      )}
      
      {/* Visual feedback for dragging */}
      {isDragging && (
        <div className="absolute inset-0 bg-scout-blue/20 rounded pointer-events-none" />
      )}
    </div>
  );
}

DraggableMember.propTypes = {
  member: PropTypes.shape({
    scoutid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    firstname: PropTypes.string,
    lastname: PropTypes.string,
    sectionid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    patrol: PropTypes.string,
    SignedOutBy: PropTypes.string,
    SignedOutWhen: PropTypes.string,
    vikingEventData: PropTypes.object,
  }).isRequired,
  group: PropTypes.shape({
    name: PropTypes.string,
    number: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
  onMemberClick: PropTypes.func,
  onDragStart: PropTypes.func,
  onDragEnd: PropTypes.func,
  isDragging: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default DraggableMember;