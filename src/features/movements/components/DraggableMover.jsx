import React, { useState, useRef, useEffect } from 'react';

function DraggableMover({
  mover,
  onDragStart,
  onDragEnd,
  isDragging = false,
  disabled = false,
  className = '',
}) {
  const [dragPreview, setDragPreview] = useState(false);
  const [mouseDown, setMouseDown] = useState(false);
  const [touchDragActive, setTouchDragActive] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const elementRef = useRef(null);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const dragThreshold = 10;
  const pressHoldTimer = useRef(null);
  const [isPressHolding, setIsPressHolding] = useState(false);
  const PRESS_HOLD_DELAY = 200;

  const isDraggable = !disabled && !mover.assignedSection;

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

      pressHoldTimer.current = setTimeout(() => {
        setIsPressHolding(true);
        setMouseDown(true);
        setTouchDragActive(true);
        setDragPreview(true);

        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        if (onDragStart) {
          const dragData = {
            moverId: mover.memberId,
            moverName: mover.name,
            currentSection: mover.currentSection,
            currentSectionId: mover.currentSectionId,
            targetSection: mover.targetSection,
            age: mover.age,
            termType: 'assignment',
          };
          onDragStart(dragData);
        }
      }, PRESS_HOLD_DELAY);
    };

    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartPos.current.x;
      const deltaY = touch.clientY - touchStartPos.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (pressHoldTimer.current && distance > dragThreshold) {
        clearPressHoldTimer();
        setIsPressHolding(false);
        return;
      }

      if (touchDragActive && isPressHolding) {
        e.preventDefault();
        setDragPosition({
          x: touch.clientX,
          y: touch.clientY,
        });
      }
    };

    const handleTouchEnd = (e) => {
      clearPressHoldTimer();

      if (touchDragActive && isPressHolding) {
        const touch = e.changedTouches[0];
        const elementBelow = document.elementFromPoint(
          touch.clientX,
          touch.clientY,
        );

        if (elementBelow) {
          let dropZone = elementBelow;
          while (dropZone && !dropZone.dataset.sectionDropZone) {
            dropZone = dropZone.parentElement;
          }

          if (dropZone) {
            const dropEventData = {
              moverId: mover.memberId,
              moverName: mover.name,
              currentSection: mover.currentSection,
              currentSectionId: mover.currentSectionId,
              targetSection: mover.targetSection,
              age: mover.age,
              targetSectionId: dropZone.dataset.sectionId,
              targetSectionName: dropZone.dataset.sectionName,
            };

            const dropEvent = new window.CustomEvent('section-assignment-drop', {
              detail: dropEventData,
              bubbles: true,
              cancelable: true,
              composed: true,
            });
            dropZone.dispatchEvent(dropEvent);
          }
        }
      }

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

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      clearPressHoldTimer();
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [isDraggable, mover, onDragStart, onDragEnd, touchDragActive, isPressHolding]);

  const handleMouseDown = () => {
    if (!isDraggable) return;
    setMouseDown(true);
  };

  const handleMouseUp = () => {
    setMouseDown(false);
  };

  const handleDragStart = (e) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }

    const dragData = {
      moverId: mover.memberId,
      moverName: mover.name,
      currentSection: mover.currentSection,
      currentSectionId: mover.currentSectionId,
      targetSection: mover.targetSection,
      age: mover.age,
      termType: 'assignment',
    };

    try {
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'move';
      setDragPreview(true);

      if (onDragStart) {
        onDragStart(dragData);
      }
    } catch (error) {
      e.preventDefault();
    }
  };

  const handleDragEnd = () => {
    setDragPreview(false);
    setMouseDown(false);

    if (onDragEnd) {
      onDragEnd();
    }
  };

  const isAssigned = !!mover.assignedSection;

  return (
    <div
      ref={elementRef}
      className={`
        relative p-3 rounded-lg transition-all duration-200 select-none w-full
        ${isDraggable
      ? 'cursor-grab active:cursor-grabbing hover:bg-blue-50 hover:border-blue-300 border-2 border-blue-100 bg-blue-25 hover:shadow-md transform hover:scale-[1.02]'
      : isAssigned
        ? 'cursor-default bg-green-50 border-2 border-green-200'
        : 'cursor-default bg-gray-50 border-2 border-gray-200'
    }
        ${mouseDown ? 'cursor-grabbing scale-[1.01] shadow-lg' : ''}
        ${dragPreview ? 'opacity-60 transform rotate-1 scale-95 shadow-xl' : ''}
        ${touchDragActive ? 'opacity-30' : ''}
        ${isDragging ? 'opacity-40' : ''}
        ${className}
      `}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{
        touchAction: isPressHolding && touchDragActive ? 'none' : 'auto',
        userSelect: 'none',
      }}
      title={isDraggable ? `Drag ${mover.name} to assign to a section` : mover.name}
      data-draggable={isDraggable}
      data-mover-id={mover.memberId}
    >
      {isDraggable && (
        <div className="absolute top-1 right-1 text-blue-500 hover:text-blue-700 transition-colors cursor-grab z-10">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="4" cy="4" r="1.2" />
            <circle cx="12" cy="4" r="1.2" />
            <circle cx="4" cy="8" r="1.2" />
            <circle cx="12" cy="8" r="1.2" />
            <circle cx="4" cy="12" r="1.2" />
            <circle cx="12" cy="12" r="1.2" />
          </svg>
        </div>
      )}

      <div className="w-full min-w-0">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm text-gray-900 truncate">
              {mover.name}
            </div>
            <div className="text-xs text-gray-500">
              Age {mover.age?.toFixed(1)} • {mover.currentSection}
            </div>
          </div>
          <div className="text-right ml-2">
            <div className="text-xs text-blue-600 font-medium">
              → {mover.targetSection}
            </div>
            {isAssigned && (
              <div className="text-xs text-green-600 mt-1">
                ✓ Assigned
              </div>
            )}
          </div>
        </div>
      </div>

      {touchDragActive && (
        <div
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 opacity-80 scale-95 rotate-2 shadow-xl"
          style={{
            left: dragPosition.x,
            top: dragPosition.y,
            maxWidth: '250px',
          }}
        >
          <div className="p-3 rounded-lg bg-blue-100 border-2 border-blue-300 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="text-blue-500">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                  <circle cx="4" cy="4" r="1.2" />
                  <circle cx="12" cy="4" r="1.2" />
                  <circle cx="4" cy="8" r="1.2" />
                  <circle cx="12" cy="8" r="1.2" />
                  <circle cx="4" cy="12" r="1.2" />
                  <circle cx="12" cy="12" r="1.2" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-blue-700 truncate">
                  {mover.name}
                </div>
                <div className="text-xs text-blue-600">
                  → {mover.targetSection}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DraggableMover;