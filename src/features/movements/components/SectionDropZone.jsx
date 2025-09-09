import React, { useState, useRef, useCallback } from 'react';

function SectionDropZone({
  sectionData,
  currentCount,
  incomingCount = 0,
  maxCapacity,
  onMoverDrop,
  isDragInProgress = false,
  canAcceptDrop = true,
  className = '',
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [canDrop, setCanDrop] = useState(false);
  const dropZoneRef = useRef(null);

  const isAtCapacity = maxCapacity && (currentCount + incomingCount) >= maxCapacity;

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }

    let acceptable = false;
    if (canAcceptDrop && !isAtCapacity) {
      try {
        const dragData = JSON.parse(
          e.dataTransfer.getData('application/json') || '{}',
        );
        acceptable = dragData.currentSectionId !== sectionData.sectionId;
      } catch (_) {
        acceptable = true;
      }
    }
    setCanDrop(acceptable);
    e.dataTransfer.dropEffect = acceptable ? 'move' : 'none';
  };

  const handleDragLeave = (e) => {
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

    if (!onMoverDrop || !canAcceptDrop) {
      return;
    }

    let dragData;
    try {
      if (e.type === 'section-assignment-drop') {
        dragData = e.detail;
      } else {
        dragData = JSON.parse(e.dataTransfer.getData('application/json'));
      }

      if (!dragData.moverId) {
        throw new Error('Invalid drag data: missing moverId');
      }

      if (dragData.currentSectionId === sectionData.sectionId) {
        return;
      }

      if (isAtCapacity) {
        return;
      }

      await onMoverDrop(dragData, sectionData);
    } catch (error) {
      console.error('Error handling mover drop:', error);
    }
  }, [onMoverDrop, canAcceptDrop, sectionData, isAtCapacity]);

  const handleMobileDrop = useCallback((e) => {
    handleDrop({
      ...e,
      preventDefault: () => {},
      type: 'section-assignment-drop',
    });
  }, [handleDrop]);

  React.useEffect(() => {
    const element = dropZoneRef.current;
    if (!element) return;

    element.addEventListener('section-assignment-drop', handleMobileDrop);
    return () => {
      element.removeEventListener('section-assignment-drop', handleMobileDrop);
    };
  }, [handleMobileDrop]);

  const getDropZoneStyle = () => {
    if (!isDragInProgress) return '';
    
    if (!canAcceptDrop) {
      return 'border-gray-300 bg-gray-100';
    }
    
    if (isAtCapacity) {
      return 'border-red-300 bg-red-50';
    }
    
    if (isDragOver && canDrop) {
      return 'border-green-400 bg-green-50 shadow-lg';
    }
    
    if (isDragOver) {
      return 'border-red-400 bg-red-50';
    }
    
    return 'border-blue-300 bg-blue-50';
  };

  return (
    <div
      ref={dropZoneRef}
      className={`
        relative p-4 rounded-lg border-2 transition-all duration-200
        ${getDropZoneStyle()}
        ${className}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-section-drop-zone="true"
      data-section-id={sectionData.sectionId}
      data-section-name={sectionData.sectionName}
    >
      <div className="text-center">
        <div className="font-medium text-sm text-gray-900 mb-1">
          {sectionData.sectionName}
        </div>
        <div className="text-xs text-gray-600 mb-2">
          {currentCount} current • +{incomingCount} incoming
          {maxCapacity && ` • ${maxCapacity} max`}
        </div>
        
        {isDragInProgress && (
          <div className="mt-2">
            {!canAcceptDrop ? (
              <div className="text-xs text-gray-500">
                Drop not available
              </div>
            ) : isAtCapacity ? (
              <div className="text-xs text-red-600 font-medium">
                ⚠ At capacity
              </div>
            ) : isDragOver && canDrop ? (
              <div className="text-xs text-green-600 font-medium">
                ✓ Drop here to assign
              </div>
            ) : (
              <div className="text-xs text-blue-600">
                Drop to assign member
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SectionDropZone;