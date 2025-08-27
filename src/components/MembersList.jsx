import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { getListOfMembers } from "../services/api.js";
import { getToken } from "../services/auth.js";
import { Button, Card, Input, Alert, Badge } from "./ui";
import LoadingScreen from "./LoadingScreen.jsx";
import MemberDetailModal from "./MemberDetailModal.jsx";
import { isMobileLayout } from "../utils/platform.js";

function MembersList({
  sections,
  members: propsMembers,
  onBack,
  embedded = false,
  showHeader = true,
}) {
  const [members, setMembers] = useState(propsMembers || []);
  const [loading, setLoading] = useState(!propsMembers);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("lastname");
  const [sortDirection, setSortDirection] = useState("asc");
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    sections: true,
    email: true,
    phone: true,
    patrol: true,
    person_type: true,
    age: true,
    address: false,
    medical: false,
    emergency: false,
  });

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const isMobile = isMobileLayout();
  const sectionIds = useMemo(
    () => sections.map((s) => s.sectionid),
    [sections],
  );
  const sectionIdsKey = sectionIds.join(",");

  const loadMembers = useCallback(async () => {
    if (!mountedRef.current) return;

    // Clear error state immediately so Retry hides error UI
    setError(null);
    setLoading(true);

    // Increment requestId to guard against race conditions
    const currentRequestId = ++requestIdRef.current;

    try {
      const token = getToken();
      const members = await getListOfMembers(sections, token);

      // Only apply state updates if component is mounted AND this is the latest request
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setMembers(members);
      }
    } catch (e) {
      // Only apply error state if component is mounted AND this is the latest request
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setError(e?.message ?? "Unable to load members. Please try again.");
      }
    } finally {
      // Only turn off loading for the matching requestId so stale requests cannot override
      if (mountedRef.current && requestIdRef.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, [sections]); // sections changes are captured directly

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (propsMembers) {
      // Cancel any in-flight async load and use provided data
      requestIdRef.current++;
      setMembers(propsMembers);
      setLoading(false);
      setError(null);
    } else {
      // Load members if not provided
      loadMembers();
    }
  }, [sectionIdsKey, propsMembers, loadMembers]);

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return "";
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }
      return age;
    } catch {
      return "";
    }
  };

  // Filter and sort members
  const filteredAndSortedMembers = useMemo(() => {
    const filtered = members.filter((member) => {
      const searchLower = searchTerm.toLowerCase();
      const fullName =
        `${member.firstname || ""} ${member.lastname || ""}`.toLowerCase();
      const email = (member.email || "").toLowerCase();
      const sectionsText = (member.sections || []).join(" ").toLowerCase();

      return (
        fullName.includes(searchLower) ||
        email.includes(searchLower) ||
        sectionsText.includes(searchLower)
      );
    });

    filtered.sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

      // Special handling for specific fields
      if (sortField === "name") {
        aValue = `${a.lastname || ""} ${a.firstname || ""}`;
        bValue = `${b.lastname || ""} ${b.firstname || ""}`;
      } else if (sortField === "sections") {
        aValue = (a.sections || []).join(", ");
        bValue = (b.sections || []).join(", ");
      } else if (sortField === "age") {
        aValue = calculateAge(a.date_of_birth);
        bValue = calculateAge(b.date_of_birth);
      }

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [members, searchTerm, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const exportToCSV = () => {
    if (filteredAndSortedMembers.length === 0) {
      alert("No members to export");
      return;
    }

    // Define CSV headers based on available data
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Sections",
      "Patrol",
      "Person Type",
      "Age",
      "Date of Birth",
      "Address",
      "Postcode",
      "Emergency Contacts",
      "Medical Notes",
      "Dietary Requirements",
      "Active",
      "Started",
      "Joined",
    ];

    // Convert members to CSV rows using enhanced data
    const csvRows = [
      headers.join(","),
      ...filteredAndSortedMembers.map((member) => {
        const emergencyContacts = (member.emergency_contacts || [])
          .map((contact) =>
            `${contact.name} (${contact.phone}) ${contact.email}`.trim(),
          )
          .join("; ");

        return [
          `"${member.firstname || ""}"`,
          `"${member.lastname || ""}"`,
          `"${member.email || ""}"`,
          `"${member.phone || ""}"`,
          `"${(member.sections || []).join("; ")}"`,
          `"${member.patrol || ""}"`,
          `"${member.person_type || "Young People"}"`,
          `"${calculateAge(member.date_of_birth)}"`,
          `"${member.date_of_birth || ""}"`,
          `"${member.address || ""}"`,
          `"${member.postcode || ""}"`,
          `"${emergencyContacts}"`,
          `"${member.medical_notes || ""}"`,
          `"${member.dietary_requirements || ""}"`,
          `"${member.active ? "Yes" : "No"}"`,
          `"${member.started || ""}"`,
          `"${member.joined || ""}"`,
        ].join(",");
      }),
    ];

    // Create and download CSV file
    const csvContent = csvRows.join("\n");
    const blob = new globalThis.Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `members_${sectionIds.join("_")}_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return (
        <span className="text-gray-300" data-oid="gpddxlh">
          ↕
        </span>
      );
    }
    return (
      <span className="text-scout-blue" data-oid="y86dvr9">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // Handle member click to show detail modal
  const handleMemberClick = (member) => {
    console.log("✅ MembersList (WORKING) member structure:", {
      scoutid: member.scoutid,
      firstname: member.firstname,
      lastname: member.lastname,
      date_of_birth: member.date_of_birth,
      email: member.email,
      phone: member.phone,
      emergency_contacts: member.emergency_contacts,
      medical_notes: member.medical_notes,
      sections: member.sections,
      allKeys: Object.keys(member).sort(),
    });
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowMemberModal(false);
    setSelectedMember(null);
  };

  if (loading) {
    return <LoadingScreen message="Loading members..." data-oid="921c4dg" />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4" data-oid="3f0pj.0">
        <Alert.Title data-oid="na3wub2">Error Loading Members</Alert.Title>
        <Alert.Description data-oid="5idv4z5">{error}</Alert.Description>
        <Alert.Actions data-oid="-5b:3uu">
          <Button
            variant="scout-blue"
            onClick={loadMembers}
            type="button"
            data-oid="s23r-fp"
          >
            Retry
          </Button>
          <Button
            variant="outline"
            onClick={onBack}
            type="button"
            data-oid="_1536mh"
          >
            Back to Dashboard
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div className={embedded ? "" : "px-4 sm:px-6 lg:px-8"} data-oid="_:xyk.w">
      {/* Header - only show if not embedded */}
      {showHeader && (
        <div className="sm:flex sm:items-center" data-oid="4xjei_y">
          <div className="sm:flex-auto" data-oid="5nme4el">
            <h1
              className="text-xl font-semibold text-gray-900"
              data-oid="b1suo6b"
            >
              Members ({filteredAndSortedMembers.length})
            </h1>
            <p className="mt-2 text-sm text-gray-700" data-oid="su2mjc.">
              Members from selected sections:{" "}
              {sections.map((s) => s.sectionname).join(", ")}
            </p>
          </div>
          <div
            className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3"
            data-oid="pbgvybd"
          >
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredAndSortedMembers.length === 0}
              type="button"
              data-oid="td-txz."
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                data-oid="w9h.g5v"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  data-oid="h63mv3_"
                />
              </svg>
              Export CSV
            </Button>
            {onBack && (
              <Button
                variant="outline"
                onClick={onBack}
                type="button"
                data-oid="16ejsl0"
              >
                Back to Dashboard
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4" data-oid="k2fmwuw">
        <div className="flex-1" data-oid="u.6.hsq">
          <Input
            placeholder="Search members by name, email, or section..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            data-oid="29df_qe"
          />
        </div>

        {/* Column visibility toggle for desktop */}
        {!isMobile && (
          <div className="flex flex-wrap gap-2" data-oid="2qqeztc">
            {Object.entries(visibleColumns).map(([column, visible]) => (
              <Button
                key={column}
                variant={visible ? "scout-blue" : "outline"}
                size="sm"
                onClick={() =>
                  setVisibleColumns((prev) => ({ ...prev, [column]: !visible }))
                }
                type="button"
                data-oid="wg5pzq5"
              >
                {column}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Members table/cards */}
      <div className="mt-6" data-oid="eicj3d:">
        {filteredAndSortedMembers.length === 0 ? (
          <Card data-oid="1_m2twb">
            <Card.Body className="text-center py-12" data-oid="k6tg5bs">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                data-oid="n8sf4vs"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a5 5 0 11-5 5 5 5 0 015-5z"
                  data-oid="nv22z.9"
                />
              </svg>
              <h3
                className="mt-2 text-sm font-medium text-gray-900"
                data-oid="v9i124:"
              >
                No members found
              </h3>
              <p className="mt-1 text-sm text-gray-500" data-oid="b:p.x7u">
                {searchTerm
                  ? "Try adjusting your search terms."
                  : "No members available for the selected sections."}
              </p>
            </Card.Body>
          </Card>
        ) : isMobile ? (
          // Mobile: Card layout
          <div className="space-y-4" data-oid="n7qwvbl">
            {filteredAndSortedMembers.map((member) => (
              <Card
                key={member.scoutid}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleMemberClick(member)}
                data-oid="60qapcb"
              >
                <Card.Body data-oid="no5k.uw">
                  <div
                    className="flex justify-between items-start"
                    data-oid="1fpt738"
                  >
                    <div data-oid="_nvgbcb">
                      <h3
                        className="text-lg font-medium text-gray-900"
                        data-oid="ugpe1wu"
                      >
                        {member.firstname} {member.lastname}
                      </h3>
                      <div
                        className="mt-1 flex flex-wrap gap-1"
                        data-oid="rls2zti"
                      >
                        {(member.sections || []).map((section, idx) => (
                          <Badge
                            key={idx}
                            variant="scout-blue"
                            size="sm"
                            data-oid="xq_2nsr"
                          >
                            {section}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {calculateAge(member.date_of_birth) && (
                      <Badge variant="light" data-oid="kxfeqlh">
                        Age {calculateAge(member.date_of_birth)}
                      </Badge>
                    )}
                    <Badge
                      variant={
                        member.person_type === "Leaders"
                          ? "scout-purple"
                          : member.person_type === "Young Leaders"
                            ? "scout-blue"
                            : "scout-green"
                      }
                      size="sm"
                      data-oid="dq09z3j"
                    >
                      {member.person_type || "Young People"}
                    </Badge>
                  </div>

                  <div
                    className="mt-3 space-y-1 text-sm text-gray-600"
                    data-oid="wggv-od"
                  >
                    {member.email && (
                      <div className="flex items-center" data-oid="rvu20il">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="p3q3lnq"
                        >
                          <path
                            d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"
                            data-oid="37e1:j4"
                          />

                          <path
                            d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"
                            data-oid="3ydh9zt"
                          />
                        </svg>
                        {member.email}
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center" data-oid="rgqa4ef">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="y7vyzh0"
                        >
                          <path
                            d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"
                            data-oid="ecwbub3"
                          />
                        </svg>
                        {member.phone}
                      </div>
                    )}
                    {member.patrol && (
                      <div className="flex items-center" data-oid="mf3pc0e">
                        <span data-oid="opnongx">Patrol: {member.patrol}</span>
                      </div>
                    )}

                    {/* Medical info */}
                    {member.medical_notes && (
                      <div
                        className="flex items-center text-orange-600"
                        data-oid="8nrjeyl"
                      >
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="nah5bki"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                            data-oid="z9c4gu5"
                          />
                        </svg>
                        Medical info available
                      </div>
                    )}

                    {/* Emergency contacts */}
                    {member.emergency_contacts &&
                      member.emergency_contacts.length > 0 && (
                        <div
                          className="text-xs text-gray-500"
                          data-oid="s0b:1eb"
                        >
                          Emergency contacts: {member.emergency_contacts.length}
                        </div>
                      )}
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        ) : (
          // Desktop: Table layout
          <Card data-oid="9s8y0ut">
            <div className="overflow-x-auto" data-oid="69wifqf">
              <table
                className="min-w-full divide-y divide-gray-300"
                data-oid="j50g1_q"
              >
                <thead className="bg-gray-50" data-oid="0_bo2h:">
                  <tr data-oid="f:x.02f">
                    {visibleColumns.name && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("name")}
                        data-oid="5a0jf::"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="wiigguv"
                        >
                          <span data-oid="eepbahi">Name</span>
                          <SortIcon field="name" data-oid="fl.6h4y" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.sections && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("sections")}
                        data-oid="o.9uidr"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="3lfv6n_"
                        >
                          <span data-oid="dypk2m:">Sections</span>
                          <SortIcon field="sections" data-oid="mg_d4pp" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.email && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("email")}
                        data-oid="afath13"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="emniofa"
                        >
                          <span data-oid="c8y7-w8">Email</span>
                          <SortIcon field="email" data-oid="3ej-66b" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.phone && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("phone")}
                        data-oid="63moj2k"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="7-f0724"
                        >
                          <span data-oid="wmsl6gl">Phone</span>
                          <SortIcon field="phone" data-oid="kf3cgyn" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.patrol && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("patrol")}
                        data-oid="rp:o8ti"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="vilbg:m"
                        >
                          <span data-oid="35m-usp">Patrol</span>
                          <SortIcon field="patrol" data-oid="0_a8xem" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.person_type && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("person_type")}
                        data-oid="wa3qe8v"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="d_rnh2h"
                        >
                          <span data-oid=".4i3erv">Type</span>
                          <SortIcon field="person_type" data-oid="1w8l0f1" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.address && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("address")}
                        data-oid="6c65-je"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="9q-ckfv"
                        >
                          <span data-oid="svmbdqz">Address</span>
                          <SortIcon field="address" data-oid="3oguz6r" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.medical && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="de-jmbk"
                      >
                        Medical
                      </th>
                    )}
                    {visibleColumns.emergency && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="_8rxy8i"
                      >
                        Emergency
                      </th>
                    )}
                    {visibleColumns.age && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("age")}
                        data-oid="d_qaxqp"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="wgz5_t3"
                        >
                          <span data-oid="j09ez8a">Age</span>
                          <SortIcon field="age" data-oid="-dni52e" />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="6b-:14i"
                >
                  {filteredAndSortedMembers.map((member) => (
                    <tr
                      key={member.scoutid}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleMemberClick(member)}
                      data-oid="-irgewy"
                    >
                      {visibleColumns.name && (
                        <td
                          className="px-6 py-4 whitespace-nowrap"
                          data-oid="61pavcr"
                        >
                          <div
                            className="text-sm font-medium text-gray-900"
                            data-oid="eeqsto7"
                          >
                            {member.firstname} {member.lastname}
                          </div>
                        </td>
                      )}
                      {visibleColumns.sections && (
                        <td
                          className="px-6 py-4 whitespace-nowrap"
                          data-oid="tlg1:e5"
                        >
                          <div
                            className="flex flex-wrap gap-1"
                            data-oid="jehnd:-"
                          >
                            {(member.sections || []).map((section, idx) => (
                              <Badge
                                key={idx}
                                variant="scout-blue"
                                size="sm"
                                data-oid="rcvvp9b"
                              >
                                {section}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      )}
                      {visibleColumns.email && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="y8md780"
                        >
                          {member.email}
                        </td>
                      )}
                      {visibleColumns.phone && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="u-htsv_"
                        >
                          {member.phone}
                        </td>
                      )}
                      {visibleColumns.patrol && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="v-4a55t"
                        >
                          {member.patrol}
                        </td>
                      )}
                      {visibleColumns.person_type && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="xf98hzv"
                        >
                          <Badge
                            variant={
                              member.person_type === "Leaders"
                                ? "scout-purple"
                                : member.person_type === "Young Leaders"
                                  ? "scout-blue"
                                  : "scout-green"
                            }
                            size="sm"
                            data-oid="kz539kp"
                          >
                            {member.person_type || "Young People"}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.address && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="8re8hzj"
                        >
                          <div
                            className="max-w-xs truncate"
                            title={`${member.address || ""} ${member.postcode || ""}`}
                            data-oid="71zmytm"
                          >
                            {member.address && (
                              <div data-oid="evslu8k">{member.address}</div>
                            )}
                            {member.postcode && (
                              <div className="text-gray-500" data-oid="2cp_rh6">
                                {member.postcode}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.medical && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="8uy6nh1"
                        >
                          {member.medical_notes ? (
                            <div
                              className="flex items-center text-orange-600"
                              data-oid="t9ox8:2"
                            >
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                data-oid="ewk20k3"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                  data-oid="gfeayxe"
                                />
                              </svg>
                              <span className="text-xs" data-oid="z7xc5l3">
                                Medical
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400" data-oid="rxpcf5w">
                              -
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.emergency && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="85x:o6s"
                        >
                          {member.emergency_contacts &&
                          member.emergency_contacts.length > 0 ? (
                            <div className="text-xs" data-oid="dz1uww7">
                              <div className="font-medium" data-oid="9y3uduj">
                                {member.emergency_contacts.length} contact
                                {member.emergency_contacts.length > 1
                                  ? "s"
                                  : ""}
                              </div>
                              <div
                                className="text-gray-500 truncate max-w-xs"
                                data-oid="ft8g_a7"
                              >
                                {member.emergency_contacts[0].name}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400" data-oid="oy0w96h">
                              -
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.age && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="6fg::m-"
                        >
                          {calculateAge(member.date_of_birth)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Member Detail Modal */}
      <MemberDetailModal
        member={selectedMember}
        isOpen={showMemberModal}
        onClose={handleModalClose}
        data-oid="vpvklb2"
      />
    </div>
  );
}

export default MembersList;
