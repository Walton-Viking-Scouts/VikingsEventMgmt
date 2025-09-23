// Script to add test localStorage data for migration testing
// Run this in the browser console to create test data

function addTestMigrationData() {
  console.log('Adding test localStorage data for Phase 1 migration...');

  // Phase 1: Cache & Sync data
  localStorage.setItem('viking_last_sync', Date.now().toString());
  localStorage.setItem('viking_attendance_cache_time_12345', Date.now().toString());
  localStorage.setItem('viking_attendance_cache_time_67890', (Date.now() - 86400000).toString()); // 1 day ago
  localStorage.setItem('viking_shared_metadata_test', JSON.stringify({
    version: '1.0',
    lastUpdate: Date.now(),
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

// Auto-run when script is loaded
if (typeof window !== 'undefined') {
  addTestMigrationData();
}

export default addTestMigrationData;