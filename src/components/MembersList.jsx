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
        <span className="text-gray-300" data-oid="n2jjqj.">
          ↕
        </span>
      );
    }
    return (
      <span className="text-scout-blue" data-oid="h95bg:5">
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
    return <LoadingScreen message="Loading members..." data-oid="y_gajl." />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4" data-oid="qs2ld9n">
        <Alert.Title data-oid="1xfr:mq">Error Loading Members</Alert.Title>
        <Alert.Description data-oid="u-7vt2k">{error}</Alert.Description>
        <Alert.Actions data-oid="dj2..6-">
          <Button
            variant="scout-blue"
            onClick={loadMembers}
            type="button"
            data-oid="wfalnlp"
          >
            Retry
          </Button>
          <Button
            variant="outline"
            onClick={onBack}
            type="button"
            data-oid="ceoftwi"
          >
            Back to Dashboard
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div className={embedded ? "" : "px-4 sm:px-6 lg:px-8"} data-oid="1kfb86u">
      {/* Header - only show if not embedded */}
      {showHeader && (
        <div className="sm:flex sm:items-center" data-oid="6x41k5t">
          <div className="sm:flex-auto" data-oid="bznp79f">
            <h1
              className="text-xl font-semibold text-gray-900"
              data-oid="ecous.g"
            >
              Members ({filteredAndSortedMembers.length})
            </h1>
            <p className="mt-2 text-sm text-gray-700" data-oid="yfzj8k6">
              Members from selected sections:{" "}
              {sections.map((s) => s.sectionname).join(", ")}
            </p>
          </div>
          <div
            className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3"
            data-oid="-lbr6aj"
          >
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredAndSortedMembers.length === 0}
              type="button"
              data-oid="znmk:86"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                data-oid="1vk.2bp"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  data-oid="h6089to"
                />
              </svg>
              Export CSV
            </Button>
            {onBack && (
              <Button
                variant="outline"
                onClick={onBack}
                type="button"
                data-oid="emjr630"
              >
                Back to Dashboard
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4" data-oid="4p29.y:">
        <div className="flex-1" data-oid="7_rbvt3">
          <Input
            placeholder="Search members by name, email, or section..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            data-oid="5v3nea8"
          />
        </div>

        {/* Column visibility toggle for desktop */}
        {!isMobile && (
          <div className="flex flex-wrap gap-2" data-oid="w::nxbw">
            {Object.entries(visibleColumns).map(([column, visible]) => (
              <Button
                key={column}
                variant={visible ? "scout-blue" : "outline"}
                size="sm"
                onClick={() =>
                  setVisibleColumns((prev) => ({ ...prev, [column]: !visible }))
                }
                type="button"
                data-oid="oxxn7u7"
              >
                {column}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Members table/cards */}
      <div className="mt-6" data-oid="viyb7-4">
        {filteredAndSortedMembers.length === 0 ? (
          <Card data-oid="kwpq04q">
            <Card.Body className="text-center py-12" data-oid="tid8.__">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                data-oid="p840bd2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a5 5 0 11-5 5 5 5 0 015-5z"
                  data-oid="csyu:1j"
                />
              </svg>
              <h3
                className="mt-2 text-sm font-medium text-gray-900"
                data-oid="16e6v26"
              >
                No members found
              </h3>
              <p className="mt-1 text-sm text-gray-500" data-oid="ga2wmxk">
                {searchTerm
                  ? "Try adjusting your search terms."
                  : "No members available for the selected sections."}
              </p>
            </Card.Body>
          </Card>
        ) : isMobile ? (
          // Mobile: Card layout
          <div className="space-y-4" data-oid="-ng.x0i">
            {filteredAndSortedMembers.map((member) => (
              <Card
                key={member.scoutid}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleMemberClick(member)}
                data-oid="bfq4x45"
              >
                <Card.Body data-oid="._5wan3">
                  <div
                    className="flex justify-between items-start"
                    data-oid="xknba7x"
                  >
                    <div data-oid=":irwwqm">
                      <h3
                        className="text-lg font-medium text-gray-900"
                        data-oid="rrbg48q"
                      >
                        {member.firstname} {member.lastname}
                      </h3>
                      <div
                        className="mt-1 flex flex-wrap gap-1"
                        data-oid="x:2nuwp"
                      >
                        {(member.sections || []).map((section, idx) => (
                          <Badge
                            key={idx}
                            variant="scout-blue"
                            size="sm"
                            data-oid="0hyz15."
                          >
                            {section}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {calculateAge(member.date_of_birth) && (
                      <Badge variant="light" data-oid="qs52-n8">
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
                      data-oid=":73e03a"
                    >
                      {member.person_type || "Young People"}
                    </Badge>
                  </div>

                  <div
                    className="mt-3 space-y-1 text-sm text-gray-600"
                    data-oid="5.s-kti"
                  >
                    {member.email && (
                      <div className="flex items-center" data-oid="y:tpnj0">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="t.udfx4"
                        >
                          <path
                            d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"
                            data-oid="r46.lt:"
                          />

                          <path
                            d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"
                            data-oid="dhu:m7e"
                          />
                        </svg>
                        {member.email}
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center" data-oid="ndrsh-k">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="m2b4qnz"
                        >
                          <path
                            d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"
                            data-oid="9n5yj2f"
                          />
                        </svg>
                        {member.phone}
                      </div>
                    )}
                    {member.patrol && (
                      <div className="flex items-center" data-oid="kqr8jd2">
                        <span data-oid="dsvb7qr">Patrol: {member.patrol}</span>
                      </div>
                    )}

                    {/* Medical info */}
                    {member.medical_notes && (
                      <div
                        className="flex items-center text-orange-600"
                        data-oid="_jxtzk2"
                      >
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="9xng7xq"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                            data-oid="wejjfc6"
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
                          data-oid="9n-t257"
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
          <Card data-oid="toekp6v">
            <div className="overflow-x-auto" data-oid="c18406y">
              <table
                className="min-w-full divide-y divide-gray-300"
                data-oid="9d1jm:7"
              >
                <thead className="bg-gray-50" data-oid="3x_kr4k">
                  <tr data-oid="rg2_atv">
                    {visibleColumns.name && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("name")}
                        data-oid="7v-kiw0"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="4p_-ekc"
                        >
                          <span data-oid="4x2yzkm">Name</span>
                          <SortIcon field="name" data-oid="v1cjnn7" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.sections && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("sections")}
                        data-oid="0vycpu-"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="_q4ehuo"
                        >
                          <span data-oid="ma5lvcb">Sections</span>
                          <SortIcon field="sections" data-oid="s9lo0z:" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.email && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("email")}
                        data-oid=".26qq:n"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="163a89g"
                        >
                          <span data-oid="s9jmuom">Email</span>
                          <SortIcon field="email" data-oid="qc7900u" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.phone && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("phone")}
                        data-oid="55n9aqq"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="7vduiu_"
                        >
                          <span data-oid="z12v1j6">Phone</span>
                          <SortIcon field="phone" data-oid="fl20sss" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.patrol && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("patrol")}
                        data-oid=".6cuvy7"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid=":pdm00f"
                        >
                          <span data-oid="15q4cmh">Patrol</span>
                          <SortIcon field="patrol" data-oid=".5rqmg3" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.person_type && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("person_type")}
                        data-oid="2kwbeh7"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="e4i6m0j"
                        >
                          <span data-oid="wy:3nj2">Type</span>
                          <SortIcon field="person_type" data-oid="f7hkicz" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.address && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("address")}
                        data-oid="bstdlyz"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="jjto5bj"
                        >
                          <span data-oid="k8is7sc">Address</span>
                          <SortIcon field="address" data-oid="odsmv:w" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.medical && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="hm1-xlw"
                      >
                        Medical
                      </th>
                    )}
                    {visibleColumns.emergency && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="fxr8iy7"
                      >
                        Emergency
                      </th>
                    )}
                    {visibleColumns.age && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("age")}
                        data-oid="85dmnl7"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="nkdmxnc"
                        >
                          <span data-oid="zg9wgeh">Age</span>
                          <SortIcon field="age" data-oid="8bniwoc" />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="3dvbu2_"
                >
                  {filteredAndSortedMembers.map((member) => (
                    <tr
                      key={member.scoutid}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleMemberClick(member)}
                      data-oid="3_m1w3:"
                    >
                      {visibleColumns.name && (
                        <td
                          className="px-6 py-4 whitespace-nowrap"
                          data-oid="nu3cxgy"
                        >
                          <div
                            className="text-sm font-medium text-gray-900"
                            data-oid="q765.8t"
                          >
                            {member.firstname} {member.lastname}
                          </div>
                        </td>
                      )}
                      {visibleColumns.sections && (
                        <td
                          className="px-6 py-4 whitespace-nowrap"
                          data-oid="p_33oxd"
                        >
                          <div
                            className="flex flex-wrap gap-1"
                            data-oid="zbw.hhc"
                          >
                            {(member.sections || []).map((section, idx) => (
                              <Badge
                                key={idx}
                                variant="scout-blue"
                                size="sm"
                                data-oid=".1wzkjg"
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
                          data-oid=":cpqswc"
                        >
                          {member.email}
                        </td>
                      )}
                      {visibleColumns.phone && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="1orex.m"
                        >
                          {member.phone}
                        </td>
                      )}
                      {visibleColumns.patrol && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="_:0l188"
                        >
                          {member.patrol}
                        </td>
                      )}
                      {visibleColumns.person_type && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="cacv41h"
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
                            data-oid="cwp6x1j"
                          >
                            {member.person_type || "Young People"}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.address && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="pv6v6.y"
                        >
                          <div
                            className="max-w-xs truncate"
                            title={`${member.address || ""} ${member.postcode || ""}`}
                            data-oid="cvs-xm5"
                          >
                            {member.address && (
                              <div data-oid="ety7h11">{member.address}</div>
                            )}
                            {member.postcode && (
                              <div className="text-gray-500" data-oid="mr6kx6v">
                                {member.postcode}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.medical && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid=":g3u_ds"
                        >
                          {member.medical_notes ? (
                            <div
                              className="flex items-center text-orange-600"
                              data-oid="hrzwca5"
                            >
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                data-oid="1_nzvki"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                  data-oid="nno89lg"
                                />
                              </svg>
                              <span className="text-xs" data-oid="7iiofj5">
                                Medical
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400" data-oid="mez5agt">
                              -
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.emergency && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="hbgx:16"
                        >
                          {member.emergency_contacts &&
                          member.emergency_contacts.length > 0 ? (
                            <div className="text-xs" data-oid="gl0rb6a">
                              <div className="font-medium" data-oid="-pzrwqx">
                                {member.emergency_contacts.length} contact
                                {member.emergency_contacts.length > 1
                                  ? "s"
                                  : ""}
                              </div>
                              <div
                                className="text-gray-500 truncate max-w-xs"
                                data-oid="_1x1pdb"
                              >
                                {member.emergency_contacts[0].name}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400" data-oid="60g4a1o">
                              -
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.age && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="rmf83t."
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
        data-oid="m4zflk4"
      />
    </div>
  );
}

export default MembersList;
