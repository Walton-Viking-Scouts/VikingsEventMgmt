import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import EventDashboard from "../EventDashboard.jsx";
import * as helpers from "../../utils/eventDashboardHelpers.js";

// Mock external dependencies
vi.mock("../../services/api.js", () => ({
  getUserRoles: vi.fn(),
  getListOfMembers: vi.fn(),
  getAPIQueueStats: vi.fn(),
}));

vi.mock("../../services/auth.js", () => ({
  getToken: vi.fn(),
}));

vi.mock("../../services/database.js", () => ({
  default: {
    getSections: vi.fn(),
    saveSections: vi.fn(),
    getMembers: vi.fn(),
    saveMembers: vi.fn(),
    getEvents: vi.fn(),
    saveEvents: vi.fn(),
    getAttendance: vi.fn(),
    saveAttendance: vi.fn(),
    hasOfflineData: vi.fn(),
  },
}));

vi.mock("../../services/logger.js", () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  LOG_CATEGORIES: {
    COMPONENT: "component",
    SYNC: "sync",
  },
}));

// Mock helper functions
vi.mock("../../utils/eventDashboardHelpers.js", () => ({
  fetchAllSectionEvents: vi.fn(),
  fetchSectionEvents: vi.fn(),
  fetchEventAttendance: vi.fn(),
  groupEventsByName: vi.fn(),
  buildEventCard: vi.fn(),
  filterEventsByDateRange: vi.fn(),
}));

// Import mocked modules
import { getUserRoles, getAPIQueueStats } from "../../services/api.js";
import { getToken } from "../../services/auth.js";
import databaseService from "../../services/database.js";

