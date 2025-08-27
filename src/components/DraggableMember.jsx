import React, { useState, useRef, useEffect } from "react";

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
  const [touchDragActive, setTouchDragActive] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const elementRef = useRef(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const dragThreshold = 10; // pixels to start drag
  const pressHoldTimer = useRef(null);
  const [isPressHolding, setIsPressHolding] = useState(false);
  const PRESS_HOLD_DELAY = 200; // ms to hold before drag starts

  // Compute member name once (DRY principle)
  // Debug: Check different name field possibilities
  const memberName =
    member.name ||
    member.displayName ||
    `${member.firstname || member.first_name || ""} ${member.lastname || member.last_name || ""}`.trim() ||
    "Unknown Member";

  // Only specific member types can be dragged between groups
  const isDraggable =
    DRAGGABLE_MEMBER_TYPES.includes(member.person_type) && !disabled;

  // Mobile drag simulation using touch events
  useEffect(() => {
    const element = elementRef.current;
    if (!element || !isDraggable) return;

    const clearPressHoldTimer = () => {
      if (pressHoldTimer.current) {
        clearTimeout(pressHoldTimer.current);
        pressHoldTimer.current = null;
      }
    };

    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };

      // Start press-and-hold timer
      pressHoldTimer.current = setTimeout(() => {
        // Enter drag mode after delay
        setIsPressHolding(true);
        setMouseDown(true);
        setTouchDragActive(true);
        setDragPreview(true);

        // Provide haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        if (onDragStart) {
          const dragData = {
            memberId: member.scoutid,
            memberName: memberName,
            fromGroupNumber: group?.number || "Unknown",
            fromGroupName: group?.name || "Unknown Group",
            sectionid: member.sectionid || member.section_id,
          };
          onDragStart(dragData);
        }
      }, PRESS_HOLD_DELAY);

      // DON'T prevent default - allow scrolling until drag mode starts
    };

    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartPos.current.x;
      const deltaY = touch.clientY - touchStartPos.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // If user moves before press-hold timer expires, cancel drag and allow scroll
      if (pressHoldTimer.current && distance > dragThreshold) {
        clearPressHoldTimer();
        setIsPressHolding(false);
        return; // Let browser handle scroll
      }

      // If we're in drag mode, handle the drag
      if (touchDragActive && isPressHolding) {
        e.preventDefault(); // NOW prevent scrolling during drag

        // Update drag position to follow finger
        setDragPosition({
          x: touch.clientX,
          y: touch.clientY,
        });
      }
    };

    const handleTouchEnd = (e) => {
      clearPressHoldTimer();

      if (touchDragActive && isPressHolding) {
        // Handle drop
        const touch = e.changedTouches[0];
        const elementBelow = document.elementFromPoint(
          touch.clientX,
          touch.clientY,
        );

        if (elementBelow) {
          // Look for drop zone in element hierarchy
          let dropZone = elementBelow;
          while (dropZone && !dropZone.dataset.dropZone) {
            dropZone = dropZone.parentElement;
          }

          if (dropZone) {
            // Create synthetic drop event
            const dropEventData = {
              memberId: member.scoutid,
              memberName: memberName,
              fromGroupNumber: group?.number || "Unknown",
              fromGroupName: group?.name || "Unknown Group",
              sectionid: member.sectionid || member.section_id,
              targetGroupNumber: Number(dropZone.dataset.groupNumber),
            };

            const dropEvent = new window.CustomEvent("mobile-drop", {
              detail: dropEventData,
              bubbles: true,
              cancelable: true,
              composed: true,
            });
            dropZone.dispatchEvent(dropEvent);
          }
        }
      }

      // Reset all state
      setMouseDown(false);
      setTouchDragActive(false);
      setDragPreview(false);
      setIsPressHolding(false);
      setDragPosition({ x: 0, y: 0 });

      if (touchDragActive && onDragEnd) {
        onDragEnd();
      }
    };

    const handleTouchCancel = () => {
      clearPressHoldTimer();
      setMouseDown(false);
      setTouchDragActive(false);
      setDragPreview(false);
      setIsPressHolding(false);
      setDragPosition({ x: 0, y: 0 });

      if (touchDragActive && onDragEnd) {
        onDragEnd();
      }
    };

    // Add non-passive listeners so we can preventDefault during drag
    element.addEventListener("touchstart", handleTouchStart, { passive: true }); // Start is passive to allow scrolling initially
    element.addEventListener("touchmove", handleTouchMove, { passive: false }); // Move needs to preventDefault during drag
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    element.addEventListener("touchcancel", handleTouchCancel, {
      passive: true,
    });

    return () => {
      clearPressHoldTimer();
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [
    isDraggable,
    member,
    group,
    onDragStart,
    onDragEnd,
    memberName,
    touchDragActive,
    isPressHolding,
  ]);

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
      memberName: memberName,
      fromGroupNumber: group?.number || "Unknown",
      fromGroupName: group?.name || "Unknown Group",
      sectionid: member.sectionid || member.section_id,
    };

    // Debug logging for name issues
    if (!memberName || memberName === "Unknown Member") {
      console.warn("DraggableMember: Member name issue detected", {
        memberName,
        memberKeys: Object.keys(member),
        memberNameField: member.name,
        memberFirstname: member.firstname,
        memberLastname: member.lastname,
        memberFirstName: member.first_name,
        memberLastName: member.last_name,
        memberId: member.scoutid,
      });
    }

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

  return (
    <div
      ref={elementRef}
      className={`
        relative p-2 rounded-lg transition-all duration-200 select-none w-full max-w-full
        ${
          isDraggable
            ? "cursor-grab active:cursor-grabbing hover:bg-blue-50 hover:border-blue-300 border-2 border-blue-100 bg-blue-25 hover:shadow-md transform hover:scale-[1.02]"
            : "cursor-default bg-gray-50 border-2 border-gray-200"
        }
        ${mouseDown ? "cursor-grabbing scale-[1.01] shadow-lg" : ""}
        ${dragPreview ? "opacity-60 transform rotate-1 scale-95 shadow-xl" : ""}
        ${touchDragActive ? "opacity-30" : ""}
        ${isDragging ? "opacity-40" : ""}
        ${className}
      `}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        maxWidth: "100%",
        touchAction: isPressHolding && touchDragActive ? "none" : "auto",
        userSelect: "none",
        WebkitUserSelect: "none",
        msUserSelect: "none",
        MozUserSelect: "none",
      }}
      title={isDraggable ? `Drag ${memberName} to another group` : memberName}
      data-draggable={isDraggable}
      data-member-id={member.scoutid}
      data-oid="ucgn7:8"
    >
      {/* Drag handle indicator for draggable members - top corner */}
      {isDraggable && (
        <div
          className="absolute top-1 right-1 text-blue-500 hover:text-blue-700 transition-colors cursor-grab z-10"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            touchAction: isPressHolding && touchDragActive ? "none" : "auto",
          }}
          title="Drag to move"
          data-oid=":cvq5xq"
        >
          <svg
            className="w-3 h-3"
            fill="currentColor"
            viewBox="0 0 16 16"
            data-oid="k6l:a:4"
          >
            <circle cx="4" cy="4" r="1.2" data-oid=":g:oc_7" />
            <circle cx="12" cy="4" r="1.2" data-oid="4e9_xky" />
            <circle cx="4" cy="8" r="1.2" data-oid="hcfb5t:" />
            <circle cx="12" cy="8" r="1.2" data-oid="tjnm4r1" />
            <circle cx="4" cy="12" r="1.2" data-oid="hjr5his" />
            <circle cx="12" cy="12" r="1.2" data-oid=":z-kn2." />
          </svg>
        </div>
      )}

      <div
        className="w-full min-w-0"
        onClick={handleMemberClick}
        data-oid="t.tp5a1"
      >
        <div className="flex items-start gap-1 min-w-0" data-oid="n86m0in">
          <span
            className={`text-sm font-medium break-words leading-tight w-full max-w-full ${
              member.SignedOutBy ||
              member.SignedOutWhen ||
              member.vikingEventData?.SignedOutBy ||
              member.vikingEventData?.SignedOutWhen
                ? "text-gray-400"
                : isDraggable
                  ? "text-blue-700"
                  : "text-gray-700"
            } ${
              onMemberClick
                ? "cursor-pointer hover:text-scout-blue hover:underline"
                : ""
            }`}
            style={{
              maxWidth: "100%",
              wordWrap: "break-word",
              overflowWrap: "break-word",
              hyphens: "auto",
            }}
            data-oid="9ygqp4:"
          >
            {memberName}
          </span>
        </div>
      </div>

      {/* Mobile drag preview that follows finger */}
      {touchDragActive && (
        <div
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 opacity-80 scale-95 rotate-2 shadow-xl"
          style={{
            left: dragPosition.x,
            top: dragPosition.y,
            maxWidth: "200px",
          }}
          data-oid="98:y:aq"
        >
          <div
            className="p-2 rounded-lg bg-blue-100 border-2 border-blue-300 shadow-lg"
            data-oid="ejp4:g8"
          >
            <div className="flex items-center gap-1" data-oid="k-lhrm2">
              {/* Drag handle indicator */}
              <div className="text-blue-500" data-oid=":0qm52v">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                  data-oid="7:6irxr"
                >
                  <circle cx="4" cy="4" r="1.2" data-oid=".pjbcj_" />
                  <circle cx="12" cy="4" r="1.2" data-oid="q--om3:" />
                  <circle cx="4" cy="8" r="1.2" data-oid="065h4wm" />
                  <circle cx="12" cy="8" r="1.2" data-oid="p0c0v05" />
                  <circle cx="4" cy="12" r="1.2" data-oid="uaq1g13" />
                  <circle cx="12" cy="12" r="1.2" data-oid="7yas3:j" />
                </svg>
              </div>
              <span
                className="text-sm font-medium text-blue-700 truncate"
                data-oid=":7n_hkz"
              >
                {memberName}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DraggableMember;
