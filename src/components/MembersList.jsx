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
        <span className="text-gray-300" data-oid="is.b884">
          ↕
        </span>
      );
    }
    return (
      <span className="text-scout-blue" data-oid="cs_tdha">
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
    return <LoadingScreen message="Loading members..." data-oid=".h7qe-s" />;
  }

  if (error) {
    return (
      <Alert variant="danger" className="m-4" data-oid="x1_ab3o">
        <Alert.Title data-oid="9tt8hgu">Error Loading Members</Alert.Title>
        <Alert.Description data-oid="q6g43st">{error}</Alert.Description>
        <Alert.Actions data-oid="hrm1.ex">
          <Button
            variant="scout-blue"
            onClick={loadMembers}
            type="button"
            data-oid="n7w.lee"
          >
            Retry
          </Button>
          <Button
            variant="outline"
            onClick={onBack}
            type="button"
            data-oid="hb5lowc"
          >
            Back to Dashboard
          </Button>
        </Alert.Actions>
      </Alert>
    );
  }

  return (
    <div className={embedded ? "" : "px-4 sm:px-6 lg:px-8"} data-oid="c_nrn7-">
      {/* Header - only show if not embedded */}
      {showHeader && (
        <div className="sm:flex sm:items-center" data-oid="ed32._-">
          <div className="sm:flex-auto" data-oid="x8n423n">
            <h1
              className="text-xl font-semibold text-gray-900"
              data-oid="1:7cjzo"
            >
              Members ({filteredAndSortedMembers.length})
            </h1>
            <p className="mt-2 text-sm text-gray-700" data-oid="f:xb_ft">
              Members from selected sections:{" "}
              {sections.map((s) => s.sectionname).join(", ")}
            </p>
          </div>
          <div
            className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3"
            data-oid="yo60dh."
          >
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredAndSortedMembers.length === 0}
              type="button"
              data-oid="z3kfjku"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                data-oid="-mf.onz"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  data-oid="vm48z-7"
                />
              </svg>
              Export CSV
            </Button>
            {onBack && (
              <Button
                variant="outline"
                onClick={onBack}
                type="button"
                data-oid="k9nrnev"
              >
                Back to Dashboard
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="mt-6 flex flex-col sm:flex-row gap-4" data-oid="153rdnq">
        <div className="flex-1" data-oid="1g19.nc">
          <Input
            placeholder="Search members by name, email, or section..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            data-oid="xnlx3mp"
          />
        </div>

        {/* Column visibility toggle for desktop */}
        {!isMobile && (
          <div className="flex flex-wrap gap-2" data-oid="0185f-8">
            {Object.entries(visibleColumns).map(([column, visible]) => (
              <Button
                key={column}
                variant={visible ? "scout-blue" : "outline"}
                size="sm"
                onClick={() =>
                  setVisibleColumns((prev) => ({ ...prev, [column]: !visible }))
                }
                type="button"
                data-oid="p76v8s8"
              >
                {column}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Members table/cards */}
      <div className="mt-6" data-oid="9n6sd2o">
        {filteredAndSortedMembers.length === 0 ? (
          <Card data-oid="lmu0zba">
            <Card.Body className="text-center py-12" data-oid="w0sijj0">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                data-oid="l_2y6wb"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-1a5 5 0 11-5 5 5 5 0 015-5z"
                  data-oid="6tvnht-"
                />
              </svg>
              <h3
                className="mt-2 text-sm font-medium text-gray-900"
                data-oid="3af.xk-"
              >
                No members found
              </h3>
              <p className="mt-1 text-sm text-gray-500" data-oid="-kox895">
                {searchTerm
                  ? "Try adjusting your search terms."
                  : "No members available for the selected sections."}
              </p>
            </Card.Body>
          </Card>
        ) : isMobile ? (
          // Mobile: Card layout
          <div className="space-y-4" data-oid="3_32raq">
            {filteredAndSortedMembers.map((member) => (
              <Card
                key={member.scoutid}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleMemberClick(member)}
                data-oid="g4msj7y"
              >
                <Card.Body data-oid="_.m1fi.">
                  <div
                    className="flex justify-between items-start"
                    data-oid="hg8c_nz"
                  >
                    <div data-oid="emvgnt1">
                      <h3
                        className="text-lg font-medium text-gray-900"
                        data-oid="r_.dq9e"
                      >
                        {member.firstname} {member.lastname}
                      </h3>
                      <div
                        className="mt-1 flex flex-wrap gap-1"
                        data-oid=".p7ep01"
                      >
                        {(member.sections || []).map((section, idx) => (
                          <Badge
                            key={idx}
                            variant="scout-blue"
                            size="sm"
                            data-oid="t41mhsh"
                          >
                            {section}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {calculateAge(member.date_of_birth) && (
                      <Badge variant="light" data-oid=".8y349q">
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
                      data-oid="b7aw3om"
                    >
                      {member.person_type || "Young People"}
                    </Badge>
                  </div>

                  <div
                    className="mt-3 space-y-1 text-sm text-gray-600"
                    data-oid="rw0livj"
                  >
                    {member.email && (
                      <div className="flex items-center" data-oid="1td3jjp">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="3oqh92z"
                        >
                          <path
                            d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"
                            data-oid="8tgrodm"
                          />

                          <path
                            d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"
                            data-oid="sfdjr3t"
                          />
                        </svg>
                        {member.email}
                      </div>
                    )}
                    {member.phone && (
                      <div className="flex items-center" data-oid="m0j2_6k">
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="dowaupf"
                        >
                          <path
                            d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"
                            data-oid="kxam2ye"
                          />
                        </svg>
                        {member.phone}
                      </div>
                    )}
                    {member.patrol && (
                      <div className="flex items-center" data-oid="jx5j6ln">
                        <span data-oid="b7jb0y5">Patrol: {member.patrol}</span>
                      </div>
                    )}

                    {/* Medical info */}
                    {member.medical_notes && (
                      <div
                        className="flex items-center text-orange-600"
                        data-oid="iuqm7ge"
                      >
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          data-oid="9t8z4s."
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                            data-oid="yd9_g2r"
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
                          data-oid="p735a89"
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
          <Card data-oid="8akx1sh">
            <div className="overflow-x-auto" data-oid="swe-eyd">
              <table
                className="min-w-full divide-y divide-gray-300"
                data-oid="os-wbxg"
              >
                <thead className="bg-gray-50" data-oid="ucza2c8">
                  <tr data-oid="6.uh.vz">
                    {visibleColumns.name && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("name")}
                        data-oid="sguitx6"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="g0ptfvm"
                        >
                          <span data-oid="yjqilxn">Name</span>
                          <SortIcon field="name" data-oid="ee-udgx" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.sections && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("sections")}
                        data-oid="m:vb1l0"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="fg9j.15"
                        >
                          <span data-oid="zenq4-1">Sections</span>
                          <SortIcon field="sections" data-oid="7x:try:" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.email && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("email")}
                        data-oid="fzc38.g"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="gk9.7o1"
                        >
                          <span data-oid="a1o5fzm">Email</span>
                          <SortIcon field="email" data-oid="x::52a_" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.phone && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("phone")}
                        data-oid=".q:3:6-"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="kqsqk3s"
                        >
                          <span data-oid="8ollydw">Phone</span>
                          <SortIcon field="phone" data-oid="mfi9uhb" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.patrol && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("patrol")}
                        data-oid="h0o-f5q"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="t27sx4c"
                        >
                          <span data-oid="0k1h_vb">Patrol</span>
                          <SortIcon field="patrol" data-oid="gq.l-5h" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.person_type && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("person_type")}
                        data-oid="esk1o44"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="46nldb7"
                        >
                          <span data-oid="j00bof8">Type</span>
                          <SortIcon field="person_type" data-oid="f6et:13" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.address && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("address")}
                        data-oid="_osotr:"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="4iqu_-i"
                        >
                          <span data-oid="yu7rd8_">Address</span>
                          <SortIcon field="address" data-oid="4:b9ph_" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.medical && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="efbn_15"
                      >
                        Medical
                      </th>
                    )}
                    {visibleColumns.emergency && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        data-oid="1.-_s9o"
                      >
                        Emergency
                      </th>
                    )}
                    {visibleColumns.age && (
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort("age")}
                        data-oid="q6dmihe"
                      >
                        <div
                          className="flex items-center space-x-1"
                          data-oid="91n75y:"
                        >
                          <span data-oid="g2oe3l9">Age</span>
                          <SortIcon field="age" data-oid=".-g1pg-" />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody
                  className="bg-white divide-y divide-gray-200"
                  data-oid="c0ouq9p"
                >
                  {filteredAndSortedMembers.map((member) => (
                    <tr
                      key={member.scoutid}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleMemberClick(member)}
                      data-oid="z.ziblp"
                    >
                      {visibleColumns.name && (
                        <td
                          className="px-6 py-4 whitespace-nowrap"
                          data-oid="so8qc-8"
                        >
                          <div
                            className="text-sm font-medium text-gray-900"
                            data-oid="a-ikm5v"
                          >
                            {member.firstname} {member.lastname}
                          </div>
                        </td>
                      )}
                      {visibleColumns.sections && (
                        <td
                          className="px-6 py-4 whitespace-nowrap"
                          data-oid="1duw4zr"
                        >
                          <div
                            className="flex flex-wrap gap-1"
                            data-oid="85cvus:"
                          >
                            {(member.sections || []).map((section, idx) => (
                              <Badge
                                key={idx}
                                variant="scout-blue"
                                size="sm"
                                data-oid="ho-4lxm"
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
                          data-oid="tevqo2t"
                        >
                          {member.email}
                        </td>
                      )}
                      {visibleColumns.phone && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="7.b8s:f"
                        >
                          {member.phone}
                        </td>
                      )}
                      {visibleColumns.patrol && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="k8io8ev"
                        >
                          {member.patrol}
                        </td>
                      )}
                      {visibleColumns.person_type && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="hfl-_qp"
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
                            data-oid="bremz2:"
                          >
                            {member.person_type || "Young People"}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.address && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="8:tlc25"
                        >
                          <div
                            className="max-w-xs truncate"
                            title={`${member.address || ""} ${member.postcode || ""}`}
                            data-oid="lfgqedu"
                          >
                            {member.address && (
                              <div data-oid="2ljajkl">{member.address}</div>
                            )}
                            {member.postcode && (
                              <div className="text-gray-500" data-oid="9c9e-pk">
                                {member.postcode}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.medical && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="jl24z9q"
                        >
                          {member.medical_notes ? (
                            <div
                              className="flex items-center text-orange-600"
                              data-oid="db0o_fx"
                            >
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                                data-oid="7n7w8j1"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                  data-oid="xp0axs3"
                                />
                              </svg>
                              <span className="text-xs" data-oid=".8uae81">
                                Medical
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400" data-oid="t1w1inn">
                              -
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.emergency && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="s4yjf9e"
                        >
                          {member.emergency_contacts &&
                          member.emergency_contacts.length > 0 ? (
                            <div className="text-xs" data-oid="_zq-4nw">
                              <div className="font-medium" data-oid="7j9nou7">
                                {member.emergency_contacts.length} contact
                                {member.emergency_contacts.length > 1
                                  ? "s"
                                  : ""}
                              </div>
                              <div
                                className="text-gray-500 truncate max-w-xs"
                                data-oid="9x_t-a."
                              >
                                {member.emergency_contacts[0].name}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400" data-oid="bb7z40g">
                              -
                            </span>
                          )}
                        </td>
                      )}
                      {visibleColumns.age && (
                        <td
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          data-oid="u8be9:j"
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
        data-oid="7i5n6z5"
      />
    </div>
  );
}

export default MembersList;
