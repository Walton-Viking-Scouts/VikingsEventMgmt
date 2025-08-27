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
        <span className="ml-1 text-gray-400" data-oid="t3nxu8_">
          <svg
            className="w-4 h-4 inline"
            fill="currentColor"
            viewBox="0 0 20 20"
            data-oid="f3wn0b_"
          >
            <path d="M5 12l5-5 5 5H5z" data-oid="e046u0_" />
            <path d="M5 8l5 5 5-5H5z" data-oid="4yp41.c" />
          </svg>
        </span>
      );
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-scout-blue" data-oid="szp241z">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="m3qpip6"
        >
          <path d="M5 12l5-5 5 5H5z" data-oid="439nh:t" />
        </svg>
      </span>
    ) : (
      <span className="ml-1 text-scout-blue" data-oid="xef.p3q">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="7clwq1l"
        >
          <path d="M5 8l5 5 5-5H5z" data-oid="0ciw0uf" />
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
    return <LoadingScreen message="Loading attendance..." data-oid="y8xibo-" />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4" data-oid="y2:m3hi">
        <Alert.Title data-oid="f8s:shm">Error Loading Attendance</Alert.Title>
        <Alert.Description data-oid="qek4.-a">{error}</Alert.Description>
        <Alert.Actions data-oid="2dtmqzr">
          <Button
            variant="scout-blue"
            onClick={() => window.location.reload()}
            type="button"
            data-oid="ztvoph8"
          >
            Retry
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  if (!attendanceData || attendanceData.length === 0) {
    return (
      <Card className="m-4" data-oid="lmkn-cy">
        <Card.Header data-oid="kb9s51q">
          <Card.Title data-oid="xpqu33k">No Attendance Data</Card.Title>
          <Button
            variant="outline-scout-blue"
            onClick={onBack}
            type="button"
            data-oid="me4ey3."
          >
            Back to Dashboard
          </Button>
        </Card.Header>
        <Card.Body data-oid="4l3ya0v">
          <p className="text-gray-600" data-oid="8lw2da2">
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
    <div data-oid="acqs:n3">
      {/* Attendance Data Card */}
      <Card className="m-4" data-oid="uv1k8h_">
        <Card.Header data-oid="kaxxm17">
          <Card.Title data-oid="39e9uj9">
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
                    data-oid="1kh8zqv"
                  >
                    ({filteredForCount.length} of {attendanceData.length}{" "}
                    records)
                  </span>
                )
              );
            })()}
          </Card.Title>
          <div className="flex gap-2 items-center flex-wrap" data-oid="ugl_l7k">
            <Button
              variant="outline-scout-blue"
              onClick={onBack}
              type="button"
              data-oid="oxc82fg"
            >
              Back to Dashboard
            </Button>
            {attendanceData.length > 0 && (
              <div className="flex flex-col gap-3" data-oid="kbffjgn">
                <CompactAttendanceFilter
                  filters={attendanceFilters}
                  onFiltersChange={setAttendanceFilters}
                  data-oid=".rx558n"
                />

                {uniqueSections.length > 1 && (
                  <SectionFilter
                    sectionFilters={sectionFilters}
                    onFiltersChange={setSectionFilters}
                    sections={uniqueSections}
                    data-oid="3fxsk8x"
                  />
                )}
              </div>
            )}
          </div>
        </Card.Header>

        <Card.Body data-oid="qzrjpqu">
          {/* View toggle */}
          <div className="border-b border-gray-200 mb-6" data-oid="z38_opr">
            <nav className="-mb-px flex space-x-8" data-oid="wrg:76l">
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === "overview"
                    ? "border-scout-blue text-scout-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setViewMode("overview")}
                type="button"
                data-oid="0c-cc-z"
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
                data-oid="cyyw5tz"
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
                data-oid="ko6t74b"
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
                data-oid="innehor"
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
                  data-oid=".4r9p6i"
                >
                  Shared Attendance
                </button>
              )}
            </nav>
          </div>

          {/* Overview Tab - Attendance Summary */}
          {viewMode === "overview" && members && members.length > 0 && (
            <div className="overflow-x-auto" data-oid="p_ft1.8">
              <div className="flex gap-2 items-center mb-4" data-oid="sozkf-w">
                <Badge variant="scout-green" data-oid="g4f0azi">
                  {simplifiedSummaryStats.totals.total.total} total responses
                </Badge>
              </div>
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="k7b1-7g"
              >
                <thead className="bg-gray-50" data-oid="6fg_sey">
                  <tr data-oid="vo03vah">
                    <th
                      className="px-3 py-2 text-left table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="qk6rt40"
                    >
                      Section
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-green-600 uppercase tracking-wider"
                      data-oid="9x5.k41"
                    >
                      <div data-oid="wf-336s">Yes</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="c:w:ocr"
                      >
                        <span className="w-8 text-center" data-oid="4:_13bh">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="9jbry7c">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="frc1fif">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="nzew-hc">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-red-600 uppercase tracking-wider"
                      data-oid="llj3d5n"
                    >
                      <div data-oid="38:dg5r">No</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="ms7wlau"
                      >
                        <span className="w-8 text-center" data-oid="6n6ov6s">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid=".5z:0h.">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="73v-34:">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="za_o7z4">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-yellow-600 uppercase tracking-wider"
                      data-oid="5vpy1nf"
                    >
                      <div data-oid="g2c0.ea">Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="njsulvo"
                      >
                        <span className="w-8 text-center" data-oid="qqj99yn">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="j1.0cu3">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="a5acdnd">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="uiir-gc">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-600 uppercase tracking-wider"
                      data-oid="ug:.gep"
                    >
                      <div data-oid="95ae8-v">Not Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="9d8:-35"
                      >
                        <span className="w-8 text-center" data-oid="ldp9heq">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="f.yjaqa">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid=":x-7l4u">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="jdr.v8q">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="e2-1mlb"
                    >
                      <div data-oid="23kj4i9">Total</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="myr5m8k"
                      >
                        <span className="w-8 text-center" data-oid="wn:1tt8">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="a69:i.k">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="q9kycoc">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="871i2:0">
                          Total
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="cf9w2so"
                >
                  {simplifiedSummaryStats.sections.map((section, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50"
                      data-oid="y128kp-"
                    >
                      <td
                        className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                        data-oid="7jrgci5"
                      >
                        {section.name}
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold"
                        data-oid="p84t0k6"
                      >
                        <div className="flex justify-center" data-oid="y61hwmu">
                          <span className="w-8 text-center" data-oid="aovsu4v">
                            {section.yes.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="qu2zd0t">
                            {section.yes.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="e4t.-4r">
                            {section.yes.l}
                          </span>
                          <span className="w-12 text-center" data-oid=":bq1:2l">
                            {section.yes.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold"
                        data-oid="kg-4nkz"
                      >
                        <div className="flex justify-center" data-oid="p16yo4y">
                          <span className="w-8 text-center" data-oid="5kud8fl">
                            {section.no.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="4pvuro7">
                            {section.no.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="x0g._s-">
                            {section.no.l}
                          </span>
                          <span className="w-12 text-center" data-oid="b8u3v5d">
                            {section.no.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold"
                        data-oid="0whuqrn"
                      >
                        <div className="flex justify-center" data-oid="60v0ybk">
                          <span className="w-8 text-center" data-oid="prst-67">
                            {section.invited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="-m6g3cn">
                            {section.invited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="484.ayq">
                            {section.invited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="pizarkw">
                            {section.invited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                        data-oid="gorqkb_"
                      >
                        <div className="flex justify-center" data-oid="k7624ki">
                          <span className="w-8 text-center" data-oid="uhvpj-n">
                            {section.notInvited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="5luk5k1">
                            {section.notInvited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="hd_xvs9">
                            {section.notInvited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="f964jdd">
                            {section.notInvited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                        data-oid="afhcfyn"
                      >
                        <div className="flex justify-center" data-oid="r-x.rse">
                          <span className="w-8 text-center" data-oid="_znm8kg">
                            {section.total.yp}
                          </span>
                          <span className="w-8 text-center" data-oid=":kr2.5z">
                            {section.total.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="9r11_7b">
                            {section.total.l}
                          </span>
                          <span className="w-12 text-center" data-oid="1-jkqlo">
                            {section.total.total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-semibold" data-oid="ebp7vfl">
                    <td
                      className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                      data-oid="4g-q4gh"
                    >
                      Total
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold"
                      data-oid="zwa-mfi"
                    >
                      <div className="flex justify-center" data-oid="rg:lb_t">
                        <span className="w-8 text-center" data-oid="ji41mwr">
                          {simplifiedSummaryStats.totals.yes.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="1ur0175">
                          {simplifiedSummaryStats.totals.yes.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="py8t.8e">
                          {simplifiedSummaryStats.totals.yes.l}
                        </span>
                        <span className="w-12 text-center" data-oid="a3f1hzg">
                          {simplifiedSummaryStats.totals.yes.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold"
                      data-oid="26dc5my"
                    >
                      <div className="flex justify-center" data-oid="o6p0lc5">
                        <span className="w-8 text-center" data-oid="639275a">
                          {simplifiedSummaryStats.totals.no.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="734xj_z">
                          {simplifiedSummaryStats.totals.no.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="0_j__dt">
                          {simplifiedSummaryStats.totals.no.l}
                        </span>
                        <span className="w-12 text-center" data-oid="gg4zsr9">
                          {simplifiedSummaryStats.totals.no.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold"
                      data-oid="--2.5w1"
                    >
                      <div className="flex justify-center" data-oid="fk2e01r">
                        <span className="w-8 text-center" data-oid="vqjj3tf">
                          {simplifiedSummaryStats.totals.invited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="nt:3n9z">
                          {simplifiedSummaryStats.totals.invited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="f4wgkn9">
                          {simplifiedSummaryStats.totals.invited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="7gc_2yf">
                          {simplifiedSummaryStats.totals.invited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                      data-oid="5t9cc5q"
                    >
                      <div className="flex justify-center" data-oid="axx_xz_">
                        <span className="w-8 text-center" data-oid="h9iwkfc">
                          {simplifiedSummaryStats.totals.notInvited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid=":oa8j00">
                          {simplifiedSummaryStats.totals.notInvited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="f57th0:">
                          {simplifiedSummaryStats.totals.notInvited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="o115tsd">
                          {simplifiedSummaryStats.totals.notInvited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                      data-oid="n8:ipth"
                    >
                      <div className="flex justify-center" data-oid="-7l4q59">
                        <span className="w-8 text-center" data-oid="a29igmq">
                          {simplifiedSummaryStats.totals.total.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="o2pp5d.">
                          {simplifiedSummaryStats.totals.total.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="qn6s9g_">
                          {simplifiedSummaryStats.totals.total.l}
                        </span>
                        <span className="w-12 text-center" data-oid="10b70sa">
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
            <div className="text-center py-12" data-oid="v2tk2l8">
              <div className="text-gray-500 mb-4" data-oid="918fi-o">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  data-oid="lefqjpk"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    data-oid="9wbd4_g"
                  />
                </svg>
              </div>
              <h3
                className="text-lg font-semibold text-gray-900 mb-2"
                data-oid="xwca5qy"
              >
                No Records Match Filters
              </h3>
              <p className="text-gray-600 mb-4" data-oid="hn7_teb">
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
                data-oid=".3fja-w"
              >
                Show All Records
              </Button>
            </div>
          ) : (
            viewMode === "register" && (
              <div className="overflow-x-auto" data-oid="6m2gq-8">
                <table
                  className="min-w-full divide-y divide-gray-200"
                  data-oid=".:0x:og"
                >
                  <thead className="bg-gray-50" data-oid="1q3r3k5">
                    <tr data-oid="eb7-sfd">
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("member")}
                        data-oid="k4a-p01"
                      >
                        <div className="flex items-center" data-oid="sfam728">
                          Member {getSortIcon("member")}
                        </div>
                      </th>
                      <th
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="obpxhuu"
                      >
                        Actions
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("attendance")}
                        data-oid="6-3_umx"
                      >
                        <div className="flex items-center" data-oid="8p2knj9">
                          Status {getSortIcon("attendance")}
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid=":-tuwos"
                      >
                        Camp Group
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="bly4c4t"
                      >
                        Signed In
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid=".ujt3ja"
                      >
                        Signed Out
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className="bg-white divide-y divide-gray-200"
                    data-oid="cxr7:ye"
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
                          data-oid="xqdax6."
                        >
                          <td className="px-3 py-2" data-oid="egp85r9">
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
                              data-oid="97b421i"
                            >
                              {member.name}
                            </button>
                          </td>
                          <td
                            className="px-2 py-2 text-center"
                            data-oid="_ioxs3y"
                          >
                            <SignInOutButton
                              member={member}
                              onSignInOut={handleSignInOut}
                              loading={buttonLoading?.[member.scoutid] || false}
                              data-oid="s-x0odg"
                            />
                          </td>
                          <td
                            className="px-3 py-2 whitespace-nowrap"
                            data-oid="56dekl6"
                          >
                            <div
                              className="flex gap-1 flex-wrap"
                              data-oid="arny4no"
                            >
                              {member.yes > 0 && (
                                <Badge
                                  variant="scout-green"
                                  className="text-xs"
                                  data-oid="k177v8k"
                                >
                                  Yes
                                </Badge>
                              )}
                              {member.no > 0 && (
                                <Badge
                                  variant="scout-red"
                                  className="text-xs"
                                  data-oid="kimkt7c"
                                >
                                  No
                                </Badge>
                              )}
                              {member.invited > 0 && (
                                <Badge
                                  variant="scout-blue"
                                  className="text-xs"
                                  data-oid="civzay7"
                                >
                                  Invited
                                </Badge>
                              )}
                              {member.notInvited > 0 && (
                                <Badge
                                  variant="light"
                                  className="text-xs"
                                  data-oid="g1o9sid"
                                >
                                  Not Invited
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-3 py-2 whitespace-nowrap text-xs text-gray-900"
                            data-oid="_fj_f:q"
                          >
                            {member.vikingEventData?.CampGroup || "-"}
                          </td>
                          <td className="px-3 py-2 text-xs" data-oid="ofv0.03">
                            {member.vikingEventData?.SignedInBy ||
                            member.vikingEventData?.SignedInWhen ? (
                              <div className="space-y-0.5" data-oid="e:kjz:0">
                                <div
                                  className="text-gray-900 font-medium leading-tight"
                                  data-oid="7e-qm1t"
                                >
                                  {member.vikingEventData?.SignedInBy || "-"}
                                </div>
                                <div
                                  className="text-gray-500 text-xs leading-tight"
                                  data-oid="0nupj:9"
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
                                data-oid="lholc9y"
                              >
                                -
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs" data-oid="uobpqok">
                            {member.vikingEventData?.SignedOutBy ||
                            member.vikingEventData?.SignedOutWhen ? (
                              <div className="space-y-0.5" data-oid="acf078k">
                                <div
                                  className="text-gray-900 font-medium leading-tight"
                                  data-oid="ej7vb61"
                                >
                                  {member.vikingEventData?.SignedOutBy || "-"}
                                </div>
                                <div
                                  className="text-gray-500 text-xs leading-tight"
                                  data-oid="exugkyb"
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
                                data-oid="h-1lwp-"
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
            <div className="overflow-x-auto" data-oid=":-nunec">
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="onli3ga"
              >
                <thead className="bg-gray-50" data-oid="k1jxyvn">
                  <tr data-oid="gqw92lg">
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("member")}
                      data-oid="09bg9gf"
                    >
                      <div className="flex items-center" data-oid="whhs4wt">
                        Member {getSortIcon("member")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("section")}
                      data-oid="spto3rc"
                    >
                      <div className="flex items-center" data-oid="8t.s-45">
                        Section {getSortIcon("section")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("attendance")}
                      data-oid="cdojyh6"
                    >
                      <div className="flex items-center" data-oid="yiszt:f">
                        Attendance {getSortIcon("attendance")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="rtiens."
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
                        data-oid="6le590z"
                      >
                        <td
                          className="px-6 py-2 whitespace-nowrap"
                          data-oid="fv4xexh"
                        >
                          <button
                            onClick={() => handleMemberClick(record)}
                            className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left text-xs"
                            data-oid="gpjhg-l"
                          >
                            {record.firstname} {record.lastname}
                          </button>
                        </td>
                        <td
                          className="px-6 py-2 whitespace-nowrap text-gray-900 text-xs"
                          data-oid="xjr8bj-"
                        >
                          {record.sectionname}
                        </td>
                        <td
                          className="px-6 py-2 whitespace-nowrap"
                          data-oid="f8ugplv"
                        >
                          <Badge variant={badgeVariant} data-oid="nue-_hj">
                            {statusText}
                          </Badge>
                          {record.attending &&
                            record.attending !== statusText && (
                              <div
                                className="text-gray-500 text-xs mt-1"
                                data-oid="f5_8hoa"
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
              data-oid="xgvnx4z"
            />
          )}

          {viewMode === "sharedAttendance" && (
            <div data-oid="5mmsjug">
              {loadingSharedAttendance ? (
                <div className="text-center py-8" data-oid="hi.53nn">
                  <div
                    className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-scout-blue"
                    data-oid="5js3kd:"
                  ></div>
                  <p className="mt-2 text-gray-600" data-oid="qq89ivg">
                    Loading shared attendance data...
                  </p>
                </div>
              ) : sharedAttendanceData?.error ? (
                <Alert variant="danger" data-oid="5tq2q:q">
                  <Alert.Title data-oid="6dj3zcx">
                    Error Loading Shared Attendance
                  </Alert.Title>
                  <Alert.Description data-oid="4dd7tn8">
                    {sharedAttendanceData.error}
                  </Alert.Description>
                  <Alert.Actions data-oid="482d1iu">
                    <Button
                      variant="scout-blue"
                      onClick={loadSharedAttendanceData}
                      type="button"
                      data-oid="ct6i4cp"
                    >
                      Retry
                    </Button>
                  </Alert.Actions>
                </Alert>
              ) : sharedAttendanceData?.items ? (
                <div data-oid="md_pjhd">
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
                          data-oid="7rvfrm-"
                        >
                          <h3
                            className="text-lg font-semibold text-gray-900 mb-2"
                            data-oid="a8eh43s"
                          >
                            Combined Attendance Summary
                          </h3>
                          <div
                            className="flex flex-wrap gap-3"
                            data-oid="q_2c3d8"
                          >
                            <Badge
                              variant="scout-blue"
                              size="md"
                              data-oid="7osc_jy"
                            >
                              {totalMembers} Total
                            </Badge>
                            <Badge
                              variant="scout-green"
                              size="md"
                              data-oid="6k1xnw1"
                            >
                              {totalYoungPeople} Young People
                            </Badge>
                            <Badge
                              variant="scout-purple"
                              size="md"
                              data-oid=":-hq07d"
                            >
                              {totalAdults} Adults
                            </Badge>
                            <Badge variant="light" size="md" data-oid="s7v.ez8">
                              {sections.length} Sections
                            </Badge>
                          </div>
                        </div>

                        {/* Group members by section */}
                        {sections.map((section) => (
                          <div
                            key={section.sectionid}
                            className="mb-6"
                            data-oid="8by4glb"
                          >
                            <div
                              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                              data-oid="y7z033p"
                            >
                              <div
                                className="bg-gray-50 px-4 py-3 border-b border-gray-200"
                                data-oid="wip1mlg"
                              >
                                <h4
                                  className="font-medium text-gray-900 flex items-center gap-2"
                                  data-oid="8h5dy7q"
                                >
                                  {section.sectionname}
                                  <div
                                    className="flex gap-1"
                                    data-oid="_5v0.w9"
                                  >
                                    <Badge
                                      variant="scout-green"
                                      size="sm"
                                      data-oid="7_-4w6n"
                                    >
                                      {section.youngPeopleCount} YP
                                    </Badge>
                                    <Badge
                                      variant="scout-purple"
                                      size="sm"
                                      data-oid="lp8ur3u"
                                    >
                                      {section.adultsCount} Adults
                                    </Badge>
                                  </div>
                                </h4>
                              </div>

                              <div className="p-4" data-oid="is3:8bh">
                                <div
                                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                                  data-oid="ico0-.c"
                                >
                                  {section.members.map(
                                    (member, memberIndex) => (
                                      <div
                                        key={member.scoutid || memberIndex}
                                        className="p-3 bg-gray-50 rounded-lg flex justify-between items-center"
                                        data-oid="lrysvt."
                                      >
                                        <div
                                          className="text-sm font-medium text-gray-900 min-w-0 flex-1 mr-2"
                                          data-oid="6lj5.t2"
                                        >
                                          {member.firstname} {member.lastname}
                                        </div>
                                        <div
                                          className="text-xs text-gray-500 font-mono flex-shrink-0"
                                          data-oid="cxcd_my"
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
                <div className="text-center py-8" data-oid="8e0..p3">
                  <p className="text-gray-600" data-oid="x0ybm0e">
                    No shared attendance data available
                  </p>
                  <Button
                    variant="scout-blue"
                    onClick={loadSharedAttendanceData}
                    className="mt-4"
                    type="button"
                    data-oid=".jw33ij"
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
        data-oid="au5ueoj"
      />
    </div>
  );
}

export default AttendanceView;
