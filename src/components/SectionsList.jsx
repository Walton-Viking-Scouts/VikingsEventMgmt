import React from "react";
import { Card } from "./ui";
import MembersList from "./MembersList.jsx";

function SectionsList({
  sections,
  selectedSections = [],
  onSectionToggle,
  loadingSection = null,
}) {
  if (!sections || sections.length === 0) {
    return (
      <Card data-oid="de.aoaz">
        <Card.Body className="text-center p-8" data-oid="ry9t81c">
          <h2
            className="text-xl font-semibold text-gray-900 mb-2"
            data-oid="a4t6f:."
          >
            No Sections Available
          </h2>
          <p className="text-gray-600" data-oid="fbi04qa">
            No sections found for your account. Please check your OSM
            permissions.
          </p>
        </Card.Body>
      </Card>
    );
  }

  const isSectionSelected = (sectionId) => {
    return selectedSections.some((s) => s.sectionid === sectionId);
  };

  const getSectionOrder = (sectionType) => {
    const type = sectionType.toLowerCase();
    if (type.includes("earlyyears")) return 1;
    if (type.includes("beavers")) return 2;
    if (type.includes("cubs")) return 3;
    if (type.includes("scouts")) return 4;
    if (type.includes("adults")) return 5;
    if (type.includes("waitinglist")) return 6;
    return 7; // Unknown sections at the end
  };

  const getDayOrder = (sectionName) => {
    const name = sectionName.toLowerCase();
    if (name.includes("monday")) return 1;
    if (name.includes("tuesday")) return 2;
    if (name.includes("wednesday")) return 3;
    if (name.includes("thursday")) return 4;
    if (name.includes("friday")) return 5;
    if (name.includes("saturday")) return 6;
    if (name.includes("sunday")) return 7;
    return 8; // No day mentioned - put at end
  };

  const sortedSections = [...sections].sort((a, b) => {
    const sectionOrderA = getSectionOrder(a.section);
    const sectionOrderB = getSectionOrder(b.section);

    // First sort by section type
    if (sectionOrderA !== sectionOrderB) {
      return sectionOrderA - sectionOrderB;
    }

    // Then sort by day of the week within same section type
    return getDayOrder(a.sectionname) - getDayOrder(b.sectionname);
  });

  return (
    <Card data-oid="2c.s3hh">
      <Card.Header data-oid="d7c-ou8">
        <Card.Title data-oid="solgnx_">Select Sections</Card.Title>
      </Card.Header>

      <Card.Body data-oid="ri-w62l">
        <div
          className="flex flex-wrap justify-center"
          style={{ gap: "30px" }}
          data-oid="yuqpqw4"
        >
          {sortedSections.map((section) => {
            const isSelected = isSectionSelected(section.sectionid);
            const isLoading = loadingSection === section.sectionid;
            const sectionType = section.section.toLowerCase();

            // Determine background color based on section type
            let bgColor, hoverBgColor;
            if (sectionType.includes("earlyyears")) {
              bgColor = "var(--scout-red)";
              hoverBgColor = "var(--scout-red-dark)";
            } else if (sectionType.includes("beavers")) {
              bgColor = "var(--scout-blue)";
              hoverBgColor = "var(--scout-blue-dark)";
            } else if (sectionType.includes("cubs")) {
              bgColor = "var(--scout-forest-green)";
              hoverBgColor = "var(--scout-forest-green-dark)";
            } else if (sectionType.includes("scouts")) {
              bgColor = "var(--scout-navy)";
              hoverBgColor = "var(--scout-navy-dark)";
            } else if (sectionType.includes("adults")) {
              bgColor = "var(--scout-purple)";
              hoverBgColor = "var(--scout-purple-dark)";
            } else if (sectionType.includes("waitinglist")) {
              bgColor = "var(--scout-teal)";
              hoverBgColor = "var(--scout-teal-dark)";
            } else {
              bgColor = "var(--scout-purple)";
              hoverBgColor = "var(--scout-purple-dark)";
            }

            return (
              <button
                key={section.sectionid}
                onClick={() => onSectionToggle(section)}
                disabled={isLoading}
                style={{
                  padding: "10px",
                  backgroundColor: isSelected ? hoverBgColor : bgColor,
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: "500",
                  minWidth: "120px",
                  opacity: isLoading ? 0.6 : isSelected ? 1 : 0.8,
                  transform: isSelected ? "scale(1.05)" : "scale(1)",
                  boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.target.style.backgroundColor = hoverBgColor;
                    e.target.style.opacity = 1;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.target.style.backgroundColor = isSelected
                      ? hoverBgColor
                      : bgColor;
                    e.target.style.opacity = isSelected ? 1 : 0.8;
                  }
                }}
                data-oid="-w7mq5i"
              >
                {isLoading && (
                  <svg
                    className="animate-spin h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    data-oid="glzlpdi"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      data-oid="6:yirah"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      data-oid="v:9ro8w"
                    ></path>
                  </svg>
                )}
                {isLoading ? "Loading..." : section.sectionname}
              </button>
            );
          })}
        </div>
      </Card.Body>

      {/* Members Area - Show when sections are selected */}
      {selectedSections && selectedSections.length > 0 && (
        <Card.Body
          className="border-t border-gray-200 bg-gray-50"
          data-oid="wa.lpc0"
        >
          <div className="mb-4" data-oid="y726obn">
            <h4
              className="text-lg font-semibold text-gray-900"
              data-oid="yv1hpdq"
            >
              Members from {selectedSections.length} section
              {selectedSections.length === 1 ? "" : "s"}
            </h4>
            <p className="text-sm text-gray-600" data-oid="r.rco_f">
              {selectedSections.map((s) => s.sectionname).join(", ")}
            </p>
          </div>

          {/* Embedded Members List */}
          <div
            className="bg-white rounded-lg border border-gray-200"
            data-oid="mew0ef."
          >
            <MembersList
              embedded={true}
              showHeader={false}
              sections={selectedSections}
              data-oid="v7s6d.-"
            />
          </div>
        </Card.Body>
      )}
    </Card>
  );
}

export default SectionsList;
