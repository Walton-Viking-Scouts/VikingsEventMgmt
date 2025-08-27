import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MembersList from "../MembersList.jsx";

// Mock the API module
vi.mock("../../services/api.js", () => ({
  getListOfMembers: vi.fn(),
}));

// Mock the auth module
vi.mock("../../services/auth.js", () => ({
  getToken: vi.fn(() => "mock-token"),
}));

// Mock platform detection
vi.mock("../../utils/platform.js", () => ({
  isMobileLayout: vi.fn(() => false),
}));

describe("MembersList", () => {
  const mockSections = [
    { sectionid: 1, sectionname: "Beavers", sectiontype: "beavers" },
    { sectionid: 2, sectionname: "Cubs", sectiontype: "cubs" },
  ];

  const mockMembers = [
    {
      scoutid: 1,
      firstname: "John",
      lastname: "Doe",
      email: "john.doe@example.com",
      phone: "123-456-7890",
      sections: ["Beavers"],
      patrol: "Red Patrol",
      rank: "Scout",
      date_of_birth: "2010-05-15",
      person_type: "Young People",
    },
    {
      scoutid: 2,
      firstname: "Jane",
      lastname: "Smith",
      email: "jane.smith@example.com",
      phone: "098-765-4321",
      sections: ["Cubs", "Beavers"],
      patrol: "Blue Patrol",
      rank: "Senior Scout",
      date_of_birth: "2009-03-20",
      person_type: "Young People",
    },
  ];

  const mockOnBack = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import and mock the API function
    const { getListOfMembers } = await import("../../services/api.js");
    vi.mocked(getListOfMembers).mockResolvedValue(mockMembers);
  });

  it("renders loading screen initially", async () => {
    // Mock API to be slower so we can catch loading state
    const { getListOfMembers } = await import("../../services/api.js");
    vi.mocked(getListOfMembers).mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(mockMembers), 100)),
    );

    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="d0l:f5f"
        />,
      );
    });

    expect(screen.getByText("Loading members...")).toBeInTheDocument();
  });

  it("displays members count after loading", async () => {
    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="::a4:eu"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Members (2)")).toBeInTheDocument();
    });
  });

  it("displays section information", async () => {
    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="8ktwnax"
        />,
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("Members from selected sections: Beavers, Cubs"),
      ).toBeInTheDocument();
    });
  });

  it("shows member names after loading", async () => {
    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="q51yk6u"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });
  });

  it("displays member email addresses", async () => {
    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="e_rk:68"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
      expect(screen.getByText("jane.smith@example.com")).toBeInTheDocument();
    });
  });

  it("shows search input", async () => {
    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="mrlux_7"
        />,
      );
    });

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(
          "Search members by name, email, or section...",
        ),
      ).toBeInTheDocument();
    });
  });

  it("filters members when searching", async () => {
    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="bmkj7:m"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      "Search members by name, email, or section...",
    );
    fireEvent.change(searchInput, { target: { value: "john" } });

    // John should still be visible
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    // Jane should be filtered out
    expect(screen.queryByText("Jane Smith")).not.toBeInTheDocument();
  });

  it("shows back button", async () => {
    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="ifmkg_l"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
    });
  });

  it("calls onBack when back button is clicked", async () => {
    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="ep7opby"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
    });

    const backButton = screen.getByText("Back to Dashboard");
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it("shows export button", async () => {
    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="yb38gli"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Export CSV")).toBeInTheDocument();
    });
  });

  it("handles API error gracefully", async () => {
    // Mock API to reject
    const { getListOfMembers } = await import("../../services/api.js");
    vi.mocked(getListOfMembers).mockRejectedValue(
      new Error("Failed to load members"),
    );

    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="j6n6ed3"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Error Loading Members")).toBeInTheDocument();
      expect(screen.getByText("Failed to load members")).toBeInTheDocument();
    });
  });

  it("shows retry and back buttons on error", async () => {
    // Mock API to reject
    const { getListOfMembers } = await import("../../services/api.js");
    vi.mocked(getListOfMembers).mockRejectedValue(new Error("API Error"));

    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="6zbx8z7"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Retry")).toBeInTheDocument();
      expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
    });
  });

  it("displays empty state when no members found", async () => {
    // Mock API to return empty array
    const { getListOfMembers } = await import("../../services/api.js");
    vi.mocked(getListOfMembers).mockResolvedValue([]);

    await act(async () => {
      render(
        <MembersList
          sections={mockSections}
          onBack={mockOnBack}
          data-oid="gdm6p_z"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Members (0)")).toBeInTheDocument();
      expect(screen.getByText("No members found")).toBeInTheDocument();
    });
  });
});
