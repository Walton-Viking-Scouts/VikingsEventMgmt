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
        <span className="ml-1 text-gray-400" data-oid="it51rx7">
          <svg
            className="w-4 h-4 inline"
            fill="currentColor"
            viewBox="0 0 20 20"
            data-oid="5htj0up"
          >
            <path d="M5 12l5-5 5 5H5z" data-oid="c3kvwuj" />
            <path d="M5 8l5 5 5-5H5z" data-oid="af22uyr" />
          </svg>
        </span>
      );
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-scout-blue" data-oid="gf7zgbv">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="c:h5_wd"
        >
          <path d="M5 12l5-5 5 5H5z" data-oid="4tk9b3-" />
        </svg>
      </span>
    ) : (
      <span className="ml-1 text-scout-blue" data-oid="80iyj_v">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="s3u.4hw"
        >
          <path d="M5 8l5 5 5-5H5z" data-oid=":8qjta-" />
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
    return <LoadingScreen message="Loading attendance..." data-oid="01pcuh4" />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4" data-oid="2.t5nhf">
        <Alert.Title data-oid="k_mdxan">Error Loading Attendance</Alert.Title>
        <Alert.Description data-oid="20cse6q">{error}</Alert.Description>
        <Alert.Actions data-oid="_rqp2rn">
          <Button
            variant="scout-blue"
            onClick={() => window.location.reload()}
            type="button"
            data-oid=":7qe4ut"
          >
            Retry
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  if (!attendanceData || attendanceData.length === 0) {
    return (
      <Card className="m-4" data-oid=".blwhb6">
        <Card.Header data-oid="diii4xd">
          <Card.Title data-oid="a6_fo_r">No Attendance Data</Card.Title>
          <Button
            variant="outline-scout-blue"
            onClick={onBack}
            type="button"
            data-oid="blyj.3i"
          >
            Back to Dashboard
          </Button>
        </Card.Header>
        <Card.Body data-oid="h1oenen">
          <p className="text-gray-600" data-oid="_6g0m6o">
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
    <div data-oid="4aip8v-">
      {/* Attendance Data Card */}
      <Card className="m-4" data-oid=":9mw6.m">
        <Card.Header data-oid="lv1m-ly">
          <Card.Title data-oid="w9nm.09">
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
                    data-oid="o4v29.k"
                  >
                    ({filteredForCount.length} of {attendanceData.length}{" "}
                    records)
                  </span>
                )
              );
            })()}
          </Card.Title>
          <div className="flex gap-2 items-center flex-wrap" data-oid="j2_.e5.">
            <Button
              variant="outline-scout-blue"
              onClick={onBack}
              type="button"
              data-oid="gk8911a"
            >
              Back to Dashboard
            </Button>
            {attendanceData.length > 0 && (
              <div className="flex flex-col gap-3" data-oid="5gys1_g">
                <CompactAttendanceFilter
                  filters={attendanceFilters}
                  onFiltersChange={setAttendanceFilters}
                  data-oid="c3vh1eh"
                />

                {uniqueSections.length > 1 && (
                  <SectionFilter
                    sectionFilters={sectionFilters}
                    onFiltersChange={setSectionFilters}
                    sections={uniqueSections}
                    data-oid=".s1m6dg"
                  />
                )}
              </div>
            )}
          </div>
        </Card.Header>

        <Card.Body data-oid="ai-hilw">
          {/* View toggle */}
          <div className="border-b border-gray-200 mb-6" data-oid="swp6_og">
            <nav className="-mb-px flex space-x-8" data-oid=":x_jwqw">
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === "overview"
                    ? "border-scout-blue text-scout-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setViewMode("overview")}
                type="button"
                data-oid="cx416n4"
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
                data-oid="d_lyq21"
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
                data-oid="lchexni"
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
                data-oid="p3.fog7"
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
                  data-oid="v8y1opo"
                >
                  Shared Attendance
                </button>
              )}
            </nav>
          </div>

          {/* Overview Tab - Attendance Summary */}
          {viewMode === "overview" && members && members.length > 0 && (
            <div className="overflow-x-auto" data-oid="q6yyt_6">
              <div className="flex gap-2 items-center mb-4" data-oid="h__ff-k">
                <Badge variant="scout-green" data-oid="x-7fh_h">
                  {simplifiedSummaryStats.totals.total.total} total responses
                </Badge>
              </div>
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="itak_:a"
              >
                <thead className="bg-gray-50" data-oid="8hbxchn">
                  <tr data-oid="tza.91l">
                    <th
                      className="px-3 py-2 text-left table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="_jchs4t"
                    >
                      Section
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-green-600 uppercase tracking-wider"
                      data-oid="tiqsd0_"
                    >
                      <div data-oid="8ahwqrp">Yes</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="7syr2vh"
                      >
                        <span className="w-8 text-center" data-oid="l4fktez">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="wpt7ae6">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="endjwx1">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="a6ze5r4">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-red-600 uppercase tracking-wider"
                      data-oid="9d0ygha"
                    >
                      <div data-oid="3k78-nr">No</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="75i53jk"
                      >
                        <span className="w-8 text-center" data-oid="nx0fr8w">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="cuyl50w">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="21v2_fs">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="4ov4c5l">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-yellow-600 uppercase tracking-wider"
                      data-oid="zz6r.y:"
                    >
                      <div data-oid="3cpm.sg">Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="xz40jwm"
                      >
                        <span className="w-8 text-center" data-oid="bvnhjne">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="pfrpr5l">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="in.zskl">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="nk_vztj">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-600 uppercase tracking-wider"
                      data-oid="pxvo5oq"
                    >
                      <div data-oid="mpxvp6e">Not Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="6:tvzus"
                      >
                        <span className="w-8 text-center" data-oid="qd7klua">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="uasaxyv">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="w:9u.-8">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="81j4pj9">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="u31_7aq"
                    >
                      <div data-oid="bdv39qr">Total</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="ga3pvk9"
                      >
                        <span className="w-8 text-center" data-oid="64k-1cb">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="dhoumd5">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="t51:kn0">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="0cqqfo0">
                          Total
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="vsja.d7"
                >
                  {simplifiedSummaryStats.sections.map((section, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50"
                      data-oid="u3bnr8j"
                    >
                      <td
                        className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                        data-oid="w9e.qt0"
                      >
                        {section.name}
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold"
                        data-oid="ueeq88_"
                      >
                        <div className="flex justify-center" data-oid="q-tak0-">
                          <span className="w-8 text-center" data-oid="98mwmy2">
                            {section.yes.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="cmh3zsg">
                            {section.yes.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="1jywv:z">
                            {section.yes.l}
                          </span>
                          <span className="w-12 text-center" data-oid="v9a:sdi">
                            {section.yes.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold"
                        data-oid="d6icwee"
                      >
                        <div className="flex justify-center" data-oid="_6hgtx5">
                          <span className="w-8 text-center" data-oid="1b60czk">
                            {section.no.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="3i7825t">
                            {section.no.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="5_9abz0">
                            {section.no.l}
                          </span>
                          <span className="w-12 text-center" data-oid="i:3x2b3">
                            {section.no.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold"
                        data-oid="8pc.vkw"
                      >
                        <div className="flex justify-center" data-oid="9mofu62">
                          <span className="w-8 text-center" data-oid="zczrmk4">
                            {section.invited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="5utwo7g">
                            {section.invited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="9ngqy.w">
                            {section.invited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="r8hp.ai">
                            {section.invited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                        data-oid="o:rr002"
                      >
                        <div className="flex justify-center" data-oid="m1vy-y6">
                          <span className="w-8 text-center" data-oid=".a8y_jz">
                            {section.notInvited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="88.0m3.">
                            {section.notInvited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="lv5spb1">
                            {section.notInvited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="tk0_i3a">
                            {section.notInvited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                        data-oid="cwkxb-j"
                      >
                        <div className="flex justify-center" data-oid="kg2n_ta">
                          <span className="w-8 text-center" data-oid="izzpzgx">
                            {section.total.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="yy8echu">
                            {section.total.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="5nxfz63">
                            {section.total.l}
                          </span>
                          <span className="w-12 text-center" data-oid="2zyq9nf">
                            {section.total.total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-semibold" data-oid="3zw6x5:">
                    <td
                      className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                      data-oid="n9o70hc"
                    >
                      Total
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold"
                      data-oid="ucnymw0"
                    >
                      <div className="flex justify-center" data-oid="zu.vr3-">
                        <span className="w-8 text-center" data-oid="7h8yvj.">
                          {simplifiedSummaryStats.totals.yes.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="vk.prc7">
                          {simplifiedSummaryStats.totals.yes.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="h0yy5kk">
                          {simplifiedSummaryStats.totals.yes.l}
                        </span>
                        <span className="w-12 text-center" data-oid="ehdj_ok">
                          {simplifiedSummaryStats.totals.yes.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold"
                      data-oid="ib7e9x1"
                    >
                      <div className="flex justify-center" data-oid="v.-58cs">
                        <span className="w-8 text-center" data-oid=":4fzh3f">
                          {simplifiedSummaryStats.totals.no.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="y4m-5:0">
                          {simplifiedSummaryStats.totals.no.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="x:_cwpu">
                          {simplifiedSummaryStats.totals.no.l}
                        </span>
                        <span className="w-12 text-center" data-oid="t-snhug">
                          {simplifiedSummaryStats.totals.no.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold"
                      data-oid="onfkkhc"
                    >
                      <div className="flex justify-center" data-oid="si1l8os">
                        <span className="w-8 text-center" data-oid="ds3i-0c">
                          {simplifiedSummaryStats.totals.invited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="shvuhn5">
                          {simplifiedSummaryStats.totals.invited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid=".t6c23.">
                          {simplifiedSummaryStats.totals.invited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="dfvr0km">
                          {simplifiedSummaryStats.totals.invited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                      data-oid="1zkw5u3"
                    >
                      <div className="flex justify-center" data-oid="oonn8en">
                        <span className="w-8 text-center" data-oid=".x9mnwe">
                          {simplifiedSummaryStats.totals.notInvited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="i1.ajw7">
                          {simplifiedSummaryStats.totals.notInvited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="qj0p2wr">
                          {simplifiedSummaryStats.totals.notInvited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="yifzwiq">
                          {simplifiedSummaryStats.totals.notInvited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                      data-oid="2j70pje"
                    >
                      <div className="flex justify-center" data-oid="vl1..2j">
                        <span className="w-8 text-center" data-oid="bk41kso">
                          {simplifiedSummaryStats.totals.total.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="l_2_ite">
                          {simplifiedSummaryStats.totals.total.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="6j6ht97">
                          {simplifiedSummaryStats.totals.total.l}
                        </span>
                        <span className="w-12 text-center" data-oid="le22k11">
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
            <div className="text-center py-12" data-oid="l3...d2">
              <div className="text-gray-500 mb-4" data-oid="ge5j:rv">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  data-oid="q5qdbj4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    data-oid="i5uitjt"
                  />
                </svg>
              </div>
              <h3
                className="text-lg font-semibold text-gray-900 mb-2"
                data-oid="qyuors9"
              >
                No Records Match Filters
              </h3>
              <p className="text-gray-600 mb-4" data-oid="my3cp23">
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
                data-oid="d2q3rop"
              >
                Show All Records
              </Button>
            </div>
          ) : (
            viewMode === "register" && (
              <div className="overflow-x-auto" data-oid="3y:4bsu">
                <table
                  className="min-w-full divide-y divide-gray-200"
                  data-oid=":cjynuu"
                >
                  <thead className="bg-gray-50" data-oid="j-oezig">
                    <tr data-oid="dy5k6ut">
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("member")}
                        data-oid="1vbjmgf"
                      >
                        <div className="flex items-center" data-oid="wo6t9g.">
                          Member {getSortIcon("member")}
                        </div>
                      </th>
                      <th
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="_onuijo"
                      >
                        Actions
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("attendance")}
                        data-oid="-_7-7dh"
                      >
                        <div className="flex items-center" data-oid="1h3rk.v">
                          Status {getSortIcon("attendance")}
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="akdtqya"
                      >
                        Camp Group
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="il7-b_j"
                      >
                        Signed In
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="qud78in"
                      >
                        Signed Out
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className="bg-white divide-y divide-gray-200"
                    data-oid=":3ddz_q"
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
                          data-oid="wswmxpm"
                        >
                          <td className="px-3 py-2" data-oid="e7d5an_">
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
                              data-oid="lo973e8"
                            >
                              {member.name}
                            </button>
                          </td>
                          <td
                            className="px-2 py-2 text-center"
                            data-oid="dth7j.5"
                          >
                            <SignInOutButton
                              member={member}
                              onSignInOut={handleSignInOut}
                              loading={buttonLoading?.[member.scoutid] || false}
                              data-oid="j_t48ze"
                            />
                          </td>
                          <td
                            className="px-3 py-2 whitespace-nowrap"
                            data-oid="ax44w1h"
                          >
                            <div
                              className="flex gap-1 flex-wrap"
                              data-oid="l-c9jmv"
                            >
                              {member.yes > 0 && (
                                <Badge
                                  variant="scout-green"
                                  className="text-xs"
                                  data-oid="8hvl5-n"
                                >
                                  Yes
                                </Badge>
                              )}
                              {member.no > 0 && (
                                <Badge
                                  variant="scout-red"
                                  className="text-xs"
                                  data-oid="s69976l"
                                >
                                  No
                                </Badge>
                              )}
                              {member.invited > 0 && (
                                <Badge
                                  variant="scout-blue"
                                  className="text-xs"
                                  data-oid="fsrqfpc"
                                >
                                  Invited
                                </Badge>
                              )}
                              {member.notInvited > 0 && (
                                <Badge
                                  variant="light"
                                  className="text-xs"
                                  data-oid="yex429o"
                                >
                                  Not Invited
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-3 py-2 whitespace-nowrap text-xs text-gray-900"
                            data-oid="awwe10e"
                          >
                            {member.vikingEventData?.CampGroup || "-"}
                          </td>
                          <td className="px-3 py-2 text-xs" data-oid="6h2takk">
                            {member.vikingEventData?.SignedInBy ||
                            member.vikingEventData?.SignedInWhen ? (
                              <div className="space-y-0.5" data-oid="a5vvxvv">
                                <div
                                  className="text-gray-900 font-medium leading-tight"
                                  data-oid="nh17f:c"
                                >
                                  {member.vikingEventData?.SignedInBy || "-"}
                                </div>
                                <div
                                  className="text-gray-500 text-xs leading-tight"
                                  data-oid="x.i.96."
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
                                data-oid="ojs3uck"
                              >
                                -
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs" data-oid="qrk8z-q">
                            {member.vikingEventData?.SignedOutBy ||
                            member.vikingEventData?.SignedOutWhen ? (
                              <div className="space-y-0.5" data-oid="0ruk3gb">
                                <div
                                  className="text-gray-900 font-medium leading-tight"
                                  data-oid="tfyq_ne"
                                >
                                  {member.vikingEventData?.SignedOutBy || "-"}
                                </div>
                                <div
                                  className="text-gray-500 text-xs leading-tight"
                                  data-oid="jr6v5p4"
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
                                data-oid="lqot48_"
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
            <div className="overflow-x-auto" data-oid="gix-b96">
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="m-t1nf1"
              >
                <thead className="bg-gray-50" data-oid="cj7q04r">
                  <tr data-oid="schvb5r">
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("member")}
                      data-oid="uo9wh6y"
                    >
                      <div className="flex items-center" data-oid="3aeevkb">
                        Member {getSortIcon("member")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("section")}
                      data-oid="crc:t6h"
                    >
                      <div className="flex items-center" data-oid="nkaaok1">
                        Section {getSortIcon("section")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("attendance")}
                      data-oid="z-hs1kn"
                    >
                      <div className="flex items-center" data-oid=":kb7:fi">
                        Attendance {getSortIcon("attendance")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="wi941rh"
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
                        data-oid="7znhw43"
                      >
                        <td
                          className="px-6 py-2 whitespace-nowrap"
                          data-oid="66mx3_0"
                        >
                          <button
                            onClick={() => handleMemberClick(record)}
                            className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left text-xs"
                            data-oid="xbvn9mu"
                          >
                            {record.firstname} {record.lastname}
                          </button>
                        </td>
                        <td
                          className="px-6 py-2 whitespace-nowrap text-gray-900 text-xs"
                          data-oid="r8pfdnf"
                        >
                          {record.sectionname}
                        </td>
                        <td
                          className="px-6 py-2 whitespace-nowrap"
                          data-oid="5i:uxpa"
                        >
                          <Badge variant={badgeVariant} data-oid="d79ypw0">
                            {statusText}
                          </Badge>
                          {record.attending &&
                            record.attending !== statusText && (
                              <div
                                className="text-gray-500 text-xs mt-1"
                                data-oid="ql:92x0"
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
              data-oid="v2ihoqd"
            />
          )}

          {viewMode === "sharedAttendance" && (
            <div data-oid="qdcrb9t">
              {loadingSharedAttendance ? (
                <div className="text-center py-8" data-oid="j2yadai">
                  <div
                    className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-scout-blue"
                    data-oid="q7k2j9c"
                  ></div>
                  <p className="mt-2 text-gray-600" data-oid="dj0y4kz">
                    Loading shared attendance data...
                  </p>
                </div>
              ) : sharedAttendanceData?.error ? (
                <Alert variant="danger" data-oid="argbih-">
                  <Alert.Title data-oid="csfyehl">
                    Error Loading Shared Attendance
                  </Alert.Title>
                  <Alert.Description data-oid="ghtwn1i">
                    {sharedAttendanceData.error}
                  </Alert.Description>
                  <Alert.Actions data-oid="fpkhdn2">
                    <Button
                      variant="scout-blue"
                      onClick={loadSharedAttendanceData}
                      type="button"
                      data-oid="0_6ufuw"
                    >
                      Retry
                    </Button>
                  </Alert.Actions>
                </Alert>
              ) : sharedAttendanceData?.items ? (
                <div data-oid="sk1axa6">
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
                          data-oid="rc.ozd6"
                        >
                          <h3
                            className="text-lg font-semibold text-gray-900 mb-2"
                            data-oid="md8do-9"
                          >
                            Combined Attendance Summary
                          </h3>
                          <div
                            className="flex flex-wrap gap-3"
                            data-oid="b0ln6j2"
                          >
                            <Badge
                              variant="scout-blue"
                              size="md"
                              data-oid="nyg45nr"
                            >
                              {totalMembers} Total
                            </Badge>
                            <Badge
                              variant="scout-green"
                              size="md"
                              data-oid="1nul3mj"
                            >
                              {totalYoungPeople} Young People
                            </Badge>
                            <Badge
                              variant="scout-purple"
                              size="md"
                              data-oid="azqfwly"
                            >
                              {totalAdults} Adults
                            </Badge>
                            <Badge variant="light" size="md" data-oid="b53_ts3">
                              {sections.length} Sections
                            </Badge>
                          </div>
                        </div>

                        {/* Group members by section */}
                        {sections.map((section) => (
                          <div
                            key={section.sectionid}
                            className="mb-6"
                            data-oid="5r1a9dn"
                          >
                            <div
                              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                              data-oid="nyv-k0:"
                            >
                              <div
                                className="bg-gray-50 px-4 py-3 border-b border-gray-200"
                                data-oid="cbtz5.b"
                              >
                                <h4
                                  className="font-medium text-gray-900 flex items-center gap-2"
                                  data-oid="izfeeyb"
                                >
                                  {section.sectionname}
                                  <div
                                    className="flex gap-1"
                                    data-oid="96hzbkc"
                                  >
                                    <Badge
                                      variant="scout-green"
                                      size="sm"
                                      data-oid="z845pv_"
                                    >
                                      {section.youngPeopleCount} YP
                                    </Badge>
                                    <Badge
                                      variant="scout-purple"
                                      size="sm"
                                      data-oid="2nhf-qw"
                                    >
                                      {section.adultsCount} Adults
                                    </Badge>
                                  </div>
                                </h4>
                              </div>

                              <div className="p-4" data-oid="fj87j44">
                                <div
                                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                                  data-oid="jv5lr1q"
                                >
                                  {section.members.map(
                                    (member, memberIndex) => (
                                      <div
                                        key={member.scoutid || memberIndex}
                                        className="p-3 bg-gray-50 rounded-lg flex justify-between items-center"
                                        data-oid="jbjzcic"
                                      >
                                        <div
                                          className="text-sm font-medium text-gray-900 min-w-0 flex-1 mr-2"
                                          data-oid="5kk1mo9"
                                        >
                                          {member.firstname} {member.lastname}
                                        </div>
                                        <div
                                          className="text-xs text-gray-500 font-mono flex-shrink-0"
                                          data-oid="ha_zd9."
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
                <div className="text-center py-8" data-oid="ho.puzo">
                  <p className="text-gray-600" data-oid="2rwtn9m">
                    No shared attendance data available
                  </p>
                  <Button
                    variant="scout-blue"
                    onClick={loadSharedAttendanceData}
                    className="mt-4"
                    type="button"
                    data-oid="s6irli-"
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
        data-oid="vgb_:or"
      />
    </div>
  );
}

export default AttendanceView;
