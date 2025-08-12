import React from "react";

/**
 * DataFreshness - Shows data age and sync status
 *
 * Displays contextual information about when data was last synced
 * with appropriate visual indicators for data staleness urgency
 */
function DataFreshness({ lastSync, authState, className = "" }) {
  const getDataAge = (timestamp) => {
    if (!timestamp) return null;

    const now = Date.now();
    const syncTime = new Date(timestamp).getTime();
    const diffMs = now - syncTime;

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getStalenessLevel = (timestamp) => {
    if (!timestamp) return "unknown";

    const now = Date.now();
    const syncTime = new Date(timestamp).getTime();
    const diffMs = now - syncTime;

    // Different staleness thresholds based on our design
    const HOUR = 60 * 60 * 1000;

    if (diffMs < HOUR) return "fresh"; // < 1 hour
    if (diffMs < 4 * HOUR) return "moderate"; // < 4 hours
    if (diffMs < 24 * HOUR) return "stale"; // < 24 hours
    return "very-stale"; // > 24 hours
  };

  const getDisplayInfo = () => {
    const age = getDataAge(lastSync);
    const staleness = getStalenessLevel(lastSync);

    switch (authState) {
      case "no_data":
        return {
          text: "No data",
          icon: "📭",
          className: "text-gray-500",
        };

      case "syncing":
        return {
          text: "Syncing...",
          icon: "🔄",
          className: "text-blue-600 animate-pulse",
        };

      case "authenticated":
        return {
          text: age ? `Last synced: ${age}` : "Recently synced",
          icon: staleness === "fresh" ? "✅" : "📊",
          className: staleness === "fresh" ? "text-green-600" : "text-blue-600",
        };

      case "cached_only":
      case "token_expired": {
        const urgencyClass =
          {
            fresh: "text-yellow-600",
            moderate: "text-orange-600",
            stale: "text-red-600",
            "very-stale": "text-red-700",
          }[staleness] || "text-gray-600";

        return {
          text: age ? `Last synced: ${age}` : "Offline data",
          icon: staleness === "very-stale" ? "⚠️" : "📦",
          className: urgencyClass,
        };
      }

      default:
        return {
          text: "Unknown status",
          icon: "❓",
          className: "text-gray-500",
        };
    }
  };

  const info = getDisplayInfo();

  // Don't render anything if there's no meaningful info to show
  if (!info.text) return null;

  return (
    <div
      className={`data-freshness flex items-center space-x-2 text-sm ${info.className} ${className}`}
    >
      <span
        className="data-freshness-icon text-base"
        role="img"
        aria-label="Status"
      >
        {info.icon}
      </span>
      <span className="data-freshness-text hidden sm:inline">{info.text}</span>
      {/* Mobile: Show just the icon with tooltip */}
      <span className="sm:hidden" title={info.text}>
        {info.icon}
      </span>
    </div>
  );
}

export default DataFreshness;