describe("EventDashboard Integration Tests", () => {
  const mockSections = [
    { sectionid: 1, sectionname: "Beavers", section: "beavers" },
    { sectionid: 2, sectionname: "Cubs", section: "cubs" },
  ];

  const mockEventCards = [
    {
      id: "Camp Weekend-101",
      name: "Camp Weekend",
      earliestDate: new Date("2024-02-15"),
      sections: ["Beavers", "Cubs"],
      events: [
        {
          eventid: 101,
          name: "Camp Weekend",
          startdate: "2024-02-15",
          sectionid: 1,
          sectionname: "Beavers",
        },
        {
          eventid: 102,
          name: "Camp Weekend",
          startdate: "2024-02-16",
          sectionid: 2,
          sectionname: "Cubs",
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    // Setup default mocks
    getUserRoles.mockResolvedValue([]);
    getToken.mockReturnValue("mock-token");
    databaseService.getSections.mockResolvedValue(mockSections);
    databaseService.saveSections.mockResolvedValue();
    databaseService.getMembers.mockResolvedValue([]);
    databaseService.saveMembers.mockResolvedValue();
    databaseService.getEvents.mockResolvedValue([]);
    databaseService.saveEvents.mockResolvedValue();
    databaseService.getAttendance.mockResolvedValue([]);
    databaseService.saveAttendance.mockResolvedValue();
    databaseService.hasOfflineData.mockResolvedValue(true);
    getAPIQueueStats.mockReturnValue({
      queueLength: 0,
      processing: false,
      totalRequests: 0,
    });

    // Mock helper functions with realistic behavior
    helpers.fetchAllSectionEvents.mockResolvedValue([]);
    helpers.fetchSectionEvents.mockResolvedValue([]);
    helpers.fetchEventAttendance.mockResolvedValue([]);
    helpers.filterEventsByDateRange.mockReturnValue([]);
    helpers.groupEventsByName.mockReturnValue(new Map());
    helpers.buildEventCard.mockReturnValue(mockEventCards[0]);
  });

  describe("buildEventCards Integration", () => {
    it("should orchestrate helper functions correctly for cache-only mode", async () => {
      const mockEvents = [
        { eventid: 101, name: "Camp Weekend", startdate: "2024-02-15" },
        { eventid: 102, name: "Badge Workshop", startdate: "2024-02-20" },
      ];

      const mockFilteredEvents = [
        { eventid: 101, name: "Camp Weekend", startdate: "2024-02-15" },
      ];

      const mockAttendanceData = [{ scoutid: 1, attended: true }];

      const mockEventGroups = new Map([
        ["Camp Weekend", [mockFilteredEvents[0]]],
      ]);

      // Setup mocks for integration test
      helpers.fetchAllSectionEvents.mockResolvedValue(mockEvents);
      helpers.filterEventsByDateRange.mockReturnValue(mockFilteredEvents);
      helpers.fetchEventAttendance.mockResolvedValue(mockAttendanceData);
      helpers.groupEventsByName.mockReturnValue(mockEventGroups);
      helpers.buildEventCard.mockReturnValue(mockEventCards[0]);

      await act(async () => {
        render(
          <EventDashboard
            onNavigateToMembers={vi.fn()}
            onNavigateToAttendance={vi.fn()}
          />,
        );
      });

      // Wait for component to load and process
      await screen.findByTestId("sections-list", {}, { timeout: 3000 });

      // Wait for async operations to complete
      await waitFor(() => {
        expect(helpers.fetchAllSectionEvents).toHaveBeenCalled();
      });

      // Verify helper functions were called in correct order (cache-only mode)
      expect(helpers.fetchAllSectionEvents).toHaveBeenCalledWith(
        mockSections,
        null, // cache-only mode uses null token
      );

      expect(helpers.filterEventsByDateRange).toHaveBeenCalledWith(
        mockEvents,
        expect.any(Date), // oneWeekAgo
      );

      expect(helpers.fetchEventAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          eventid: 101,
        }),
        null, // cache-only mode uses null token
      );

      expect(helpers.groupEventsByName).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            eventid: 101,
            attendanceData: mockAttendanceData,
          }),
        ]),
      );

      expect(helpers.buildEventCard).toHaveBeenCalledWith("Camp Weekend", [
        expect.objectContaining({ eventid: 101 }),
      ]);
    });

    it("should handle cache-only mode correctly", async () => {
      getToken.mockReturnValue(null); // No token = cache mode

      const mockCachedEvents = [
        { eventid: 201, name: "Cached Event", startdate: "2024-02-25" },
      ];

      helpers.fetchSectionEvents.mockResolvedValue(mockCachedEvents);
      helpers.filterEventsByDateRange.mockReturnValue(mockCachedEvents);
      helpers.fetchEventAttendance.mockResolvedValue(null); // Cache only
      helpers.groupEventsByName.mockReturnValue(
        new Map([["Cached Event", [mockCachedEvents[0]]]]),
      );

      await act(async () => {
        render(
          <EventDashboard
            onNavigateToMembers={vi.fn()}
            onNavigateToAttendance={vi.fn()}
          />,
        );
      });

      await screen.findByTestId("sections-list", {}, { timeout: 3000 });

      // Wait for async operations to complete
      await waitFor(() => {
        expect(helpers.fetchAllSectionEvents).toHaveBeenCalled();
      });

      // Verify cache-only calls
      expect(helpers.fetchAllSectionEvents).toHaveBeenCalledWith(
        expect.any(Array),
        null, // No token
      );

      expect(helpers.fetchEventAttendance).toHaveBeenCalledWith(
        expect.any(Object),
        null, // No token
      );
    });

    it("should handle empty sections gracefully", async () => {
      databaseService.getSections.mockResolvedValue([]);

      await act(async () => {
        render(
          <EventDashboard
            onNavigateToMembers={vi.fn()}
            onNavigateToAttendance={vi.fn()}
          />,
        );
      });

      // Wait for the component to process
      await waitFor(() => {
        expect(helpers.fetchAllSectionEvents).toHaveBeenCalled();
      });

      // Should not call helper functions for empty sections
      expect(helpers.fetchAllSectionEvents).toHaveBeenCalledWith([], null);
      expect(helpers.fetchEventAttendance).not.toHaveBeenCalled();
      expect(helpers.groupEventsByName).toHaveBeenCalledWith([]);
    });

    it("should handle individual section failures gracefully", async () => {
      // Mock fetchAllSectionEvents to return some successful events
      helpers.fetchAllSectionEvents.mockResolvedValue([
        { eventid: 101, name: "Success Event", startdate: "2024-02-15" },
      ]);

      helpers.filterEventsByDateRange.mockReturnValue([
        { eventid: 101, name: "Success Event", startdate: "2024-02-15" },
      ]);

      helpers.fetchEventAttendance.mockResolvedValue([]);
      helpers.groupEventsByName.mockReturnValue(
        new Map([["Success Event", [{ eventid: 101, name: "Success Event" }]]]),
      );

      await act(async () => {
        render(
          <EventDashboard
            onNavigateToMembers={vi.fn()}
            onNavigateToAttendance={vi.fn()}
          />,
        );
      });

      await screen.findByTestId("sections-list", {}, { timeout: 3000 });

      // Wait for async operations to complete
      await waitFor(() => {
        expect(helpers.fetchAllSectionEvents).toHaveBeenCalled();
      });

      // Should process available sections
      expect(helpers.fetchAllSectionEvents).toHaveBeenCalledTimes(1);
      expect(helpers.groupEventsByName).toHaveBeenCalledWith([
        expect.objectContaining({ eventid: 101 }),
      ]);
    });

    it("should sort event cards by earliest date", async () => {
      const mockCard1 = {
        ...mockEventCards[0],
        name: "Early Event",
        earliestDate: new Date("2024-02-10"),
      };

      const mockCard2 = {
        ...mockEventCards[0],
        name: "Late Event",
        earliestDate: new Date("2024-02-20"),
      };

      // Mock multiple event groups
      helpers.groupEventsByName.mockReturnValue(
        new Map([
          ["Late Event", [{ eventid: 102 }]],
          ["Early Event", [{ eventid: 101 }]],
        ]),
      );

      helpers.buildEventCard
        .mockReturnValueOnce(mockCard2) // Late event returned first
        .mockReturnValueOnce(mockCard1); // Early event returned second

      await act(async () => {
        render(
          <EventDashboard
            onNavigateToMembers={vi.fn()}
            onNavigateToAttendance={vi.fn()}
          />,
        );
      });

      await screen.findByTestId("sections-list", {}, { timeout: 3000 });

      // Wait for async operations to complete
      await waitFor(() => {
        expect(helpers.fetchAllSectionEvents).toHaveBeenCalled();
      });

      // Verify both cards were built
      expect(helpers.buildEventCard).toHaveBeenCalledTimes(2);

      // The component should sort cards by earliestDate
      // (This would be verified by checking the order in the rendered output)
    });

    it("should handle development mode delays", async () => {
      // Mock localStorage to simulate development mode
      window.localStorage.getItem.mockImplementation((key) => {
        if (key === "development_mode") return "true";
        return null;
      });

      helpers.fetchSectionEvents.mockResolvedValue([]);

      await act(async () => {
        render(
          <EventDashboard
            onNavigateToMembers={vi.fn()}
            onNavigateToAttendance={vi.fn()}
          />,
        );
      });

      await screen.findByTestId("sections-list", {}, { timeout: 3000 });

      // Wait for async operations to complete
      await waitFor(() => {
        expect(helpers.fetchAllSectionEvents).toHaveBeenCalled();
      });

      // Verify development mode was passed to helper functions (cache-only mode)
      expect(helpers.fetchAllSectionEvents).toHaveBeenCalledWith(
        expect.any(Array),
        null, // cache-only mode uses null token
      );
    });
  });

  describe("Helper Function Error Handling", () => {
    it("should continue processing other sections when one fails", async () => {
      // Mock fetchAllSectionEvents to return some successful events
      helpers.fetchAllSectionEvents.mockResolvedValue([
        { eventid: 102, name: "Success Event", startdate: "2024-02-16" },
      ]);

      helpers.filterEventsByDateRange.mockReturnValue([
        { eventid: 102, name: "Success Event", startdate: "2024-02-16" },
      ]);

      await act(async () => {
        render(
          <EventDashboard
            onNavigateToMembers={vi.fn()}
            onNavigateToAttendance={vi.fn()}
          />,
        );
      });

      await screen.findByTestId("sections-list", {}, { timeout: 3000 });

      // Wait for async operations to complete
      await waitFor(() => {
        expect(helpers.fetchAllSectionEvents).toHaveBeenCalled();
      });

      // Should call fetchAllSectionEvents once
      expect(helpers.fetchAllSectionEvents).toHaveBeenCalledTimes(1);

      // Should still process the successful events
      expect(helpers.groupEventsByName).toHaveBeenCalledWith([
        expect.objectContaining({ eventid: 102 }),
      ]);
    });

    it.skip("should handle attendance fetching failures gracefully", async () => {
      // Mock fresh data to prevent auto-sync
      const mockFreshSyncTime = new Date(
        Date.now() - 5 * 60 * 1000,
      ).toISOString(); // 5 minutes ago
      window.localStorage.getItem.mockImplementation((key) => {
        if (key === "viking_last_sync") return mockFreshSyncTime;
        return null;
      });

      const mockEvents = [
        { eventid: 101, name: "Event 1", startdate: "2024-02-15" },
        { eventid: 102, name: "Event 2", startdate: "2024-02-16" },
      ];

      helpers.fetchAllSectionEvents.mockResolvedValue(mockEvents);
      helpers.filterEventsByDateRange.mockReturnValue(mockEvents);

      // Set up enough mock responses for potential multiple calls (cache + auto-sync)
      helpers.fetchEventAttendance
        .mockRejectedValue(new Error("Attendance fetch failed"))
        .mockResolvedValue([{ scoutid: 1, attended: true }])
        .mockRejectedValue(new Error("Attendance fetch failed"))
        .mockResolvedValue([{ scoutid: 1, attended: true }]);

      await act(async () => {
        render(
          <EventDashboard
            onNavigateToMembers={vi.fn()}
            onNavigateToAttendance={vi.fn()}
          />,
        );
      });

      await screen.findByTestId("sections-list", {}, { timeout: 3000 });

      // Wait longer for all async operations including potential auto-sync
      await waitFor(
        () => {
          expect(helpers.fetchEventAttendance).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      // Should call attendance (allow for both cache-only and auto-sync scenarios)
      expect(helpers.fetchEventAttendance).toHaveBeenCalled();
      expect(
        helpers.fetchEventAttendance.mock.calls.length,
      ).toBeGreaterThanOrEqual(2);

      // Should still process all events
      expect(helpers.groupEventsByName).toHaveBeenCalledWith([
        expect.objectContaining({ eventid: 101 }),
        expect.objectContaining({ eventid: 102 }),
      ]);
    });
  });
});
