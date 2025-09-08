import React from 'react';
import { Button, Card } from '../../../../shared/components/ui';

function AttendanceHeader({ 
  events, 
  onBack, 
  onRefresh, 
  canRefresh = true,
  refreshLoading = false 
}) {
  if (!events || events.length === 0) {
    return null;
  }

  const eventName = events[0].name;
  const eventDate = events[0].startdate 
    ? new Date(events[0].startdate).toLocaleDateString()
    : 'Not specified';
  const sectionCount = events.length;

  return (
    <Card.Header className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{eventName}</h1>
        <p className="text-gray-600 mt-1">
          {eventDate} • {sectionCount} section{sectionCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex space-x-2">
        {canRefresh && (
          <Button
            onClick={onRefresh}
            disabled={refreshLoading}
            variant="outline"
            size="sm"
          >
            {refreshLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        )}
        <Button
          onClick={onBack}
          variant="outline" 
          size="sm"
        >
          Back
        </Button>
      </div>
    </Card.Header>
  );
}

export default AttendanceHeader;