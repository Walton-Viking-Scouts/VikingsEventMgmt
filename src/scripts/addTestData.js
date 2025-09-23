// Script to add test localStorage data for migration testing
// Run this in the browser console to create test data

function addTestMigrationData() {
  console.log('Adding test localStorage data for Phase 1 migration...');
  const now = Date.now();

  // Phase 1: Cache & Sync data
  localStorage.setItem('viking_last_sync', now.toString());
  localStorage.setItem('viking_attendance_cache_time_12345', now.toString());
  localStorage.setItem('viking_attendance_cache_time_67890', (now - 86400000).toString()); // 1 day ago
  localStorage.setItem('viking_shared_metadata_test', JSON.stringify({
    version: '1.0',
    lastUpdate: now,
    type: 'metadata',
  }));

  // Add some non-Phase 1 data to test filtering
  localStorage.setItem('viking_sections_offline', JSON.stringify([
    { sectionid: 123, name: 'Test Section' },
  ]));
  localStorage.setItem('other_app_data', 'should not be migrated');

  console.log('✅ Test data added to localStorage:');
  console.log('- viking_last_sync');
  console.log('- viking_attendance_cache_time_12345');
  console.log('- viking_attendance_cache_time_67890');
  console.log('- viking_shared_metadata_test');
  console.log('- viking_sections_offline (Phase 2 data - should not migrate)');

  console.log('\nNote: Migration is now automatic - data will be stored in IndexedDB automatically.');
}

// Optional auto-run: only when explicitly requested via ?seedMigrationData=1
if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('seedMigrationData')) {
      addTestMigrationData();
    }
  } catch { /* no-op */ }
}

export default addTestMigrationData;