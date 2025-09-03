import React from 'react';
import { Card } from '../ui';

function SectionMovementCard({ 
  sectionName, 
  currentCount, 
  outgoingMovers, 
  remainingCount,
  incomingCount = 0,
}) {
  return (
    <Card className="p-4 mb-4 min-w-fit max-w-sm">
      <div className="flex justify-between items-center gap-4 mb-3">
        <h3 className="text-lg font-semibold text-scout-blue">
          {sectionName}
        </h3>
        <div className="text-right">
          <div className="flex items-center space-x-2 text-sm whitespace-nowrap">
            <span className="text-gray-800 font-medium">{currentCount}</span>
            <span className="text-red-600">↓{outgoingMovers.length}</span>
            <span className="text-green-600 border border-dashed border-green-400 px-2 py-1 rounded">
              ↑{incomingCount}
            </span>
            <span className="text-gray-400">=</span>
            <span className="text-blue-600 font-medium">{remainingCount + incomingCount}</span>
          </div>
        </div>
      </div>
      
      {outgoingMovers.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Moving Up:
          </h4>
          <div className="space-y-1">
            {outgoingMovers.map(mover => (
              <div 
                key={mover.memberId}
                className="flex justify-between items-center text-sm"
              >
                <span>{mover.name}</span>
                <span className="text-gray-500">
                  {mover.age?.toFixed(1)} years
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {outgoingMovers.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No members moving up this term
        </div>
      )}
    </Card>
  );
}

export default SectionMovementCard;