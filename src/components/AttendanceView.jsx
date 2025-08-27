import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import LoadingScreen from "./LoadingScreen.jsx";
import MemberDetailModal from "./MemberDetailModal.jsx";
import CompactAttendanceFilter from "./CompactAttendanceFilter.jsx";
import SectionFilter from "./SectionFilter.jsx";
import CampGroupsView from "./CampGroupsView.jsx";
import SignInOutButton from "./SignInOutButton.jsx";
import { Card, Button, Badge, Alert } from "./ui";
import { useAttendanceData } from "../hooks/useAttendanceData.js";
import { useSignInOut } from "../hooks/useSignInOut.js";
import { findMemberSectionName } from "../utils/sectionHelpers.js";
import { getSharedEventAttendance } from "../services/api.js";
import { getToken } from "../services/auth.js";
import { isDemoMode } from "../config/demoMode.js";

function AttendanceView({ events, members, onBack }) {
  // VISIBLE TEST: Add timestamp to DOM to prove component is mounting
  window.ATTENDANCE_VIEW_MOUNTED = new Date().toISOString();

  // Debug what members data we're receiving (only log once)
  const [hasLoggedMembers, setHasLoggedMembers] = useState(false);
  if (members?.length > 0 && !hasLoggedMembers) {
    if (import.meta.env.DEV) {
      console.log("🔍 AttendanceView members count:", members.length);
      console.log(
        "🔍 AttendanceView first member keys:",
        Object.keys(members[0]).sort(),
      );
      console.log("🔍 AttendanceView first member data:", members[0]);
    }
    setHasLoggedMembers(true);
  }

  // Use custom hooks for data loading and sign-in/out functionality
  const {
    attendanceData,
    loading,
    error,
    loadVikingEventData,
    getVikingEventDataForMember,
  } = useAttendanceData(events);

  const { buttonLoading, handleSignInOut } = useSignInOut(
    events,
    loadVikingEventData,
  );

  // Local state for UI
  const [filteredAttendanceData, setFilteredAttendanceData] = useState([]);
  const [viewMode, setViewMode] = useState("overview"); // overview, register, detailed, campGroups, sharedAttendance
  const [sharedAttendanceData, setSharedAttendanceData] = useState(null);
  const [loadingSharedAttendance, setLoadingSharedAttendance] = useState(false);
  const prevViewModeRef = useRef("overview"); // Track previous view mode without extra renders
  const [sortConfig, setSortConfig] = useState({
    key: "attendance",
    direction: "desc",
  });
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  // Attendance filter state - exclude "Not Invited" by default
  const [attendanceFilters, setAttendanceFilters] = useState({
    yes: true,
    no: true,
    invited: true,
    notInvited: false,
  });

  // Cache parsed sections data for section name resolution
  const sectionsCache = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("viking_sections_offline") || "[]",
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("Failed to parse cached sections data:", error);
      }
      return [];
    }
  }, []);

  // Section filter state - initialize with all sections enabled
  const [sectionFilters, setSectionFilters] = useState(() => {
    const filters = {};
    const uniqueSections = [...new Set(events.map((e) => e.sectionid))];
    uniqueSections.forEach((sectionId) => {
      // Find the section name to check if it's an Adults section
      const sectionEvent = events.find((e) => e.sectionid === sectionId);
      const sectionName = sectionEvent?.sectionname?.toLowerCase() || "";

      // Set Adults sections to false by default, all others to true
      filters[sectionId] = !sectionName.includes("adults");
    });
    return filters;
  });

  // Refresh Viking Event data when switching to register view from camp groups
  // This ensures updated camp group assignments show in the register
  useEffect(() => {
    const prev = prevViewModeRef.current;
    const switchingToRegister = viewMode === "register" && prev !== "register";
    const switchingFromCampGroups = prev === "campGroups";

    if (switchingToRegister && switchingFromCampGroups) {
      loadVikingEventData();
    }
    // Update previous view mode without triggering re-render
    prevViewModeRef.current = viewMode;
  }, [viewMode, loadVikingEventData]);

  // loadEnhancedMembers function removed - member data now loaded proactively by dashboard

  // Format date and time in UK format (DD/MM/YYYY HH:MM)
  const formatUKDateTime = (dateString) => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");

      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  };

  // Viking Event data lookup is now handled by useAttendanceData hook

  const getAttendanceStatus = (attending) => {
    if (attending === "Yes" || attending === "1") return "yes";
    if (attending === "No") return "no";
    if (attending === "Invited") return "invited";
    // Empty string, null, or any other value means not invited
    return "notInvited";
  };

  // Check if a member should be included in camp groups (same logic as Camp Groups tab)
  const shouldIncludeInSummary = (record) => {
    // Find member details to check person_type
    const memberDetails = members.find(
      (member) => member.scoutid === record.scoutid,
    );
    if (!memberDetails) return true; // Include if we can't find member details

    const personType = memberDetails.person_type;
    // Skip Leaders and Young Leaders - same as Camp Groups filtering
    return personType !== "Leaders" && personType !== "Young Leaders";
  };

  // Filter attendance data based on active filters (attendance status + sections + person type)
  const filterAttendanceData = (data, attendanceFilters, sectionFilters) => {
    return data.filter((record) => {
      const attendanceStatus = getAttendanceStatus(record.attending);
      const attendanceMatch = attendanceFilters[attendanceStatus];
      const sectionMatch = sectionFilters[record.sectionid];
      const personTypeMatch = shouldIncludeInSummary(record);

      return attendanceMatch && sectionMatch && personTypeMatch;
    });
  };

  // Filter for record count display - includes all person types
  const filterAttendanceDataForCount = (
    data,
    attendanceFilters,
    sectionFilters,
  ) => {
    return data.filter((record) => {
      const attendanceStatus = getAttendanceStatus(record.attending);
      const attendanceMatch = attendanceFilters[attendanceStatus];
      const sectionMatch = sectionFilters[record.sectionid];

      return attendanceMatch && sectionMatch;
    });
  };

  // Update filtered data when attendance data or filters change
  useEffect(() => {
    const filtered = filterAttendanceData(
      attendanceData,
      attendanceFilters,
      sectionFilters,
    );
    setFilteredAttendanceData(filtered);
  }, [attendanceData, attendanceFilters, sectionFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if any events are shared events and load shared attendance data
  const hasSharedEvents = useMemo(() => {
    return events.some((event) => {
      // Check if this event has shared event metadata stored
      const metadata = localStorage.getItem(
        `viking_shared_metadata_${event.eventid}`,
      );
      if (metadata) {
        try {
          const parsed = JSON.parse(metadata);
          return parsed._isOwner || parsed._allSections?.length > 1;
        } catch (e) {
          return false;
        }
      }
      return false;
    });
  }, [events]);

  const loadSharedAttendanceData = useCallback(async () => {
    setLoadingSharedAttendance(true);
    try {
      // Find the shared event (the one that has shared metadata)
      const sharedEvent = events.find((event) => {
        const metadata = localStorage.getItem(
          `viking_shared_metadata_${event.eventid}`,
        );
        if (metadata) {
          try {
            const parsed = JSON.parse(metadata);
            return parsed._isOwner || parsed._allSections?.length > 1;
          } catch (e) {
            return false;
          }
        }
        return false;
      });

      if (!sharedEvent) {
        throw new Error("No shared event found");
      }

      if (import.meta.env.DEV) {
        console.log(
          "Loading shared attendance for event:",
          sharedEvent.eventid,
          "section:",
          sharedEvent.sectionid,
        );
      }

      // First try to load from cache for offline support
      const cacheKey = `viking_shared_attendance_${sharedEvent.eventid}_${sharedEvent.sectionid}_offline`;
      let cachedData = null;

      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          cachedData = JSON.parse(cached);
          if (import.meta.env.DEV) {
            console.log("Found cached shared attendance data:", cachedData);
          }
        }
      } catch (cacheError) {
        if (import.meta.env.DEV) {
          console.warn(
            "Failed to parse cached shared attendance data:",
            cacheError,
          );
        }
      }

      const token = getToken();
      let sharedData = null;

      // Try API call if we have a token and not in demo mode
      if (!isDemoMode() && token) {
        try {
          sharedData = await getSharedEventAttendance(
            sharedEvent.eventid,
            sharedEvent.sectionid,
            token,
          );
        } catch (apiError) {
          if (import.meta.env.DEV) {
            console.warn(
              "API call failed, will use cached data if available:",
              apiError,
            );
          }
          // If API fails, fallback to cached data
          if (cachedData) {
            sharedData = cachedData;
          } else {
            throw apiError; // Re-throw if no cached data available
          }
        }
      } else if (isDemoMode()) {
        // In demo mode, let getSharedEventAttendance handle it
        sharedData = await getSharedEventAttendance(
          sharedEvent.eventid,
          sharedEvent.sectionid,
          token,
        );
      } else {
        // No token and not demo mode - use cached data or fail gracefully
        if (cachedData) {
          sharedData = cachedData;
          if (import.meta.env.DEV) {
            console.log(
              "Using cached shared attendance data (no token available)",
            );
          }
        } else {
          throw new Error(
            "No authentication token available and no cached data found",
          );
        }
      }

      if (import.meta.env.DEV) {
        console.log("Final shared attendance data:", sharedData);
      }
      setSharedAttendanceData(sharedData);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error loading shared attendance data:", error);
      }
      setSharedAttendanceData({ error: error.message });
    } finally {
      setLoadingSharedAttendance(false);
    }
  }, [events]);

  // Load shared attendance data when switching to shared attendance view
  useEffect(() => {
    if (
      viewMode === "sharedAttendance" &&
      hasSharedEvents &&
      !sharedAttendanceData &&
      !loadingSharedAttendance
    ) {
      loadSharedAttendanceData();
    }
  }, [
    viewMode,
    hasSharedEvents,
    sharedAttendanceData,
    loadingSharedAttendance,
    loadSharedAttendanceData,
  ]);

  const getSummaryStats = () => {
    const memberStats = {};

    // Create person_type lookup like other functions do
    const memberPersonTypes = {};
    if (members && Array.isArray(members)) {
      members.forEach((member) => {
        memberPersonTypes[member.scoutid] =
          member.person_type || "Young People";
      });
    }

    filteredAttendanceData.forEach((record) => {
      const memberKey = `${record.firstname} ${record.lastname}`;
      if (!memberStats[memberKey]) {
        memberStats[memberKey] = {
          name: memberKey,
          scoutid: record.scoutid,
          sectionid: record.sectionid, // Store section ID for Viking Event data lookup
          person_type: memberPersonTypes[record.scoutid] || "Young People", // Add person_type
          yes: 0,
          no: 0,
          invited: 0,
          notInvited: 0,
          total: 0,
          events: [],
          vikingEventData: null, // Will be populated below
        };
      }

      memberStats[memberKey].total++;
      const status = getAttendanceStatus(record.attending);
      memberStats[memberKey][status]++;

      memberStats[memberKey].events.push({
        name: record.eventname,
        date: record.eventdate,
        status: status,
        attending: record.attending,
        sectionname: record.sectionname,
      });
    });

    // Populate Viking Event Management data for each member
    Object.values(memberStats).forEach((member) => {
      const vikingData = getVikingEventDataForMember(member.scoutid, member);

      if (vikingData) {
        member.vikingEventData = {
          CampGroup: vikingData.CampGroup,
          SignedInBy: vikingData.SignedInBy,
          SignedInWhen: vikingData.SignedInWhen,
          SignedOutBy: vikingData.SignedOutBy,
          SignedOutWhen: vikingData.SignedOutWhen,
        };
      }
    });

    return Object.values(memberStats);
  };

  // Sign-in/out functionality is now handled by useSignInOut hook
  // SignInOutButton component is now in separate file

  const getSimplifiedAttendanceSummaryStats = () => {
    const sectionStats = {};
    const totals = {
      yes: { yp: 0, yl: 0, l: 0, total: 0 },
      no: { yp: 0, yl: 0, l: 0, total: 0 },
      invited: { yp: 0, yl: 0, l: 0, total: 0 },
      notInvited: { yp: 0, yl: 0, l: 0, total: 0 },
      total: { yp: 0, yl: 0, l: 0, total: 0 },
    };

    // Create a map of scout IDs to person types from members data
    const memberPersonTypes = {};
    if (members && Array.isArray(members)) {
      members.forEach((member) => {
        memberPersonTypes[member.scoutid] =
          member.person_type || "Young People";
      });
    }

    attendanceData.forEach((record) => {
      const sectionName = record.sectionname || "Unknown Section";
      const personType = memberPersonTypes[record.scoutid] || "Young People";
      const status = getAttendanceStatus(record.attending);

      // Initialize section stats if not exists
      if (!sectionStats[sectionName]) {
        sectionStats[sectionName] = {
          name: sectionName,
          yes: { yp: 0, yl: 0, l: 0, total: 0 },
          no: { yp: 0, yl: 0, l: 0, total: 0 },
          invited: { yp: 0, yl: 0, l: 0, total: 0 },
          notInvited: { yp: 0, yl: 0, l: 0, total: 0 },
          total: { yp: 0, yl: 0, l: 0, total: 0 },
        };
      }

      // Map person types to abbreviations
      let roleKey;
      if (personType === "Young People") roleKey = "yp";
      else if (personType === "Young Leaders") roleKey = "yl";
      else if (personType === "Leaders") roleKey = "l";
      else roleKey = "yp"; // Default unknown to YP

      // Update section-specific counts
      sectionStats[sectionName][status][roleKey]++;
      sectionStats[sectionName][status].total++;
      sectionStats[sectionName].total[roleKey]++;
      sectionStats[sectionName].total.total++;

      // Update totals
      totals[status][roleKey]++;
      totals[status].total++;
      totals.total[roleKey]++;
      totals.total.total++;
    });

    return {
      sections: Object.values(sectionStats),
      totals,
    };
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortData = (data, key, direction) => {
    return [...data].sort((a, b) => {
      let aValue, bValue;

      switch (key) {
        case "member":
          if (viewMode === "register") {
            aValue = a.name?.toLowerCase() || "";
            bValue = b.name?.toLowerCase() || "";
          } else {
            aValue = `${a.firstname} ${a.lastname}`.toLowerCase();
            bValue = `${b.firstname} ${b.lastname}`.toLowerCase();
          }
          break;
        case "attendance":
          if (viewMode === "register") {
            // For register, determine primary status for each member and sort by priority
            const getPrimaryStatus = (member) => {
              if (member.yes > 0) return "yes";
              if (member.no > 0) return "no";
              if (member.invited > 0) return "invited";
              if (member.notInvited > 0) return "notInvited";
              return "unknown";
            };

            const statusA = getPrimaryStatus(a);
            const statusB = getPrimaryStatus(b);
            // Sort order: yes, no, invited, notInvited (higher values come first in desc)
            const statusOrder = {
              yes: 3,
              no: 2,
              invited: 1,
              notInvited: 0,
              unknown: -1,
            };
            aValue = statusOrder[statusA] || -1;
            bValue = statusOrder[statusB] || -1;
          } else {
            const statusA = getAttendanceStatus(a.attending);
            const statusB = getAttendanceStatus(b.attending);
            // Sort order: yes, no, invited, notInvited (higher values come first in desc)
            const statusOrder = { yes: 3, no: 2, invited: 1, notInvited: 0 };
            aValue = statusOrder[statusA] || 0;
            bValue = statusOrder[statusB] || 0;
          }
          break;
        case "section":
          aValue = a.sectionname?.toLowerCase() || "";
          bValue = b.sectionname?.toLowerCase() || "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return (
        <span className="ml-1 text-gray-400" data-oid=":5qvk-e">
          <svg
            className="w-4 h-4 inline"
            fill="currentColor"
            viewBox="0 0 20 20"
            data-oid="ew_omju"
          >
            <path d="M5 12l5-5 5 5H5z" data-oid="-19lbql" />
            <path d="M5 8l5 5 5-5H5z" data-oid="g:h_dvv" />
          </svg>
        </span>
      );
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-scout-blue" data-oid="sqjrxnm">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="86.5x-v"
        >
          <path d="M5 12l5-5 5 5H5z" data-oid="8anrdpm" />
        </svg>
      </span>
    ) : (
      <span className="ml-1 text-scout-blue" data-oid="7t8d0ok">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="9y04zyv"
        >
          <path d="M5 8l5 5 5-5H5z" data-oid="gij-80o" />
        </svg>
      </span>
    );
  };

  // Transform cached member data to match what MemberDetailModal expects
  const transformMemberForModal = (cachedMember) => {
    if (!cachedMember) return null;

    if (import.meta.env.DEV) {
      console.log("🔄 transformMemberForModal - Checking cached member:", {
        scoutid: cachedMember.scoutid,
        has_firstname: "firstname" in cachedMember,
        firstname_value: cachedMember.firstname,
        has_first_name: "first_name" in cachedMember,
        first_name_value: cachedMember.first_name,
        has_lastname: "lastname" in cachedMember,
        lastname_value: cachedMember.lastname,
        has_last_name: "last_name" in cachedMember,
        last_name_value: cachedMember.last_name,
      });
    }

    // The cached data should already have both firstname and first_name
    // Just ensure firstname/lastname are set (modal uses these)
    // Also resolve section name using the section helper utility
    const memberSectionId = cachedMember.sectionid || cachedMember.section_id;
    const memberSectionName = findMemberSectionName(
      memberSectionId,
      sectionsCache,
    );

    const transformed = {
      ...cachedMember,
      firstname: cachedMember.firstname || cachedMember.first_name,
      lastname: cachedMember.lastname || cachedMember.last_name,
      sections: [memberSectionName || cachedMember.sectionname || "Unknown"],
      sectionname: memberSectionName || cachedMember.sectionname, // Also set sectionname for consistency
    };

    if (import.meta.env.DEV) {
      console.log("🔄 transformMemberForModal - Result:", {
        firstname: transformed.firstname,
        lastname: transformed.lastname,
      });
    }

    return transformed;
  };

  // Handle member click to show detail modal
  const handleMemberClick = (attendanceRecord) => {
    // Find the full member data or create a basic member object
    // Convert scoutid to number for comparison (members array has numeric scoutids)
    const scoutidAsNumber = parseInt(attendanceRecord.scoutid, 10);
    const cachedMember = members?.find((m) => m.scoutid === scoutidAsNumber);

    let member;
    if (cachedMember) {
      // Transform the cached data to match modal expectations
      member = transformMemberForModal(cachedMember);

      // Debug log to see what data Register/AttendanceView is passing to modal
      if (import.meta.env.DEV) {
        console.log(
          "AttendanceView (Register) - Member clicked, passing to modal:",
          {
            memberScoutId: member.scoutid,
            memberName: member.name || `${member.firstname} ${member.lastname}`,
            memberKeys: Object.keys(member),
            memberData: member,
            hasContactInfo: !!(
              member.contact_primary_member || member.contact_primary_1
            ),

            hasMedicalInfo: !!(
              member.medical ||
              member.dietary ||
              member.allergies
            ),

            totalFields: Object.keys(member).length,
            source: "transformMemberForModal (cached member)",
          },
        );
      }
    } else {
      // Fallback to basic data from attendance record
      member = {
        scoutid: attendanceRecord.scoutid,
        firstname: attendanceRecord.firstname,
        lastname: attendanceRecord.lastname,
        sections: [attendanceRecord.sectionname],
        person_type: attendanceRecord.person_type || "Young People",
      };

      // Debug log for fallback case
      if (import.meta.env.DEV) {
        console.log(
          "AttendanceView (Register) - Member clicked, passing to modal:",
          {
            memberScoutId: member.scoutid,
            memberName: `${member.firstname} ${member.lastname}`,
            memberKeys: Object.keys(member),
            memberData: member,
            hasContactInfo: false,
            hasMedicalInfo: false,
            totalFields: Object.keys(member).length,
            source: "fallback (attendance record only)",
          },
        );
      }
    }

    setSelectedMember(member);
    setShowMemberModal(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
  };

  if (loading) {
    return <LoadingScreen message="Loading attendance..." data-oid="cnja_13" />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4" data-oid="z7f2f1j">
        <Alert.Title data-oid="nbdm9pr">Error Loading Attendance</Alert.Title>
        <Alert.Description data-oid="ulvrcpm">{error}</Alert.Description>
        <Alert.Actions data-oid="g83c4uo">
          <Button
            variant="scout-blue"
            onClick={() => window.location.reload()}
            type="button"
            data-oid="b-kq0a-"
          >
            Retry
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  if (!attendanceData || attendanceData.length === 0) {
    return (
      <Card className="m-4" data-oid="berd0da">
        <Card.Header data-oid="06krjqu">
          <Card.Title data-oid="qc:r0rb">No Attendance Data</Card.Title>
          <Button
            variant="outline-scout-blue"
            onClick={onBack}
            type="button"
            data-oid="wsek0uf"
          >
            Back to Dashboard
          </Button>
        </Card.Header>
        <Card.Body data-oid="r5nka-8">
          <p className="text-gray-600" data-oid="2uj5c7_">
            No attendance data found for the selected event(s).
          </p>
        </Card.Body>
      </Card>
    );
  }

  const summaryStats = getSummaryStats();
  const simplifiedSummaryStats = getSimplifiedAttendanceSummaryStats();

  // Get unique sections from events for the section filter
  const uniqueSections = events.reduce((acc, event) => {
    if (!acc.find((section) => section.sectionid === event.sectionid)) {
      acc.push({
        sectionid: event.sectionid,
        sectionname: event.sectionname,
      });
    }
    return acc;
  }, []);

  return (
    <div data-oid="62a.jhj">
      {/* Attendance Data Card */}
      <Card className="m-4" data-oid="bi_2752">
        <Card.Header data-oid="2lnz-ku">
          <Card.Title data-oid="6u7-gff">
            Attendance Data -{" "}
            {events.length === 1
              ? events[0].name
              : `${events[0].name} (${events.length} sections)`}{" "}
            {(() => {
              const filteredForCount = filterAttendanceDataForCount(
                attendanceData,
                attendanceFilters,
                sectionFilters,
              );
              return (
                filteredForCount.length !== attendanceData.length && (
                  <span
                    className="text-sm font-normal text-gray-600"
                    data-oid="gfwf5rl"
                  >
                    ({filteredForCount.length} of {attendanceData.length}{" "}
                    records)
                  </span>
                )
              );
            })()}
          </Card.Title>
          <div className="flex gap-2 items-center flex-wrap" data-oid=".ivwwee">
            <Button
              variant="outline-scout-blue"
              onClick={onBack}
              type="button"
              data-oid="tne594h"
            >
              Back to Dashboard
            </Button>
            {attendanceData.length > 0 && (
              <div className="flex flex-col gap-3" data-oid="hq8wap1">
                <CompactAttendanceFilter
                  filters={attendanceFilters}
                  onFiltersChange={setAttendanceFilters}
                  data-oid="orrnzbs"
                />

                {uniqueSections.length > 1 && (
                  <SectionFilter
                    sectionFilters={sectionFilters}
                    onFiltersChange={setSectionFilters}
                    sections={uniqueSections}
                    data-oid="md42:y1"
                  />
                )}
              </div>
            )}
          </div>
        </Card.Header>

        <Card.Body data-oid="dp4vuqr">
          {/* View toggle */}
          <div className="border-b border-gray-200 mb-6" data-oid="upu:y-a">
            <nav className="-mb-px flex space-x-8" data-oid="nsid.df">
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === "overview"
                    ? "border-scout-blue text-scout-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setViewMode("overview")}
                type="button"
                data-oid="p9y8tix"
              >
                Overview
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === "register"
                    ? "border-scout-blue text-scout-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setViewMode("register")}
                type="button"
                data-oid="d17dzni"
              >
                Register
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === "detailed"
                    ? "border-scout-blue text-scout-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setViewMode("detailed")}
                type="button"
                data-oid="mvhyx5_"
              >
                Detailed
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === "campGroups"
                    ? "border-scout-blue text-scout-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setViewMode("campGroups")}
                type="button"
                data-oid="n26ln7x"
              >
                Camp Groups
              </button>
              {hasSharedEvents && (
                <button
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    viewMode === "sharedAttendance"
                      ? "border-scout-blue text-scout-blue"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                  onClick={() => setViewMode("sharedAttendance")}
                  type="button"
                  data-oid=":j6ufed"
                >
                  Shared Attendance
                </button>
              )}
            </nav>
          </div>

          {/* Overview Tab - Attendance Summary */}
          {viewMode === "overview" && members && members.length > 0 && (
            <div className="overflow-x-auto" data-oid="qh4zhem">
              <div className="flex gap-2 items-center mb-4" data-oid="mfjp5c6">
                <Badge variant="scout-green" data-oid="03fzqtn">
                  {simplifiedSummaryStats.totals.total.total} total responses
                </Badge>
              </div>
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="ueyj3lz"
              >
                <thead className="bg-gray-50" data-oid="eut4v75">
                  <tr data-oid="fvyt538">
                    <th
                      className="px-3 py-2 text-left table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="cwgmf6j"
                    >
                      Section
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-green-600 uppercase tracking-wider"
                      data-oid="z71q2is"
                    >
                      <div data-oid="cw9cxd0">Yes</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="of.pi5d"
                      >
                        <span className="w-8 text-center" data-oid="fbb5q8r">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="29i76_.">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="oywfq-e">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="ni05f18">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-red-600 uppercase tracking-wider"
                      data-oid="uignmrl"
                    >
                      <div data-oid="ptkvgyc">No</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="xgvadfy"
                      >
                        <span className="w-8 text-center" data-oid="qpinlg6">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="lz:zqqy">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="gifd7.4">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="aws9cor">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-yellow-600 uppercase tracking-wider"
                      data-oid="07hdxsl"
                    >
                      <div data-oid="9njfv4e">Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="dg03hx2"
                      >
                        <span className="w-8 text-center" data-oid="iekj115">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="5r57o7d">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="qakvh17">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="ouz2agx">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-600 uppercase tracking-wider"
                      data-oid="m1hj6i4"
                    >
                      <div data-oid="ernlive">Not Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="z788i_s"
                      >
                        <span className="w-8 text-center" data-oid="js9jz6p">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="z-rineu">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="9xk6kh8">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="82j7bzs">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="45nx3c3"
                    >
                      <div data-oid="gfvro4:">Total</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="a_ci92h"
                      >
                        <span className="w-8 text-center" data-oid="qzimyug">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="l:42k8n">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="0vxsw23">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="458dl:i">
                          Total
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="wc6dzdb"
                >
                  {simplifiedSummaryStats.sections.map((section, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50"
                      data-oid="aoi_a48"
                    >
                      <td
                        className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                        data-oid="ua1a-_c"
                      >
                        {section.name}
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold"
                        data-oid="58hlgxc"
                      >
                        <div className="flex justify-center" data-oid="bh_i4.6">
                          <span className="w-8 text-center" data-oid="ycuc2td">
                            {section.yes.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="2hnv0q8">
                            {section.yes.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="iup:omk">
                            {section.yes.l}
                          </span>
                          <span className="w-12 text-center" data-oid="nayadqp">
                            {section.yes.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold"
                        data-oid="vbjmm2v"
                      >
                        <div className="flex justify-center" data-oid="l..41:8">
                          <span className="w-8 text-center" data-oid="-qsytf4">
                            {section.no.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="u6dxkjm">
                            {section.no.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="v_19r2p">
                            {section.no.l}
                          </span>
                          <span className="w-12 text-center" data-oid="68ss5mu">
                            {section.no.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold"
                        data-oid="reofgh_"
                      >
                        <div className="flex justify-center" data-oid="9llip0x">
                          <span className="w-8 text-center" data-oid="vg0tj47">
                            {section.invited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="umn:47l">
                            {section.invited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="ttm._ee">
                            {section.invited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="ov_a6kj">
                            {section.invited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                        data-oid="48l4h8p"
                      >
                        <div className="flex justify-center" data-oid="91n98wb">
                          <span className="w-8 text-center" data-oid="l552yvc">
                            {section.notInvited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="h-aor0b">
                            {section.notInvited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="srcojsx">
                            {section.notInvited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="njqlnp-">
                            {section.notInvited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                        data-oid="c44rkd_"
                      >
                        <div className="flex justify-center" data-oid="c9_781d">
                          <span className="w-8 text-center" data-oid="duh2zo:">
                            {section.total.yp}
                          </span>
                          <span className="w-8 text-center" data-oid=":7dm7dw">
                            {section.total.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="_8f71pq">
                            {section.total.l}
                          </span>
                          <span className="w-12 text-center" data-oid="u_a2rs7">
                            {section.total.total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-semibold" data-oid="ic7ey40">
                    <td
                      className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                      data-oid="kzmrlln"
                    >
                      Total
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold"
                      data-oid="0gpv34l"
                    >
                      <div className="flex justify-center" data-oid="gh887ic">
                        <span className="w-8 text-center" data-oid=":oy873g">
                          {simplifiedSummaryStats.totals.yes.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="5jpr9_w">
                          {simplifiedSummaryStats.totals.yes.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="h_u-59n">
                          {simplifiedSummaryStats.totals.yes.l}
                        </span>
                        <span className="w-12 text-center" data-oid="pu6xzfo">
                          {simplifiedSummaryStats.totals.yes.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold"
                      data-oid="sq:thlo"
                    >
                      <div className="flex justify-center" data-oid="z0-5xv.">
                        <span className="w-8 text-center" data-oid="1tpq:kh">
                          {simplifiedSummaryStats.totals.no.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="0d7qj8g">
                          {simplifiedSummaryStats.totals.no.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="63xefer">
                          {simplifiedSummaryStats.totals.no.l}
                        </span>
                        <span className="w-12 text-center" data-oid="cv:lbr4">
                          {simplifiedSummaryStats.totals.no.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold"
                      data-oid="cbrz9pt"
                    >
                      <div className="flex justify-center" data-oid="z7dak35">
                        <span className="w-8 text-center" data-oid="pcthe1p">
                          {simplifiedSummaryStats.totals.invited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid=":5i5wah">
                          {simplifiedSummaryStats.totals.invited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="wwo4j_t">
                          {simplifiedSummaryStats.totals.invited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="848j1qk">
                          {simplifiedSummaryStats.totals.invited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                      data-oid="70k0fqi"
                    >
                      <div className="flex justify-center" data-oid="9s6-_l8">
                        <span className="w-8 text-center" data-oid="kfsrm26">
                          {simplifiedSummaryStats.totals.notInvited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="zlji.54">
                          {simplifiedSummaryStats.totals.notInvited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="z1yij96">
                          {simplifiedSummaryStats.totals.notInvited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="wo42n_b">
                          {simplifiedSummaryStats.totals.notInvited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                      data-oid="072qowz"
                    >
                      <div className="flex justify-center" data-oid="4ox5uqs">
                        <span className="w-8 text-center" data-oid="rhlgqvp">
                          {simplifiedSummaryStats.totals.total.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="mch3lk2">
                          {simplifiedSummaryStats.totals.total.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="70c9dko">
                          {simplifiedSummaryStats.totals.total.l}
                        </span>
                        <span className="w-12 text-center" data-oid="opwmd1l">
                          {simplifiedSummaryStats.totals.total.total}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {filteredAttendanceData.length === 0 ? (
            <div className="text-center py-12" data-oid="nmsa1f4">
              <div className="text-gray-500 mb-4" data-oid="9aw5uav">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  data-oid="fv4h-ms"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    data-oid="4syj7v:"
                  />
                </svg>
              </div>
              <h3
                className="text-lg font-semibold text-gray-900 mb-2"
                data-oid="66n3rea"
              >
                No Records Match Filters
              </h3>
              <p className="text-gray-600 mb-4" data-oid=".p4q:if">
                No attendance records match your current filter settings. Try
                adjusting the filters above to see more data.
              </p>
              <Button
                variant="scout-blue"
                onClick={() => {
                  setAttendanceFilters({
                    yes: true,
                    no: true,
                    invited: true,
                    notInvited: true,
                  });
                  // Also reset section filters to show all sections
                  const allSectionsEnabled = {};
                  uniqueSections.forEach((section) => {
                    allSectionsEnabled[section.sectionid] = true;
                  });
                  setSectionFilters(allSectionsEnabled);
                }}
                type="button"
                data-oid="3j7i8j_"
              >
                Show All Records
              </Button>
            </div>
          ) : (
            viewMode === "register" && (
              <div className="overflow-x-auto" data-oid="rgs-pde">
                <table
                  className="min-w-full divide-y divide-gray-200"
                  data-oid="iz_od2j"
                >
                  <thead className="bg-gray-50" data-oid="57.n:tm">
                    <tr data-oid="fjk:t4d">
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("member")}
                        data-oid="t8hvv.1"
                      >
                        <div className="flex items-center" data-oid="udrcap5">
                          Member {getSortIcon("member")}
                        </div>
                      </th>
                      <th
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="5r:fuva"
                      >
                        Actions
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("attendance")}
                        data-oid=".03jsbq"
                      >
                        <div className="flex items-center" data-oid="ufmretv">
                          Status {getSortIcon("attendance")}
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="e4rqfzm"
                      >
                        Camp Group
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="0qkkiat"
                      >
                        Signed In
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="m6jqzrs"
                      >
                        Signed Out
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className="bg-white divide-y divide-gray-200"
                    data-oid="wtd04wv"
                  >
                    {sortData(
                      summaryStats,
                      sortConfig.key,
                      sortConfig.direction,
                    ).map((member, index) => {
                      return (
                        <tr
                          key={index}
                          className="hover:bg-gray-50"
                          data-oid="ldq1wul"
                        >
                          <td className="px-3 py-2" data-oid="s1l3ogz">
                            <button
                              onClick={() => {
                                // Pass the member object with scoutid so handleMemberClick can find the full cached data
                                handleMemberClick({
                                  scoutid: member.scoutid,
                                  firstname: member.name.split(" ")[0],
                                  lastname: member.name
                                    .split(" ")
                                    .slice(1)
                                    .join(" "),
                                  sectionname: member.events[0]?.sectionname,
                                });
                              }}
                              className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left break-words whitespace-normal leading-tight max-w-[120px] block text-xs"
                              data-oid="tp8o-b3"
                            >
                              {member.name}
                            </button>
                          </td>
                          <td
                            className="px-2 py-2 text-center"
                            data-oid="0d4h9ye"
                          >
                            <SignInOutButton
                              member={member}
                              onSignInOut={handleSignInOut}
                              loading={buttonLoading?.[member.scoutid] || false}
                              data-oid="x7jky3f"
                            />
                          </td>
                          <td
                            className="px-3 py-2 whitespace-nowrap"
                            data-oid="dkh9mgw"
                          >
                            <div
                              className="flex gap-1 flex-wrap"
                              data-oid="l1xkcty"
                            >
                              {member.yes > 0 && (
                                <Badge
                                  variant="scout-green"
                                  className="text-xs"
                                  data-oid="nu-v0p."
                                >
                                  Yes
                                </Badge>
                              )}
                              {member.no > 0 && (
                                <Badge
                                  variant="scout-red"
                                  className="text-xs"
                                  data-oid="pusd__c"
                                >
                                  No
                                </Badge>
                              )}
                              {member.invited > 0 && (
                                <Badge
                                  variant="scout-blue"
                                  className="text-xs"
                                  data-oid="gg-00m8"
                                >
                                  Invited
                                </Badge>
                              )}
                              {member.notInvited > 0 && (
                                <Badge
                                  variant="light"
                                  className="text-xs"
                                  data-oid="ex37du9"
                                >
                                  Not Invited
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-3 py-2 whitespace-nowrap text-xs text-gray-900"
                            data-oid="8iff-tk"
                          >
                            {member.vikingEventData?.CampGroup || "-"}
                          </td>
                          <td className="px-3 py-2 text-xs" data-oid="ynkv-_f">
                            {member.vikingEventData?.SignedInBy ||
                            member.vikingEventData?.SignedInWhen ? (
                              <div className="space-y-0.5" data-oid="tki9y4z">
                                <div
                                  className="text-gray-900 font-medium leading-tight"
                                  data-oid="oiv0m:h"
                                >
                                  {member.vikingEventData?.SignedInBy || "-"}
                                </div>
                                <div
                                  className="text-gray-500 text-xs leading-tight"
                                  data-oid="i.69-t7"
                                >
                                  {member.vikingEventData?.SignedInWhen
                                    ? formatUKDateTime(
                                        member.vikingEventData.SignedInWhen,
                                      )
                                    : "-"}
                                </div>
                              </div>
                            ) : (
                              <span
                                className="text-gray-400"
                                data-oid="533zs1n"
                              >
                                -
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs" data-oid="z2l9kyu">
                            {member.vikingEventData?.SignedOutBy ||
                            member.vikingEventData?.SignedOutWhen ? (
                              <div className="space-y-0.5" data-oid="0cds8kt">
                                <div
                                  className="text-gray-900 font-medium leading-tight"
                                  data-oid="_593j-i"
                                >
                                  {member.vikingEventData?.SignedOutBy || "-"}
                                </div>
                                <div
                                  className="text-gray-500 text-xs leading-tight"
                                  data-oid="jd18:8k"
                                >
                                  {member.vikingEventData?.SignedOutWhen
                                    ? formatUKDateTime(
                                        member.vikingEventData.SignedOutWhen,
                                      )
                                    : "-"}
                                </div>
                              </div>
                            ) : (
                              <span
                                className="text-gray-400"
                                data-oid="d-1ch8g"
                              >
                                -
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {viewMode === "detailed" && (
            <div className="overflow-x-auto" data-oid="x08vdlf">
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="sc3-kiv"
              >
                <thead className="bg-gray-50" data-oid="q4:u0zu">
                  <tr data-oid="th4am00">
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("member")}
                      data-oid="wd8-d7n"
                    >
                      <div className="flex items-center" data-oid="5rfi1k2">
                        Member {getSortIcon("member")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("section")}
                      data-oid="25j9wja"
                    >
                      <div className="flex items-center" data-oid="023ke_4">
                        Section {getSortIcon("section")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("attendance")}
                      data-oid="rjnmgdd"
                    >
                      <div className="flex items-center" data-oid="95xrra.">
                        Attendance {getSortIcon("attendance")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="s_6ijte"
                >
                  {sortData(
                    filteredAttendanceData,
                    sortConfig.key,
                    sortConfig.direction,
                  ).map((record, index) => {
                    const status = getAttendanceStatus(record.attending);
                    let badgeVariant, statusText;

                    switch (status) {
                      case "yes":
                        badgeVariant = "scout-green";
                        statusText = "Yes";
                        break;
                      case "no":
                        badgeVariant = "scout-red";
                        statusText = "No";
                        break;
                      case "invited":
                        badgeVariant = "scout-blue";
                        statusText = "Invited";
                        break;
                      case "notInvited":
                        badgeVariant = "secondary";
                        statusText = "Not Invited";
                        break;
                      default:
                        badgeVariant = "secondary";
                        statusText = "Unknown";
                        break;
                    }

                    return (
                      <tr
                        key={index}
                        className="hover:bg-gray-50"
                        data-oid="tz-sf6g"
                      >
                        <td
                          className="px-6 py-2 whitespace-nowrap"
                          data-oid="g9_sev8"
                        >
                          <button
                            onClick={() => handleMemberClick(record)}
                            className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left text-xs"
                            data-oid="2ds50gz"
                          >
                            {record.firstname} {record.lastname}
                          </button>
                        </td>
                        <td
                          className="px-6 py-2 whitespace-nowrap text-gray-900 text-xs"
                          data-oid="octci.:"
                        >
                          {record.sectionname}
                        </td>
                        <td
                          className="px-6 py-2 whitespace-nowrap"
                          data-oid="fk5ofkv"
                        >
                          <Badge variant={badgeVariant} data-oid="o_-q:.u">
                            {statusText}
                          </Badge>
                          {record.attending &&
                            record.attending !== statusText && (
                              <div
                                className="text-gray-500 text-xs mt-1"
                                data-oid="b8s-tpx"
                              >
                                Raw: &quot;{record.attending}&quot;
                              </div>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === "campGroups" && (
            <CampGroupsView
              events={events}
              attendees={getSummaryStats()}
              members={members}
              onError={(_error) => {
                /* Error handled within CampGroupsView */
              }}
              data-oid="9k47y2s"
            />
          )}

          {viewMode === "sharedAttendance" && (
            <div data-oid="_5639sq">
              {loadingSharedAttendance ? (
                <div className="text-center py-8" data-oid="5obgsnb">
                  <div
                    className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-scout-blue"
                    data-oid="ur5421y"
                  ></div>
                  <p className="mt-2 text-gray-600" data-oid="6247le9">
                    Loading shared attendance data...
                  </p>
                </div>
              ) : sharedAttendanceData?.error ? (
                <Alert variant="danger" data-oid="glwpus:">
                  <Alert.Title data-oid="nlu19-0">
                    Error Loading Shared Attendance
                  </Alert.Title>
                  <Alert.Description data-oid="osxnnxj">
                    {sharedAttendanceData.error}
                  </Alert.Description>
                  <Alert.Actions data-oid="p0uyn30">
                    <Button
                      variant="scout-blue"
                      onClick={loadSharedAttendanceData}
                      type="button"
                      data-oid="g1-3b__"
                    >
                      Retry
                    </Button>
                  </Alert.Actions>
                </Alert>
              ) : sharedAttendanceData?.items ? (
                <div data-oid="58ft-.6">
                  {(() => {
                    // Helper function to determine if member is young person or adult based on age
                    const isYoungPerson = (age) => {
                      if (!age) return true; // Default to young person if no age
                      return age !== "25+"; // Adults/leaders have '25+', young people have formats like '06 / 08'
                    };

                    // Helper function to get numeric age for sorting (handle years/months format)
                    const getNumericAge = (age) => {
                      if (!age) return 0;
                      if (age === "25+") return 999; // Put adults at the end

                      // Handle format like '06 / 08' which is years / months
                      const match = age.match(/^(\d+)\s*\/\s*(\d+)$/);
                      if (match) {
                        const years = parseInt(match[1], 10);
                        const months = parseInt(match[2], 10);
                        // Convert to total months for accurate sorting
                        return years * 12 + months;
                      }

                      // Fallback to just first number
                      const singleMatch = age.match(/^(\d+)/);
                      return singleMatch
                        ? parseInt(singleMatch[1], 10) * 12
                        : 0; // Convert years to months
                    };

                    // Process the data to group by sections
                    const sectionGroups = {};
                    let totalYoungPeople = 0;
                    let totalAdults = 0;

                    sharedAttendanceData.items.forEach((member) => {
                      const sectionName = member.sectionname;
                      const isYP = isYoungPerson(member.age);

                      if (isYP) {
                        totalYoungPeople++;
                      } else {
                        totalAdults++;
                      }

                      if (!sectionGroups[sectionName]) {
                        sectionGroups[sectionName] = {
                          sectionid: member.sectionid,
                          sectionname: sectionName,
                          members: [],
                          youngPeopleCount: 0,
                          adultsCount: 0,
                        };
                      }

                      if (isYP) {
                        sectionGroups[sectionName].youngPeopleCount++;
                      } else {
                        sectionGroups[sectionName].adultsCount++;
                      }

                      sectionGroups[sectionName].members.push(member);
                    });

                    // Sort members within each section by age (youngest first, adults last)
                    Object.values(sectionGroups).forEach((section) => {
                      section.members.sort((a, b) => {
                        const ageA = getNumericAge(a.age);
                        const ageB = getNumericAge(b.age);
                        return ageA - ageB;
                      });
                    });

                    const sections = Object.values(sectionGroups);
                    const totalMembers = totalYoungPeople + totalAdults;

                    return (
                      <>
                        {/* Overall summary */}
                        <div
                          className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
                          data-oid="rm:gs9:"
                        >
                          <h3
                            className="text-lg font-semibold text-gray-900 mb-2"
                            data-oid="a8elssc"
                          >
                            Combined Attendance Summary
                          </h3>
                          <div
                            className="flex flex-wrap gap-3"
                            data-oid="qrcbh79"
                          >
                            <Badge
                              variant="scout-blue"
                              size="md"
                              data-oid="klvp08-"
                            >
                              {totalMembers} Total
                            </Badge>
                            <Badge
                              variant="scout-green"
                              size="md"
                              data-oid="yzumyb7"
                            >
                              {totalYoungPeople} Young People
                            </Badge>
                            <Badge
                              variant="scout-purple"
                              size="md"
                              data-oid="kux.uh:"
                            >
                              {totalAdults} Adults
                            </Badge>
                            <Badge variant="light" size="md" data-oid="hlzerw.">
                              {sections.length} Sections
                            </Badge>
                          </div>
                        </div>

                        {/* Group members by section */}
                        {sections.map((section) => (
                          <div
                            key={section.sectionid}
                            className="mb-6"
                            data-oid="-omft3z"
                          >
                            <div
                              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                              data-oid="vtnl59a"
                            >
                              <div
                                className="bg-gray-50 px-4 py-3 border-b border-gray-200"
                                data-oid="30ulruv"
                              >
                                <h4
                                  className="font-medium text-gray-900 flex items-center gap-2"
                                  data-oid="qtx3j_k"
                                >
                                  {section.sectionname}
                                  <div
                                    className="flex gap-1"
                                    data-oid="8tcl0ps"
                                  >
                                    <Badge
                                      variant="scout-green"
                                      size="sm"
                                      data-oid="pfssni7"
                                    >
                                      {section.youngPeopleCount} YP
                                    </Badge>
                                    <Badge
                                      variant="scout-purple"
                                      size="sm"
                                      data-oid="3kqc.p8"
                                    >
                                      {section.adultsCount} Adults
                                    </Badge>
                                  </div>
                                </h4>
                              </div>

                              <div className="p-4" data-oid="u.4s_ya">
                                <div
                                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                                  data-oid="mt7llx6"
                                >
                                  {section.members.map(
                                    (member, memberIndex) => (
                                      <div
                                        key={member.scoutid || memberIndex}
                                        className="p-3 bg-gray-50 rounded-lg flex justify-between items-center"
                                        data-oid="xmhg8ds"
                                      >
                                        <div
                                          className="text-sm font-medium text-gray-900 min-w-0 flex-1 mr-2"
                                          data-oid=".og2nel"
                                        >
                                          {member.firstname} {member.lastname}
                                        </div>
                                        <div
                                          className="text-xs text-gray-500 font-mono flex-shrink-0"
                                          data-oid="q7zcuh_"
                                        >
                                          {member.age || "N/A"}
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-8" data-oid="0yts54a">
                  <p className="text-gray-600" data-oid="r4cwunm">
                    No shared attendance data available
                  </p>
                  <Button
                    variant="scout-blue"
                    onClick={loadSharedAttendanceData}
                    className="mt-4"
                    type="button"
                    data-oid="iq.1fqf"
                  >
                    Load Shared Attendance
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Member Detail Modal */}
      <MemberDetailModal
        member={selectedMember}
        isOpen={showMemberModal}
        onClose={handleModalClose}
        data-oid="rr6j0he"
      />
    </div>
  );
}

export default AttendanceView;
