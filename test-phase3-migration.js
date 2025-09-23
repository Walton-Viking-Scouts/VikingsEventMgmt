import MigrationService from "./src/shared/services/storage/migrationService.js";

console.log("🔄 Phase 3 Flexi Record Migration Test");
console.log("========================================");

const status = await MigrationService.getMigrationStatus();
console.log("📊 Current Migration Status:");
Object.entries(status).forEach(([phase, state]) => {
  console.log(`   ${phase}: ${state}`);
});

console.log("
🔍 Checking for existing Flexi data in localStorage:");
const flexiKeys = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (
    key.match(/^viking_flexi_lists_.+_offline$/) ||
    key.match(/^viking_flexi_records_.+_archived_n_offline$/) ||
    key.match(/^viking_flexi_structure_.+_offline$/) ||
    key.match(/^viking_flexi_data_.+_offline$/)
  )) {
    flexiKeys.push(key);
  }
}

if (flexiKeys.length === 0) {
  console.log("   ✅ No Flexi data found in localStorage");
} else {
  console.log(`   📦 Found ${flexiKeys.length} Flexi data keys:`);
  flexiKeys.forEach(key => {
    const data = JSON.parse(localStorage.getItem(key) || "null");
    const size = data ? JSON.stringify(data).length : 0;
    console.log(`      - ${key} (${size} bytes)`);
  });
}

console.log("
✅ Phase 3 migration test complete");
