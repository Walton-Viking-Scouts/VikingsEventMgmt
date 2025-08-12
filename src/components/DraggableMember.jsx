import React, { useState } from "react";

// Constants for draggable member types
const DRAGGABLE_MEMBER_TYPES = ["Young People"];

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
  className = "",
}) {
  const [dragPreview, setDragPreview] = useState(false);
  const [mouseDown, setMouseDown] = useState(false);

  // Only specific member types can be dragged between groups
  const isDraggable =
    DRAGGABLE_MEMBER_TYPES.includes(member.person_type) && !disabled;

  const handleMouseDown = (_e) => {
    if (!isDraggable) return;
    setMouseDown(true);
  };

  const handleMouseUp = (_e) => {
    setMouseDown(false);
  };

  const handleDragStart = (e) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }

    // Set drag data
    const dragData = {
      memberId: member.scoutid,
      memberName: `${member.firstname} ${member.lastname}`,
      fromGroupNumber: group?.number || "Unknown",
      fromGroupName: group?.name || "Unknown Group",
      member: member,
    };

    try {
      e.dataTransfer.setData("application/json", JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = "move";

      // Visual feedback
      setDragPreview(true);

      // Notify parent
      if (onDragStart) {
        onDragStart(dragData);
      }
    } catch (error) {
      // Prevent drag operation if data setup fails
      e.preventDefault();
    }
  };

  const handleDragEnd = () => {
    setDragPreview(false);
    setMouseDown(false); // Reset mouseDown state to clear grabbing style

    // Notify parent
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const handleMemberClick = (e) => {
    // Don't trigger click during drag operations or drag preview
    if (isDragging || dragPreview) {
      e.preventDefault();
      return;
    }

    // Ensure click only fires on the actual name span, not drag handle
    if (onMemberClick && typeof onMemberClick === "function") {
      onMemberClick(member);
    }
  };

  const memberName = `${member.firstname} ${member.lastname}`;

  return (
    <div
      className={`
        flex items-center justify-between p-3 rounded-lg transition-all duration-200 select-none
        ${
          isDraggable
            ? "cursor-grab active:cursor-grabbing hover:bg-blue-50 hover:border-blue-300 border-2 border-blue-100 bg-blue-25 hover:shadow-md transform hover:scale-[1.02]"
            : "cursor-default bg-gray-50 border-2 border-gray-200"
        }
        ${mouseDown ? "cursor-grabbing scale-[1.01] shadow-lg" : ""}
        ${dragPreview ? "opacity-60 transform rotate-1 scale-95 shadow-xl" : ""}
        ${isDragging ? "opacity-40" : ""}
        ${className}
      `}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={(e) => {
        if (isDraggable) {
          e.preventDefault(); // Prevent context menu on long press
          setMouseDown(true);
        }
      }}
      onTouchEnd={(_e) => {
        if (isDraggable) {
          setMouseDown(false);
        }
      }}
      style={{
        touchAction: isDraggable ? "none" : "auto",
        userSelect: "none",
        WebkitUserSelect: "none",
        msUserSelect: "none",
        MozUserSelect: "none",
      }}
      title={isDraggable ? `Drag ${memberName} to another group` : memberName}
      data-draggable={isDraggable}
      data-member-id={member.scoutid}
      data-member-name={memberName}
    >
      <div className="flex-1" onClick={handleMemberClick}>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium ${
              isDraggable ? "text-blue-700" : "text-gray-700"
            } ${
              onMemberClick
                ? "cursor-pointer hover:text-scout-blue hover:underline"
                : ""
            }`}
          >
            {memberName}
          </span>
        </div>

        {/* Show Viking Event Management fields if available */}
        <div className="text-xs text-gray-500 mt-1 space-y-1">
          {member.SignedInBy && <div>Signed in by: {member.SignedInBy}</div>}
          {member.SignedInWhen && (
            <div>
              Signed in: {new Date(member.SignedInWhen).toLocaleString()}
            </div>
          )}
          {member.SignedOutBy && <div>Signed out by: {member.SignedOutBy}</div>}
          {member.SignedOutWhen && (
            <div>
              Signed out: {new Date(member.SignedOutWhen).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Drag handle indicator for draggable members */}
      {isDraggable && (
        <div
          className="ml-2 flex items-center text-blue-500 hover:text-blue-700 transition-colors cursor-grab flex-shrink-0"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ touchAction: "none" }}
          title="Drag to move"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="4" cy="4" r="1.2" />
            <circle cx="12" cy="4" r="1.2" />
            <circle cx="4" cy="8" r="1.2" />
            <circle cx="12" cy="8" r="1.2" />
            <circle cx="4" cy="12" r="1.2" />
            <circle cx="12" cy="12" r="1.2" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default DraggableMember;
