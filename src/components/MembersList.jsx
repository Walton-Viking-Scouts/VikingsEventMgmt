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
        <span className="text-gray-300" data-oid="2m_gbh_">
          ↕
        </span>
      );
    }
    return (
      <span className="text-scout-blue" data-oid="h_j8:sr">
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
    return <LoadingScreen message="Loading members..." data-oid="m2agwu4" />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4" data-oid="k47jszw">
        <Alert.Title data-oid="4ze:er8">Error Loading Members</Alert.Title>
        <Alert.Description data-oid="cijdq7-">{error}</Alert.Description>
        <Alert.Actions data-oid="y9pm3ke">
          <Button
            variant="scout-blue"
            onClick={loadMembers}
            type="button"
            data-oid="q-6ejy."
          >
            Retry
          </Button>
          <Button
            variant="outline"
            onClick={onBack}
            type="button"
            data-oid="mrsi7op"
          >
            Back to Dashboard
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div className={embedded ? "" : "px-4 sm:px-6 lg:px-8"} data-oid="qj5i92s">
      {/* Header - only show if not embedded */}
      {showHeader && (
        <div className="sm:flex sm:items-center" data-oid="n88b:55">
          <div className="sm:flex-auto" data-oid="gcsczpp">
            <h1
              className="text-xl font-semibold text-gray-900"
              data-oid="-5ttz2_"
            >
              Members ({filteredAndSortedMembers.length})
            </h1>
            <p className="mt-2 text-sm text-gray-700" data-oid="o:h6igx">
              Members from selected sections:{" "}
              {sections.map((s) => s.sectionname).join(", ")}
            </p>
          </div>
          <div
            className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3"
            data-oid="::l.m98"
          >
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredAndSortedMembers.length === 0}
              type="button"
              data-oid=":ulbmnv"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                data-oid="isc3:15"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  data-oid="-pw_r.f"
                />
              </svg>
              Export CSV
            </Button>
            {onBack && (
              <Button
                variant="outline"
                onClick={onBack}
                type="button"
                data-oid="qef9ou0"
              >
                Back to Dashboard
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4" data-oid="qrcizhn">
        <div className="flex-1" data-oid="h8gksfo">
          <Input
            placeholder="Search members by name, email, or section..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            data-oid="9b:90-5"
          />
        </div>

        {/* Column visibility toggle for desktop */}
        {!isMobile && (
          <div className="flex flex-wrap gap-2" data-oid="a07l7c4">
            {Object.entries(visibleColumns).map(([column, visible]) => (
              <Button
                key={column}
                variant={visible ? "scout-blue" : "outline"}
                size="sm"
                onClick={() =>
                  setVisibleColumns((prev) => ({ ...prev, [column]: !visible }))
                }
                type="button"
                data-oid="sayg3bj"
              >
                {column}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Members table/cards */}
      <div className="mt-6" data-oid="wp46db-">
        {filteredAndSortedMembers.length === 0 ? (
          <Card data-oid="d4h7o_j">
            <Card.Body className="text-center py-12" data-oid="-_:sc6r">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                data-oid="o-sh2em"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a5 5 0 11-5 5 5 5 0 015-5z"
                  data-oid="tir1ghb"
                />
              </svg>
              <h3
                className="mt-2 text-sm font-medium text-gray-900"
                data-oid="801iw18"
              >
                No members found
              </h3>
              <p className="mt-1 text-sm text-gray-500" data-oid="c:qyeux">
                {searchTerm
                  ? "Try adjusting your search terms."
                  : "No members available for the selected sections."}
              </p>
            </Card.Body>
          </Card>
        ) : isMobile ? (
          // Mobile: Card layout
          <div className="space-y-4" data-oid="zkckj59">
            {filteredAndSortedMembers.map((member) => (
              <Card
                key={member.scoutid}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleMemberClick(member)}
                data-oid="3b_n6_4"
              >
                <Card.Body data-oid="-.gd3h2">
                  <div
                    className="flex justify-between items-start"
                    data-oid="lwee9t5"
                  >
                    <div data-oid="a-d90wt">
                      <h3
                        className="text-lg font-medium text-gray-900"
                        data-oid="ju_qo3z"
                      >
                        {member.firstname} {member.lastname}
                      </h3>
                      <div
                        className="mt-1 flex flex-wrap gap-1"
                        data-oid="y712ic_"
                      >
                        {(member.sections || []).map((section, idx) => (
                          <Badge
                            key={idx}
                            variant="scout-blue"
                            size="sm"
                            data-oid="qe06qg-"
                          >
                            {section}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {calculateAge(member.date_of_birth) && (
                      <Badge variant="light" data-oid="gjiurv6">
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
                      data-oid="pnx-rsm"
                    >
                      {member.person_type || "Young People"}
                    </Badge>
                  </div>

                  <div
                    className="mt-3 space-y-1 text-sm text-gray-600"
                    data-oid="0ush-ah"
                  >
                    {member.email && (
                      <div className="flex items-center" data-oid="kpl-8l9">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="gacd4fj"
                        >
                          <path
                            d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"
                            data-oid="wtf4etq"
                          />

                          <path
                            d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"
                            data-oid="-i.4lm5"
                          />
                        </svg>
                        {member.email}
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center" data-oid="jigcu0d">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="a5c-w6t"
                        >
                          <path
                            d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"
                            data-oid="8vj.r6g"
                          />
                        </svg>
                        {member.phone}
                      </div>
                    )}
                    {member.patrol && (
                      <div className="flex items-center" data-oid="kez6_0w">
                        <span data-oid="at-4dms">Patrol: {member.patrol}</span>
                      </div>
                    )}

                    {/* Medical info */}
                    {member.medical_notes && (
                      <div
                        className="flex items-center text-orange-600"
                        data-oid="9ms6e1y"
                      >
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="qb656b5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                            data-oid="3pa4k.f"
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
                          data-oid="hfak5h5"
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
          <Card data-oid="sufdj:g">
            <div className="overflow-x-auto" data-oid="cpyx_mq">
              <table
                className="min-w-full divide-y divide-gray-300"
                data-oid="izr_44d"
              >
                <thead className="bg-gray-50" data-oid="ab.ni0u">
                  <tr data-oid="olz8luf">
                    {visibleColumns.name && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("name")}
                        data-oid="-pichr7"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="k.63y7l"
                        >
                          <span data-oid="fjg7wc_">Name</span>
                          <SortIcon field="name" data-oid="_l76sbo" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.sections && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("sections")}
                        data-oid="hib-2vf"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="l8udl-9"
                        >
                          <span data-oid=".bysbmo">Sections</span>
                          <SortIcon field="sections" data-oid="c2216q7" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.email && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("email")}
                        data-oid="1ucj704"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="89tbapp"
                        >
                          <span data-oid="q42nc_1">Email</span>
                          <SortIcon field="email" data-oid="ue.ogtx" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.phone && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("phone")}
                        data-oid="xaizsd9"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="iwk6z7l"
                        >
                          <span data-oid="9ubo1t4">Phone</span>
                          <SortIcon field="phone" data-oid="lm2:4r2" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.patrol && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("patrol")}
                        data-oid="a32cz:."
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="ymsp205"
                        >
                          <span data-oid="i3jxh72">Patrol</span>
                          <SortIcon field="patrol" data-oid="6373nxw" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.person_type && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("person_type")}
                        data-oid="wu7b32f"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="d:go1f9"
                        >
                          <span data-oid="uwh9omp">Type</span>
                          <SortIcon field="person_type" data-oid="g6h6kb3" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.address && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("address")}
                        data-oid="q1ed-pe"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="qpoo0wm"
                        >
                          <span data-oid="w08vgco">Address</span>
                          <SortIcon field="address" data-oid="g2zc0xp" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.medical && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="j:zchu0"
                      >
                        Medical
                      </th>
                    )}
                    {visibleColumns.emergency && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="3jzu4k2"
                      >
                        Emergency
                      </th>
                    )}
                    {visibleColumns.age && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("age")}
                        data-oid="m94ap0k"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="tm:g4yd"
                        >
                          <span data-oid="htmb4jl">Age</span>
                          <SortIcon field="age" data-oid="bwao_ux" />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="b.gkx9e"
                >
                  {filteredAndSortedMembers.map((member) => (
                    <tr
                      key={member.scoutid}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleMemberClick(member)}
                      data-oid="-zac4co"
                    >
                      {visibleColumns.name && (
                        <td
                          className="px-6 py-4 whitespace-nowrap"
                          data-oid="xe94nx7"
                        >
                          <div
                            className="text-sm font-medium text-gray-900"
                            data-oid="q6vtxq1"
                          >
                            {member.firstname} {member.lastname}
                          </div>
                        </td>
                      )}
                      {visibleColumns.sections && (
                        <td
                          className="px-6 py-4 whitespace-nowrap"
                          data-oid="41mlq7n"
                        >
                          <div
                            className="flex flex-wrap gap-1"
                            data-oid="d6vguvq"
                          >
                            {(member.sections || []).map((section, idx) => (
                              <Badge
                                key={idx}
                                variant="scout-blue"
                                size="sm"
                                data-oid="60tthe9"
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
                          data-oid="nmc9t0z"
                        >
                          {member.email}
                        </td>
                      )}
                      {visibleColumns.phone && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="aaa_m_2"
                        >
                          {member.phone}
                        </td>
                      )}
                      {visibleColumns.patrol && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="4..01pr"
                        >
                          {member.patrol}
                        </td>
                      )}
                      {visibleColumns.person_type && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="bcnoid2"
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
                            data-oid="b2_cxrb"
                          >
                            {member.person_type || "Young People"}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.address && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="n4w-8nj"
                        >
                          <div
                            className="max-w-xs truncate"
                            title={`${member.address || ""} ${member.postcode || ""}`}
                            data-oid="v4jqgqp"
                          >
                            {member.address && (
                              <div data-oid="hps5a2o">{member.address}</div>
                            )}
                            {member.postcode && (
                              <div className="text-gray-500" data-oid="ujm1752">
                                {member.postcode}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.medical && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="heyuh88"
                        >
                          {member.medical_notes ? (
                            <div
                              className="flex items-center text-orange-600"
                              data-oid=":wgh1-_"
                            >
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                data-oid="33dbedm"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                  data-oid="2axep:."
                                />
                              </svg>
                              <span className="text-xs" data-oid="wxsdwsq">
                                Medical
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400" data-oid="196p1p_">
                              -
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.emergency && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="rf7bxnd"
                        >
                          {member.emergency_contacts &&
                          member.emergency_contacts.length > 0 ? (
                            <div className="text-xs" data-oid="j1dkvp2">
                              <div className="font-medium" data-oid="2e.kagk">
                                {member.emergency_contacts.length} contact
                                {member.emergency_contacts.length > 1
                                  ? "s"
                                  : ""}
                              </div>
                              <div
                                className="text-gray-500 truncate max-w-xs"
                                data-oid="jss112d"
                              >
                                {member.emergency_contacts[0].name}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400" data-oid="1xk4fs8">
                              -
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.age && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="nq0ccx6"
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
        data-oid="qv4rs56"
      />
    </div>
  );
}

export default MembersList;
