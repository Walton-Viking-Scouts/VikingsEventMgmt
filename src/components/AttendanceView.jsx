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
        <span className="ml-1 text-gray-400" data-oid="aka9v0:">
          <svg
            className="w-4 h-4 inline"
            fill="currentColor"
            viewBox="0 0 20 20"
            data-oid="-j8mmrn"
          >
            <path d="M5 12l5-5 5 5H5z" data-oid="f:iheoa" />
            <path d="M5 8l5 5 5-5H5z" data-oid="tmfkayt" />
          </svg>
        </span>
      );
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-scout-blue" data-oid="2cis:ki">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="ch.dk_f"
        >
          <path d="M5 12l5-5 5 5H5z" data-oid="fsp57au" />
        </svg>
      </span>
    ) : (
      <span className="ml-1 text-scout-blue" data-oid="uz8q0lw">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="glviugq"
        >
          <path d="M5 8l5 5 5-5H5z" data-oid="37o2ddd" />
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
    return <LoadingScreen message="Loading attendance..." data-oid="-8m8xsf" />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4" data-oid="t0hy66o">
        <Alert.Title data-oid="r:obedr">Error Loading Attendance</Alert.Title>
        <Alert.Description data-oid="03fxelk">{error}</Alert.Description>
        <Alert.Actions data-oid="bblg825">
          <Button
            variant="scout-blue"
            onClick={() => window.location.reload()}
            type="button"
            data-oid="8::6lx8"
          >
            Retry
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  if (!attendanceData || attendanceData.length === 0) {
    return (
      <Card className="m-4" data-oid="ewt0a:k">
        <Card.Header data-oid="ukat2ml">
          <Card.Title data-oid="95lllsw">No Attendance Data</Card.Title>
          <Button
            variant="outline-scout-blue"
            onClick={onBack}
            type="button"
            data-oid="xoi4vze"
          >
            Back to Dashboard
          </Button>
        </Card.Header>
        <Card.Body data-oid="hx1u485">
          <p className="text-gray-600" data-oid="4--s6m5">
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
    <div data-oid="x:rige0">
      {/* Attendance Data Card */}
      <Card className="m-4" data-oid="aq0uhqg">
        <Card.Header data-oid=".y4h79z">
          <Card.Title data-oid="6ao8ck6">
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
                    data-oid="9d1t8sk"
                  >
                    ({filteredForCount.length} of {attendanceData.length}{" "}
                    records)
                  </span>
                )
              );
            })()}
          </Card.Title>
          <div className="flex gap-2 items-center flex-wrap" data-oid="8c7xnkv">
            <Button
              variant="outline-scout-blue"
              onClick={onBack}
              type="button"
              data-oid="4wqhfyt"
            >
              Back to Dashboard
            </Button>
            {attendanceData.length > 0 && (
              <div className="flex flex-col gap-3" data-oid="r9zctei">
                <CompactAttendanceFilter
                  filters={attendanceFilters}
                  onFiltersChange={setAttendanceFilters}
                  data-oid=":amoydg"
                />

                {uniqueSections.length > 1 && (
                  <SectionFilter
                    sectionFilters={sectionFilters}
                    onFiltersChange={setSectionFilters}
                    sections={uniqueSections}
                    data-oid="ckfzgb7"
                  />
                )}
              </div>
            )}
          </div>
        </Card.Header>

        <Card.Body data-oid="g:osqg5">
          {/* View toggle */}
          <div className="border-b border-gray-200 mb-6" data-oid="5-d7tqy">
            <nav className="-mb-px flex space-x-8" data-oid="_kz4mpn">
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === "overview"
                    ? "border-scout-blue text-scout-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setViewMode("overview")}
                type="button"
                data-oid="app:z5h"
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
                data-oid="l22osne"
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
                data-oid="92vwp::"
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
                data-oid="efjz02o"
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
                  data-oid="hr-p1c2"
                >
                  Shared Attendance
                </button>
              )}
            </nav>
          </div>

          {/* Overview Tab - Attendance Summary */}
          {viewMode === "overview" && members && members.length > 0 && (
            <div className="overflow-x-auto" data-oid="tkqadm2">
              <div className="flex gap-2 items-center mb-4" data-oid="3z-_uot">
                <Badge variant="scout-green" data-oid=":frapue">
                  {simplifiedSummaryStats.totals.total.total} total responses
                </Badge>
              </div>
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="t8rld2_"
              >
                <thead className="bg-gray-50" data-oid="1w0cs9l">
                  <tr data-oid="cncb0lc">
                    <th
                      className="px-3 py-2 text-left table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="c1_xtq4"
                    >
                      Section
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-green-600 uppercase tracking-wider"
                      data-oid="4rsn__v"
                    >
                      <div data-oid="sekmb.c">Yes</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="kij_0mc"
                      >
                        <span className="w-8 text-center" data-oid="3librye">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="w_d8i7u">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="0ygsd.8">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="qx1kklo">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-red-600 uppercase tracking-wider"
                      data-oid=":_hb860"
                    >
                      <div data-oid=".aw.w:f">No</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="6m42i9i"
                      >
                        <span className="w-8 text-center" data-oid="y5ff9hj">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="xna8jnw">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="ekovyse">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="puz9c8t">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-yellow-600 uppercase tracking-wider"
                      data-oid="am67jn4"
                    >
                      <div data-oid="hw-nzv1">Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="yv82vdf"
                      >
                        <span className="w-8 text-center" data-oid="uzb47yg">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="1tg2_l9">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="tx4jtae">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="smilx4s">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-600 uppercase tracking-wider"
                      data-oid="uk:dlom"
                    >
                      <div data-oid="r0dx3pw">Not Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="bwcusoc"
                      >
                        <span className="w-8 text-center" data-oid="7s0-efl">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="mkp6v51">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="r065yq1">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="fgoyi87">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="bemwezf"
                    >
                      <div data-oid="e:e9k6m">Total</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="m-0e7ds"
                      >
                        <span className="w-8 text-center" data-oid="brjkx:5">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="5v7-dp.">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="kil09a7">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid=":b4ti_1">
                          Total
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid=":duw39n"
                >
                  {simplifiedSummaryStats.sections.map((section, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50"
                      data-oid="pvd54.u"
                    >
                      <td
                        className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                        data-oid="hvgi_tq"
                      >
                        {section.name}
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold"
                        data-oid="or2g8u0"
                      >
                        <div className="flex justify-center" data-oid="7ug2:e7">
                          <span className="w-8 text-center" data-oid="6925lg2">
                            {section.yes.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="g7wdq4h">
                            {section.yes.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="6nn7oz2">
                            {section.yes.l}
                          </span>
                          <span className="w-12 text-center" data-oid="-r1nmd-">
                            {section.yes.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold"
                        data-oid="snw3:o8"
                      >
                        <div className="flex justify-center" data-oid="6j9c9_.">
                          <span className="w-8 text-center" data-oid="w-7nz85">
                            {section.no.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="0lds05h">
                            {section.no.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="0soxec7">
                            {section.no.l}
                          </span>
                          <span className="w-12 text-center" data-oid="3g65av1">
                            {section.no.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold"
                        data-oid="68w0m:."
                      >
                        <div className="flex justify-center" data-oid="x7qkor_">
                          <span className="w-8 text-center" data-oid=":bl:e24">
                            {section.invited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="8q2f9ct">
                            {section.invited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="k1.4si3">
                            {section.invited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="1al.lgm">
                            {section.invited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                        data-oid="ry8iw0f"
                      >
                        <div className="flex justify-center" data-oid=".3_a47o">
                          <span className="w-8 text-center" data-oid="_1srqwm">
                            {section.notInvited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="tvvjtsf">
                            {section.notInvited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="ozr2mpi">
                            {section.notInvited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="r0qh-9n">
                            {section.notInvited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                        data-oid="i25121:"
                      >
                        <div className="flex justify-center" data-oid="04e1k4q">
                          <span className="w-8 text-center" data-oid="a3tsbfq">
                            {section.total.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="gmfadkl">
                            {section.total.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="syvm5h.">
                            {section.total.l}
                          </span>
                          <span className="w-12 text-center" data-oid="cwb-5bc">
                            {section.total.total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-semibold" data-oid="7_h:1h-">
                    <td
                      className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                      data-oid="ybve03m"
                    >
                      Total
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold"
                      data-oid=".l6l3:n"
                    >
                      <div className="flex justify-center" data-oid="zpvi2hk">
                        <span className="w-8 text-center" data-oid="3hi.7_v">
                          {simplifiedSummaryStats.totals.yes.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="29pne5c">
                          {simplifiedSummaryStats.totals.yes.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="_.j._-y">
                          {simplifiedSummaryStats.totals.yes.l}
                        </span>
                        <span className="w-12 text-center" data-oid="whrlg22">
                          {simplifiedSummaryStats.totals.yes.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold"
                      data-oid="cv:x88k"
                    >
                      <div className="flex justify-center" data-oid="slv4j0e">
                        <span className="w-8 text-center" data-oid="aukls74">
                          {simplifiedSummaryStats.totals.no.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="nwby6a-">
                          {simplifiedSummaryStats.totals.no.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="7xmqduu">
                          {simplifiedSummaryStats.totals.no.l}
                        </span>
                        <span className="w-12 text-center" data-oid="1c-rco0">
                          {simplifiedSummaryStats.totals.no.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold"
                      data-oid="1w:xkhu"
                    >
                      <div className="flex justify-center" data-oid="90t4ear">
                        <span className="w-8 text-center" data-oid="911x-w2">
                          {simplifiedSummaryStats.totals.invited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="7zh0mr0">
                          {simplifiedSummaryStats.totals.invited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="zb-qco:">
                          {simplifiedSummaryStats.totals.invited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="u6j6.34">
                          {simplifiedSummaryStats.totals.invited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                      data-oid="zkaohv1"
                    >
                      <div className="flex justify-center" data-oid=".cbw3dc">
                        <span className="w-8 text-center" data-oid=":8cwqro">
                          {simplifiedSummaryStats.totals.notInvited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="cgtox:m">
                          {simplifiedSummaryStats.totals.notInvited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="rhxt5t7">
                          {simplifiedSummaryStats.totals.notInvited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="d:ec2:s">
                          {simplifiedSummaryStats.totals.notInvited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                      data-oid="miv_0lb"
                    >
                      <div className="flex justify-center" data-oid="gmyi-54">
                        <span className="w-8 text-center" data-oid="9bu2iq0">
                          {simplifiedSummaryStats.totals.total.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="vp:ff-r">
                          {simplifiedSummaryStats.totals.total.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="z62ynl8">
                          {simplifiedSummaryStats.totals.total.l}
                        </span>
                        <span className="w-12 text-center" data-oid="b:m_oni">
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
            <div className="text-center py-12" data-oid="hzpizz1">
              <div className="text-gray-500 mb-4" data-oid="5x_uav3">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  data-oid="v5c8dfg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    data-oid="4hq0hug"
                  />
                </svg>
              </div>
              <h3
                className="text-lg font-semibold text-gray-900 mb-2"
                data-oid="tvs2enz"
              >
                No Records Match Filters
              </h3>
              <p className="text-gray-600 mb-4" data-oid="5k6z7cd">
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
                data-oid="_n0stuu"
              >
                Show All Records
              </Button>
            </div>
          ) : (
            viewMode === "register" && (
              <div className="overflow-x-auto" data-oid="1xabvlv">
                <table
                  className="min-w-full divide-y divide-gray-200"
                  data-oid="dr0haej"
                >
                  <thead className="bg-gray-50" data-oid="6.xdkjh">
                    <tr data-oid="7.us3j_">
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("member")}
                        data-oid="hwmb5.l"
                      >
                        <div className="flex items-center" data-oid="ibwblpb">
                          Member {getSortIcon("member")}
                        </div>
                      </th>
                      <th
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="ezobk27"
                      >
                        Actions
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("attendance")}
                        data-oid="14ejnmn"
                      >
                        <div className="flex items-center" data-oid="zwaj11h">
                          Status {getSortIcon("attendance")}
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="xrxj0j1"
                      >
                        Camp Group
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid=":qwj0ky"
                      >
                        Signed In
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="ebul_ay"
                      >
                        Signed Out
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className="bg-white divide-y divide-gray-200"
                    data-oid="0kicn.g"
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
                          data-oid="anb3dms"
                        >
                          <td className="px-3 py-2" data-oid="i:eqyl4">
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
                              data-oid="6fam_v7"
                            >
                              {member.name}
                            </button>
                          </td>
                          <td
                            className="px-2 py-2 text-center"
                            data-oid="qh6:b1o"
                          >
                            <SignInOutButton
                              member={member}
                              onSignInOut={handleSignInOut}
                              loading={buttonLoading?.[member.scoutid] || false}
                              data-oid="8u9y-sp"
                            />
                          </td>
                          <td
                            className="px-3 py-2 whitespace-nowrap"
                            data-oid="o2_pjpn"
                          >
                            <div
                              className="flex gap-1 flex-wrap"
                              data-oid="_a3uvf5"
                            >
                              {member.yes > 0 && (
                                <Badge
                                  variant="scout-green"
                                  className="text-xs"
                                  data-oid="6puj-n."
                                >
                                  Yes
                                </Badge>
                              )}
                              {member.no > 0 && (
                                <Badge
                                  variant="scout-red"
                                  className="text-xs"
                                  data-oid="zyrs77b"
                                >
                                  No
                                </Badge>
                              )}
                              {member.invited > 0 && (
                                <Badge
                                  variant="scout-blue"
                                  className="text-xs"
                                  data-oid="5mng14y"
                                >
                                  Invited
                                </Badge>
                              )}
                              {member.notInvited > 0 && (
                                <Badge
                                  variant="light"
                                  className="text-xs"
                                  data-oid="mi:q_9h"
                                >
                                  Not Invited
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-3 py-2 whitespace-nowrap text-xs text-gray-900"
                            data-oid="32eab7r"
                          >
                            {member.vikingEventData?.CampGroup || "-"}
                          </td>
                          <td className="px-3 py-2 text-xs" data-oid="7vzywcz">
                            {member.vikingEventData?.SignedInBy ||
                            member.vikingEventData?.SignedInWhen ? (
                              <div className="space-y-0.5" data-oid="orh6_l6">
                                <div
                                  className="text-gray-900 font-medium leading-tight"
                                  data-oid="0qug1c9"
                                >
                                  {member.vikingEventData?.SignedInBy || "-"}
                                </div>
                                <div
                                  className="text-gray-500 text-xs leading-tight"
                                  data-oid="nf6jbix"
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
                                data-oid="8ydkn9a"
                              >
                                -
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs" data-oid="d0nmrcf">
                            {member.vikingEventData?.SignedOutBy ||
                            member.vikingEventData?.SignedOutWhen ? (
                              <div className="space-y-0.5" data-oid="9x-imdd">
                                <div
                                  className="text-gray-900 font-medium leading-tight"
                                  data-oid="kx5:ahb"
                                >
                                  {member.vikingEventData?.SignedOutBy || "-"}
                                </div>
                                <div
                                  className="text-gray-500 text-xs leading-tight"
                                  data-oid="o2qafgh"
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
                                data-oid="o_mtfr4"
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
            <div className="overflow-x-auto" data-oid="v87y7:c">
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="u9xd:wg"
              >
                <thead className="bg-gray-50" data-oid="ze4gm4h">
                  <tr data-oid="k8_j4ul">
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("member")}
                      data-oid="8utenj7"
                    >
                      <div className="flex items-center" data-oid="35b3d9v">
                        Member {getSortIcon("member")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("section")}
                      data-oid="84ez0cv"
                    >
                      <div className="flex items-center" data-oid="-mn:or5">
                        Section {getSortIcon("section")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("attendance")}
                      data-oid="nsnkqa5"
                    >
                      <div className="flex items-center" data-oid="wnpk6yb">
                        Attendance {getSortIcon("attendance")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="mkgk0p1"
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
                        data-oid="uz65qv2"
                      >
                        <td
                          className="px-6 py-2 whitespace-nowrap"
                          data-oid="x83c39o"
                        >
                          <button
                            onClick={() => handleMemberClick(record)}
                            className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left text-xs"
                            data-oid="6uq:uqu"
                          >
                            {record.firstname} {record.lastname}
                          </button>
                        </td>
                        <td
                          className="px-6 py-2 whitespace-nowrap text-gray-900 text-xs"
                          data-oid="hwwqhy2"
                        >
                          {record.sectionname}
                        </td>
                        <td
                          className="px-6 py-2 whitespace-nowrap"
                          data-oid="hx:ow_g"
                        >
                          <Badge variant={badgeVariant} data-oid="r:.hf_5">
                            {statusText}
                          </Badge>
                          {record.attending &&
                            record.attending !== statusText && (
                              <div
                                className="text-gray-500 text-xs mt-1"
                                data-oid=".a-5v8z"
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
              data-oid="kd29alu"
            />
          )}

          {viewMode === "sharedAttendance" && (
            <div data-oid="3euyk77">
              {loadingSharedAttendance ? (
                <div className="text-center py-8" data-oid="oz.y6h_">
                  <div
                    className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-scout-blue"
                    data-oid="4v8twp."
                  ></div>
                  <p className="mt-2 text-gray-600" data-oid="13xfwk1">
                    Loading shared attendance data...
                  </p>
                </div>
              ) : sharedAttendanceData?.error ? (
                <Alert variant="danger" data-oid="rmivx2_">
                  <Alert.Title data-oid="ggh.bbn">
                    Error Loading Shared Attendance
                  </Alert.Title>
                  <Alert.Description data-oid="226xswq">
                    {sharedAttendanceData.error}
                  </Alert.Description>
                  <Alert.Actions data-oid="901r.id">
                    <Button
                      variant="scout-blue"
                      onClick={loadSharedAttendanceData}
                      type="button"
                      data-oid="0vtd-i7"
                    >
                      Retry
                    </Button>
                  </Alert.Actions>
                </Alert>
              ) : sharedAttendanceData?.items ? (
                <div data-oid="vrn05--">
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
                          data-oid="a2xbt8t"
                        >
                          <h3
                            className="text-lg font-semibold text-gray-900 mb-2"
                            data-oid="n-o7g1-"
                          >
                            Combined Attendance Summary
                          </h3>
                          <div
                            className="flex flex-wrap gap-3"
                            data-oid="fowawhs"
                          >
                            <Badge
                              variant="scout-blue"
                              size="md"
                              data-oid="01gavy."
                            >
                              {totalMembers} Total
                            </Badge>
                            <Badge
                              variant="scout-green"
                              size="md"
                              data-oid=".kg_g25"
                            >
                              {totalYoungPeople} Young People
                            </Badge>
                            <Badge
                              variant="scout-purple"
                              size="md"
                              data-oid=":qcjg6x"
                            >
                              {totalAdults} Adults
                            </Badge>
                            <Badge variant="light" size="md" data-oid="o_7:mr3">
                              {sections.length} Sections
                            </Badge>
                          </div>
                        </div>

                        {/* Group members by section */}
                        {sections.map((section) => (
                          <div
                            key={section.sectionid}
                            className="mb-6"
                            data-oid="2vh1oih"
                          >
                            <div
                              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                              data-oid="wf-8but"
                            >
                              <div
                                className="bg-gray-50 px-4 py-3 border-b border-gray-200"
                                data-oid="vt6ge-b"
                              >
                                <h4
                                  className="font-medium text-gray-900 flex items-center gap-2"
                                  data-oid="al2jsi7"
                                >
                                  {section.sectionname}
                                  <div
                                    className="flex gap-1"
                                    data-oid="f5qnnml"
                                  >
                                    <Badge
                                      variant="scout-green"
                                      size="sm"
                                      data-oid="bos4ef-"
                                    >
                                      {section.youngPeopleCount} YP
                                    </Badge>
                                    <Badge
                                      variant="scout-purple"
                                      size="sm"
                                      data-oid="-614r68"
                                    >
                                      {section.adultsCount} Adults
                                    </Badge>
                                  </div>
                                </h4>
                              </div>

                              <div className="p-4" data-oid="f.v12ya">
                                <div
                                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                                  data-oid="qwdwywt"
                                >
                                  {section.members.map(
                                    (member, memberIndex) => (
                                      <div
                                        key={member.scoutid || memberIndex}
                                        className="p-3 bg-gray-50 rounded-lg flex justify-between items-center"
                                        data-oid="j1vduk0"
                                      >
                                        <div
                                          className="text-sm font-medium text-gray-900 min-w-0 flex-1 mr-2"
                                          data-oid="ppxxaxn"
                                        >
                                          {member.firstname} {member.lastname}
                                        </div>
                                        <div
                                          className="text-xs text-gray-500 font-mono flex-shrink-0"
                                          data-oid="8j_jqjz"
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
                <div className="text-center py-8" data-oid="6am99se">
                  <p className="text-gray-600" data-oid="0gnrk5_">
                    No shared attendance data available
                  </p>
                  <Button
                    variant="scout-blue"
                    onClick={loadSharedAttendanceData}
                    className="mt-4"
                    type="button"
                    data-oid="b.:gu-e"
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
        data-oid="5z.._3n"
      />
    </div>
  );
}

export default AttendanceView;
