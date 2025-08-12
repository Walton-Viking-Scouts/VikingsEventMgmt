import React, { useState, useEffect, useRef } from "react";
import LoadingScreen from "./LoadingScreen.jsx";
import MemberDetailModal from "./MemberDetailModal.jsx";
import CompactAttendanceFilter from "./CompactAttendanceFilter.jsx";
import SectionFilter from "./SectionFilter.jsx";
import CampGroupsView from "./CampGroupsView.jsx";
import SignInOutButton from "./SignInOutButton.jsx";
import { Card, Button, Badge, Alert } from "./ui";
import { useAttendanceData } from "../hooks/useAttendanceData.js";
import { useSignInOut } from "../hooks/useSignInOut.js";

function AttendanceView({ events, members, onBack }) {
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
  const [viewMode, setViewMode] = useState("overview"); // overview, summary, detailed, campGroups
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
    const switchingToSummary = viewMode === "summary" && prev !== "summary";
    const switchingFromCampGroups = prev === "campGroups";

    if (switchingToSummary && switchingFromCampGroups) {
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

  // Update filtered data when attendance data or filters change
  useEffect(() => {
    const filtered = filterAttendanceData(
      attendanceData,
      attendanceFilters,
      sectionFilters,
    );
    setFilteredAttendanceData(filtered);
  }, [attendanceData, attendanceFilters, sectionFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSummaryStats = () => {
    const memberStats = {};

    filteredAttendanceData.forEach((record) => {
      const memberKey = `${record.firstname} ${record.lastname}`;
      if (!memberStats[memberKey]) {
        memberStats[memberKey] = {
          name: memberKey,
          scoutid: record.scoutid,
          sectionid: record.sectionid, // Store section ID for Viking Event data lookup
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
          if (viewMode === "summary") {
            aValue = a.name?.toLowerCase() || "";
            bValue = b.name?.toLowerCase() || "";
          } else {
            aValue = `${a.firstname} ${a.lastname}`.toLowerCase();
            bValue = `${b.firstname} ${b.lastname}`.toLowerCase();
          }
          break;
        case "attendance":
          if (viewMode === "summary") {
            // For summary, determine primary status for each member and sort by priority
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
        <span className="ml-1 text-gray-400" data-oid="mh6u.5h">
          <svg
            className="w-4 h-4 inline"
            fill="currentColor"
            viewBox="0 0 20 20"
            data-oid="za3ryla"
          >
            <path d="M5 12l5-5 5 5H5z" data-oid="o.knizl" />
            <path d="M5 8l5 5 5-5H5z" data-oid="nteikw6" />
          </svg>
        </span>
      );
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-scout-blue" data-oid="eyg1dos">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="8601um."
        >
          <path d="M5 12l5-5 5 5H5z" data-oid="r8mm_bk" />
        </svg>
      </span>
    ) : (
      <span className="ml-1 text-scout-blue" data-oid="r8t7j3.">
        <svg
          className="w-4 h-4 inline"
          fill="currentColor"
          viewBox="0 0 20 20"
          data-oid="p1pzzml"
        >
          <path d="M5 8l5 5 5-5H5z" data-oid=".5:is0j" />
        </svg>
      </span>
    );
  };

  // Handle member click to show detail modal
  const handleMemberClick = (attendanceRecord) => {
    // Find the full member data or create a basic member object
    const member = members?.find(
      (m) => m.scoutid === attendanceRecord.scoutid,
    ) || {
      scoutid: attendanceRecord.scoutid,
      firstname: attendanceRecord.firstname,
      lastname: attendanceRecord.lastname,
      sections: [attendanceRecord.sectionname],
      person_type: attendanceRecord.person_type || "Young People",
    };

    setSelectedMember(member);
    setShowMemberModal(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
  };

  if (loading) {
    return <LoadingScreen message="Loading attendance..." data-oid="zp-_mv3" />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4" data-oid="i4ny:x8">
        <Alert.Title data-oid="ka4tor6">Error Loading Attendance</Alert.Title>
        <Alert.Description data-oid="r1axgf7">{error}</Alert.Description>
        <Alert.Actions data-oid="8axtgle">
          <Button
            variant="scout-blue"
            onClick={() => window.location.reload()}
            type="button"
            data-oid="__2yphw"
          >
            Retry
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  if (!attendanceData || attendanceData.length === 0) {
    return (
      <Card className="m-4" data-oid="_xsi5y:">
        <Card.Header data-oid="i-qzl5b">
          <Card.Title data-oid="fstshkm">No Attendance Data</Card.Title>
          <Button
            variant="outline-scout-blue"
            onClick={onBack}
            type="button"
            data-oid=":b6cp6u"
          >
            Back to Dashboard
          </Button>
        </Card.Header>
        <Card.Body data-oid="vnmyx4j">
          <p className="text-gray-600" data-oid="xosvyu.">
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
    <div data-oid="4j0t_7e">
      {/* Attendance Data Card */}
      <Card className="m-4" data-oid="xab84b9">
        <Card.Header data-oid="k.7cwm_">
          <Card.Title data-oid="b1w4lwo">
            Attendance Data{" "}
            {filteredAttendanceData.length !== attendanceData.length && (
              <span
                className="text-sm font-normal text-gray-600"
                data-oid="ykgcldi"
              >
                ({filteredAttendanceData.length} of {attendanceData.length}{" "}
                records)
              </span>
            )}
          </Card.Title>
          <div className="flex gap-2 items-center flex-wrap" data-oid="q._5q_m">
            <Badge variant="scout-blue" data-oid="0s7u3ru">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </Badge>
            <Button
              variant="outline-scout-blue"
              onClick={onBack}
              type="button"
              data-oid="91asqzi"
            >
              Back to Dashboard
            </Button>
            {attendanceData.length > 0 && (
              <div className="flex flex-col gap-3" data-oid="sml1w8k">
                <CompactAttendanceFilter
                  filters={attendanceFilters}
                  onFiltersChange={setAttendanceFilters}
                  data-oid="ymejd_1"
                />

                {uniqueSections.length > 1 && (
                  <SectionFilter
                    sectionFilters={sectionFilters}
                    onFiltersChange={setSectionFilters}
                    sections={uniqueSections}
                    data-oid="o3s9o9b"
                  />
                )}
              </div>
            )}
          </div>
        </Card.Header>

        <Card.Body data-oid="dgud7mk">
          {/* View toggle */}
          <div className="border-b border-gray-200 mb-6" data-oid="xrouck3">
            <nav className="-mb-px flex space-x-8" data-oid="aoxsjrt">
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === "overview"
                    ? "border-scout-blue text-scout-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setViewMode("overview")}
                type="button"
                data-oid="lpgi6qn"
              >
                Overview
              </button>
              <button
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  viewMode === "summary"
                    ? "border-scout-blue text-scout-blue"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setViewMode("summary")}
                type="button"
                data-oid="j3dq-8a"
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
                data-oid="10sn.7t"
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
                data-oid="8objfm2"
              >
                Camp Groups
              </button>
            </nav>
          </div>

          {/* Overview Tab - Attendance Summary */}
          {viewMode === "overview" && members && members.length > 0 && (
            <div className="overflow-x-auto" data-oid="hy._zmm">
              <div className="flex gap-2 items-center mb-4" data-oid="ew.aqlh">
                <Badge variant="scout-blue" data-oid="476ny60">
                  {events.length} event{events.length !== 1 ? "s" : ""}
                </Badge>
                <Badge variant="scout-green" data-oid="b0hffz6">
                  {simplifiedSummaryStats.totals.total.total} total responses
                </Badge>
              </div>
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="2zz.oqu"
              >
                <thead className="bg-gray-50" data-oid="wplbkig">
                  <tr data-oid="wqi6kr2">
                    <th
                      className="px-3 py-2 text-left table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="w9uq81."
                    >
                      Section
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-green-600 uppercase tracking-wider"
                      data-oid="uwdg.e0"
                    >
                      <div data-oid="2fbs-78">Yes</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="zvlp6db"
                      >
                        <span className="w-8 text-center" data-oid="ama0baf">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="7y8e.fp">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="nkrd1fb">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="7n34g0p">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-red-600 uppercase tracking-wider"
                      data-oid="945k_34"
                    >
                      <div data-oid="ga2rmd1">No</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="pyatsok"
                      >
                        <span className="w-8 text-center" data-oid="fi623mj">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="w7:zslq">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="577xmhc">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="cdb.e:x">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-yellow-600 uppercase tracking-wider"
                      data-oid="_v47y8p"
                    >
                      <div data-oid="a:kz6s5">Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="4k5:t2j"
                      >
                        <span className="w-8 text-center" data-oid="_bokg5h">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="4:yznb-">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="un6vs38">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="rhuv:bg">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-600 uppercase tracking-wider"
                      data-oid="5q2u7oh"
                    >
                      <div data-oid="cqhqv7z">Not Invited</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid=":.na4i4"
                      >
                        <span className="w-8 text-center" data-oid="1oaas74">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="ay78z_n">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="mjb:ksd">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="lcl_c6_">
                          Total
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-2 py-2 text-center table-header-text text-gray-500 uppercase tracking-wider"
                      data-oid="0dw.e5k"
                    >
                      <div data-oid="fe:au3k">Total</div>
                      <div
                        className="flex justify-center mt-1 text-xs"
                        data-oid="tudtgm4"
                      >
                        <span className="w-8 text-center" data-oid="d04zpr9">
                          YP
                        </span>
                        <span className="w-8 text-center" data-oid="0ktc20w">
                          YL
                        </span>
                        <span className="w-8 text-center" data-oid="ipwnd_a">
                          L
                        </span>
                        <span className="w-12 text-center" data-oid="0inosk.">
                          Total
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="i_m9wpx"
                >
                  {simplifiedSummaryStats.sections.map((section, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50"
                      data-oid="z_d._mx"
                    >
                      <td
                        className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                        data-oid="qdjhx59"
                      >
                        {section.name}
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold"
                        data-oid="4tp3s8f"
                      >
                        <div className="flex justify-center" data-oid="n2vq7xt">
                          <span className="w-8 text-center" data-oid="y9buhjk">
                            {section.yes.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="zljq1a3">
                            {section.yes.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="yl5vu1a">
                            {section.yes.l}
                          </span>
                          <span className="w-12 text-center" data-oid="m3wg24_">
                            {section.yes.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold"
                        data-oid="hsfznxp"
                      >
                        <div className="flex justify-center" data-oid="idda_s1">
                          <span className="w-8 text-center" data-oid="vm95a8k">
                            {section.no.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="qg7g-un">
                            {section.no.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="xbnj9r-">
                            {section.no.l}
                          </span>
                          <span className="w-12 text-center" data-oid="wm3jt0d">
                            {section.no.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold"
                        data-oid="aac:pdf"
                      >
                        <div className="flex justify-center" data-oid=":mge3m0">
                          <span className="w-8 text-center" data-oid="g2d1y_d">
                            {section.invited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="5bv0meq">
                            {section.invited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid=".umr_54">
                            {section.invited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="m2.4zt4">
                            {section.invited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                        data-oid="18s_i:x"
                      >
                        <div className="flex justify-center" data-oid="n3.vort">
                          <span className="w-8 text-center" data-oid="mke:7eq">
                            {section.notInvited.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="7ue6k8t">
                            {section.notInvited.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="et-s8jz">
                            {section.notInvited.l}
                          </span>
                          <span className="w-12 text-center" data-oid="n_.vlm_">
                            {section.notInvited.total}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                        data-oid="2ob8hbp"
                      >
                        <div className="flex justify-center" data-oid="d:u23o7">
                          <span className="w-8 text-center" data-oid="6ckcnmv">
                            {section.total.yp}
                          </span>
                          <span className="w-8 text-center" data-oid="17uh3hw">
                            {section.total.yl}
                          </span>
                          <span className="w-8 text-center" data-oid="cunjt4h">
                            {section.total.l}
                          </span>
                          <span className="w-12 text-center" data-oid="i-rz50w">
                            {section.total.total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-semibold" data-oid="w7zzjmg">
                    <td
                      className="px-3 py-3 whitespace-nowrap table-header-text text-gray-900"
                      data-oid="h.h8far"
                    >
                      Total
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-green-600 font-semibold"
                      data-oid="ghkqj4s"
                    >
                      <div className="flex justify-center" data-oid="bqtxvlw">
                        <span className="w-8 text-center" data-oid=":ok30:9">
                          {simplifiedSummaryStats.totals.yes.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="4er61hs">
                          {simplifiedSummaryStats.totals.yes.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="p6u8zzj">
                          {simplifiedSummaryStats.totals.yes.l}
                        </span>
                        <span className="w-12 text-center" data-oid="i-z640o">
                          {simplifiedSummaryStats.totals.yes.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-red-600 font-semibold"
                      data-oid="gumq26x"
                    >
                      <div className="flex justify-center" data-oid="5qwnyda">
                        <span className="w-8 text-center" data-oid="e6h3cwv">
                          {simplifiedSummaryStats.totals.no.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="swr0-5e">
                          {simplifiedSummaryStats.totals.no.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="5xt6m62">
                          {simplifiedSummaryStats.totals.no.l}
                        </span>
                        <span className="w-12 text-center" data-oid="x28zn.y">
                          {simplifiedSummaryStats.totals.no.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-yellow-600 font-semibold"
                      data-oid="pbu4ynt"
                    >
                      <div className="flex justify-center" data-oid="b3q7dun">
                        <span className="w-8 text-center" data-oid="mav0g-a">
                          {simplifiedSummaryStats.totals.invited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="be9cwd2">
                          {simplifiedSummaryStats.totals.invited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid=".-gmb65">
                          {simplifiedSummaryStats.totals.invited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="ez1kt.e">
                          {simplifiedSummaryStats.totals.invited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-600 font-semibold"
                      data-oid="75fb0v."
                    >
                      <div className="flex justify-center" data-oid="5dkzeok">
                        <span className="w-8 text-center" data-oid="t4m5rv6">
                          {simplifiedSummaryStats.totals.notInvited.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="_rc.bs1">
                          {simplifiedSummaryStats.totals.notInvited.yl}
                        </span>
                        <span className="w-8 text-center" data-oid="xus26v.">
                          {simplifiedSummaryStats.totals.notInvited.l}
                        </span>
                        <span className="w-12 text-center" data-oid="wg1:e9b">
                          {simplifiedSummaryStats.totals.notInvited.total}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 whitespace-nowrap text-center text-gray-900 font-semibold"
                      data-oid="fb.0.nz"
                    >
                      <div className="flex justify-center" data-oid="xgitno1">
                        <span className="w-8 text-center" data-oid="cgvse4s">
                          {simplifiedSummaryStats.totals.total.yp}
                        </span>
                        <span className="w-8 text-center" data-oid="a24g99u">
                          {simplifiedSummaryStats.totals.total.yl}
                        </span>
                        <span className="w-8 text-center" data-oid=".73z_cq">
                          {simplifiedSummaryStats.totals.total.l}
                        </span>
                        <span className="w-12 text-center" data-oid="y8fy_-j">
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
            <div className="text-center py-12" data-oid=".s-lc-5">
              <div className="text-gray-500 mb-4" data-oid="miq8vgw">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  data-oid="ke6abs5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    data-oid="daciffp"
                  />
                </svg>
              </div>
              <h3
                className="text-lg font-semibold text-gray-900 mb-2"
                data-oid="9zv50fi"
              >
                No Records Match Filters
              </h3>
              <p className="text-gray-600 mb-4" data-oid="wf3srob">
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
                data-oid="xjikvcs"
              >
                Show All Records
              </Button>
            </div>
          ) : (
            viewMode === "summary" && (
              <div className="overflow-x-auto" data-oid="ii5l57g">
                <table
                  className="min-w-full divide-y divide-gray-200"
                  data-oid="4vw3vg:"
                >
                  <thead className="bg-gray-50" data-oid="al:z:u4">
                    <tr data-oid="_:.dtgm">
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("member")}
                        data-oid="f-pv.ff"
                      >
                        <div className="flex items-center" data-oid="wbo5o91">
                          Member {getSortIcon("member")}
                        </div>
                      </th>
                      <th
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="m2bdava"
                      >
                        Actions
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("attendance")}
                        data-oid="zo986xz"
                      >
                        <div className="flex items-center" data-oid="a5l7uc-">
                          Status {getSortIcon("attendance")}
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="4zo0ei8"
                      >
                        Camp Group
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="bwve.h7"
                      >
                        Signed In
                      </th>
                      <th
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid=":d7g7se"
                      >
                        Signed Out
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className="bg-white divide-y divide-gray-200"
                    data-oid="nwqkc-."
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
                          data-oid="1f3fw7v"
                        >
                          <td className="px-3 py-4" data-oid="bh-1vfh">
                            <button
                              onClick={() =>
                                handleMemberClick({
                                  scoutid: member.scoutid,
                                  firstname: member.name.split(" ")[0],
                                  lastname: member.name
                                    .split(" ")
                                    .slice(1)
                                    .join(" "),
                                  sectionname: member.events[0]?.sectionname,
                                })
                              }
                              className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left break-words whitespace-normal leading-tight max-w-[120px] block"
                              data-oid="s14roch"
                            >
                              {member.name}
                            </button>
                          </td>
                          <td
                            className="px-2 py-4 text-center"
                            data-oid="_xp7yxn"
                          >
                            <SignInOutButton
                              member={member}
                              onSignInOut={handleSignInOut}
                              loading={buttonLoading?.[member.scoutid] || false}
                              data-oid="di-_70h"
                            />
                          </td>
                          <td
                            className="px-3 py-4 whitespace-nowrap"
                            data-oid="c-0rqnn"
                          >
                            <div
                              className="flex gap-1 flex-wrap"
                              data-oid="8y60nr6"
                            >
                              {member.yes > 0 && (
                                <Badge
                                  variant="scout-green"
                                  className="text-xs"
                                  data-oid="d2rk:h-"
                                >
                                  Yes
                                </Badge>
                              )}
                              {member.no > 0 && (
                                <Badge
                                  variant="scout-red"
                                  className="text-xs"
                                  data-oid="xjkrccg"
                                >
                                  No
                                </Badge>
                              )}
                              {member.invited > 0 && (
                                <Badge
                                  variant="scout-blue"
                                  className="text-xs"
                                  data-oid="fvvp445"
                                >
                                  Invited
                                </Badge>
                              )}
                              {member.notInvited > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs"
                                  data-oid="veqlin-"
                                >
                                  Not Invited
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td
                            className="px-3 py-4 whitespace-nowrap text-sm text-gray-900"
                            data-oid="peldj0q"
                          >
                            {member.vikingEventData?.CampGroup || "-"}
                          </td>
                          <td className="px-3 py-4 text-sm" data-oid="j67bge:">
                            {member.vikingEventData?.SignedInBy ||
                            member.vikingEventData?.SignedInWhen ? (
                              <div className="space-y-0.5" data-oid="68a_w.d">
                                <div
                                  className="text-gray-900 font-medium leading-tight"
                                  data-oid="1ye7ax."
                                >
                                  {member.vikingEventData?.SignedInBy || "-"}
                                </div>
                                <div
                                  className="text-gray-500 text-xs leading-tight"
                                  data-oid="sdj95zs"
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
                                data-oid="710hhe-"
                              >
                                -
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-4 text-sm" data-oid="zj4w7bw">
                            {member.vikingEventData?.SignedOutBy ||
                            member.vikingEventData?.SignedOutWhen ? (
                              <div className="space-y-0.5" data-oid="ho1ksss">
                                <div
                                  className="text-gray-900 font-medium leading-tight"
                                  data-oid="iqhsw:7"
                                >
                                  {member.vikingEventData?.SignedOutBy || "-"}
                                </div>
                                <div
                                  className="text-gray-500 text-xs leading-tight"
                                  data-oid="6yopoey"
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
                                data-oid="if.r-tz"
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
            <div className="overflow-x-auto" data-oid="ljcdou:">
              <table
                className="min-w-full divide-y divide-gray-200"
                data-oid="6dwll03"
              >
                <thead className="bg-gray-50" data-oid="c9rx365">
                  <tr data-oid="6suiwvi">
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("member")}
                      data-oid="lzp9esu"
                    >
                      <div className="flex items-center" data-oid="17lc1:g">
                        Member {getSortIcon("member")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("section")}
                      data-oid="0esu06o"
                    >
                      <div className="flex items-center" data-oid="nebsf8c">
                        Section {getSortIcon("section")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("attendance")}
                      data-oid="untszdh"
                    >
                      <div className="flex items-center" data-oid=".dokgfh">
                        Attendance {getSortIcon("attendance")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="0ud3tza"
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
                        data-oid="nj.b.7h"
                      >
                        <td
                          className="px-6 py-4 whitespace-nowrap"
                          data-oid="398rxg1"
                        >
                          <button
                            onClick={() => handleMemberClick(record)}
                            className="font-semibold text-scout-blue hover:text-scout-blue-dark cursor-pointer transition-colors text-left"
                            data-oid="2v.jfq2"
                          >
                            {record.firstname} {record.lastname}
                          </button>
                        </td>
                        <td
                          className="px-6 py-4 whitespace-nowrap text-gray-900"
                          data-oid="ib.jo7-"
                        >
                          {record.sectionname}
                        </td>
                        <td
                          className="px-6 py-4 whitespace-nowrap"
                          data-oid="bnuzl9z"
                        >
                          <Badge variant={badgeVariant} data-oid="1_z01__">
                            {statusText}
                          </Badge>
                          {record.attending &&
                            record.attending !== statusText && (
                              <div
                                className="text-gray-500 text-xs mt-1"
                                data-oid=":e.2wr7"
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
              attendees={filteredAttendanceData}
              members={members}
              onError={(_error) => {
                /* Error handled within CampGroupsView */
              }}
              data-oid="2uf:hpj"
            />
          )}
        </Card.Body>
      </Card>

      {/* Member Detail Modal */}
      <MemberDetailModal
        member={selectedMember}
        isOpen={showMemberModal}
        onClose={handleModalClose}
        data-oid="mveo:re"
      />
    </div>
  );
}

export default AttendanceView;
