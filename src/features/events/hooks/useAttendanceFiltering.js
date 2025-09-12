import { useState, useMemo } from 'react';

/**
 *
 * @param attendanceData
 * @param events
 */
function useAttendanceFiltering(attendanceData, events) {
  // Attendance filter state - exclude "Not Invited" by default
  const [attendanceFilters, setAttendanceFilters] = useState({
    yes: true,
    no: true,
    invited: true,
    notInvited: false,
  });

  // Section filter state - initialize with all sections enabled except Adults
  const [sectionFilters, setSectionFilters] = useState(() => {
    const filters = {};
    const src = events ?? [];
    const uniqueSections = [...new Set(src.map((e) => e.sectionid))];
    uniqueSections.forEach((sectionId) => {
      // Find the section name to check if it's an Adults section
      const sectionEvent = src.find((e) => e.sectionid === sectionId);
      const sectionName = sectionEvent?.sectionname?.toLowerCase() || '';

      // Set Adults sections to false by default, all others to true
      filters[sectionId] = !sectionName.includes('adults');
    });
    return filters;
  });

  // Data filter state - for controlling which columns to show
  const [dataFilters, setDataFilters] = useState({
    contacts: false, // Primary and Emergency contacts (hidden by default as requested)
  });

  // Sort configuration
  const [sortConfig, setSortConfig] = useState({
    key: 'attendance',
    direction: 'desc',
  });

  // Filter and sort attendance data
  const filteredAndSortedData = useMemo(() => {
    if (!attendanceData || !Array.isArray(attendanceData)) {
      return [];
    }

    // Apply filters
    const filtered = attendanceData.filter((item) => {
      // Filter by attendance status
      if (!attendanceFilters.yes && item.attendance === 'Yes') return false;
      if (!attendanceFilters.no && item.attendance === 'No') return false;
      if (!attendanceFilters.invited && item.attendance === 'Invited') return false;
      if (!attendanceFilters.notInvited && item.attendance === 'Not Invited') return false;

      // Filter by section
      if (!sectionFilters[item.sectionid]) return false;

      return true;
    });

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const { key, direction } = sortConfig;
      let aValue, bValue;

      switch (key) {
      case 'member':
        aValue = a.name?.toLowerCase() || '';
        bValue = b.name?.toLowerCase() || '';
        break;
        
      case 'attendance': {
        // Priority order for attendance status
        const statusPriority = { 'Yes': 4, 'No': 3, 'Invited': 2, 'Not Invited': 1 };
        aValue = statusPriority[a.attendance] || 0;
        bValue = statusPriority[b.attendance] || 0;
        break;
      }
        
      case 'section':
      case 'sectionName':
        aValue = (a.sectionname || a.sectionName || '')?.toLowerCase();
        bValue = (b.sectionname || b.sectionName || '')?.toLowerCase();
        break;
        
      case 'signintime':
      case 'signouttime': {
        const aTime = a[key] ? new Date(a[key]).getTime() : NaN;
        const bTime = b[key] ? new Date(b[key]).getTime() : NaN;
        aValue = Number.isFinite(aTime) ? aTime : 0;
        bValue = Number.isFinite(bTime) ? bTime : 0;
        break;
      }
        
      default:
        aValue = a[key] || '';
        bValue = b[key] || '';
        break;
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [attendanceData, attendanceFilters, sectionFilters, sortConfig]);

  // Handle sort changes
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return {
    attendanceFilters,
    setAttendanceFilters,
    sectionFilters,
    setSectionFilters,
    dataFilters,
    setDataFilters,
    sortConfig,
    handleSort,
    filteredAndSortedData,
  };
}

export default useAttendanceFiltering;