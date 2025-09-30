export const formatLastRefresh = (lastRefresh) => {
  if (!lastRefresh) return 'Never';
  const now = new Date();
  const refreshTime = new Date(lastRefresh);
  const diffMinutes = Math.floor((now - refreshTime) / (1000 * 60));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  return refreshTime.toLocaleDateString();
};
