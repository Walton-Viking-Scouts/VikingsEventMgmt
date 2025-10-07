# Technical Specification: Universal Attendance Tab Refactor

**Version:** 1.0
**Date:** 2025-10-06
**Status:** Draft
**Author:** Technical Specification

---

## 1. Overview

### 1.1 Purpose
Transform the existing "Shared Attendance" tab into a universal "Attendance" tab that displays ALL event attendance data (not just shared sections) using the brick/masonry layout for improved visual presentation.

### 1.2 Current State
- **Tab name:** "Shared Attendance"
- **Visibility:** Only shows when `hasSharedEvents` is true
- **Data source:** `sharedAttendanceData` (filtered by `_isSharedSection: true`)
- **Position:** Last tab position
- **Layout:** `SectionCardsFlexMasonry` component (brick/masonry layout)

### 1.3 Desired State
- **Tab name:** "Attendance"
- **Visibility:** Always visible for all events
- **Data source:** `filteredAttendanceData` (respects attendance + section filters)
- **Position:** Second tab (between Overview and Register)
- **Layout:** Same `SectionCardsFlexMasonry` component

---

## 2. Component Changes

### 2.1 EventAttendance.jsx

**File:** `/Users/simon/vsCodeProjects/VikingEventMgmt/vikings-eventmgmt-mobile/src/features/events/components/attendance/EventAttendance.jsx`

#### 2.1.1 Tab Case Rename
**Location:** Line 770 (switch statement case)

**Current:**
```jsx
case 'sharedAttendance':
```

**Change to:**
```jsx
case 'attendance':
```

#### 2.1.2 Data Source Change
**Location:** Lines 777-848 (inside case block)

**Current:**
```jsx
{sharedAttendanceData && sharedAttendanceData.length > 0 ? (
```

**Change to:**
```jsx
{filteredAttendanceData && filteredAttendanceData.length > 0 ? (
```

**Impact:**
- Uses `filteredAttendanceData` instead of `sharedAttendanceData`
- Respects current attendance filters (Yes/No/Invited/Not Invited)
- Respects current section filters
- Same data source as Overview tab uses

#### 2.1.3 Data Processing Logic
**Location:** Lines 779-886

**Keep existing logic:**
- `isYoungPerson` function (age-based categorization)
- `getNumericAge` function (age sorting)
- Section grouping: `sectionGroups` object
- YP vs Adults counting
- Age-based sorting within sections

**Data flow:**
```
filteredAttendanceData (already filtered)
  → Group by section (sectionGroups)
  → Count YP vs Adults per section
  → Sort members by age within each section
  → Pass to SectionCardsFlexMasonry
```

#### 2.1.4 Loading State (Optional Enhancement)
**Location:** Lines 771-773

**Current:**
```jsx
if (loadingSharedAttendance) {
  return <LoadingScreen message="Loading shared attendance data..." />;
}
```

**Suggested change:**
```jsx
if (loading) {
  return <LoadingScreen message="Loading attendance data..." />;
}
```

**Rationale:** Use main `loading` state instead of `loadingSharedAttendance` since data now comes from `filteredAttendanceData`

#### 2.1.5 Cleanup - Remove Obsolete Data
**Location:** Lines 112-122 (useMemo for sharedAttendanceData)

**Action:** Remove this useMemo block entirely
```jsx
const sharedAttendanceData = useMemo(() => {
  if (!attendanceData || attendanceData.length === 0) {
    return sharedAttendanceDataFromHook || [];
  }
  const sharedRecords = attendanceData.filter(record => record._isSharedSection === true);
  return sharedRecords.length > 0 ? sharedRecords : (sharedAttendanceDataFromHook || []);
}, [attendanceData, sharedAttendanceDataFromHook]);
```

**Rationale:** No longer needed as we're using `filteredAttendanceData` directly

#### 2.1.6 Cleanup - Remove useSharedAttendance Hook (Optional)
**Location:** Lines 105-109

**Current:**
```jsx
const {
  sharedAttendanceData: sharedAttendanceDataFromHook,
  loadingSharedAttendance,
  hasSharedEvents,
} = useSharedAttendance(events, activeTab);
```

**Suggested approach:**
- Keep the hook temporarily to maintain `hasSharedEvents` for other potential uses
- OR remove entirely if `hasSharedEvents` is only used for tab visibility (which we're removing)

**Decision needed:** Confirm if `hasSharedEvents` is used elsewhere in the codebase

---

### 2.2 AttendanceTabNavigation.jsx

**File:** `/Users/simon/vsCodeProjects/VikingEventMgmt/vikings-eventmgmt-mobile/src/features/events/components/attendance/AttendanceTabNavigation.jsx`

#### 2.2.1 Tab Array Reordering
**Location:** Lines 8-17

**Current:**
```jsx
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'register', label: 'Register' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'campGroups', label: 'Camp Groups' },
];

if (hasSharedEvents) {
  tabs.push({ id: 'sharedAttendance', label: 'Shared Attendance' });
}
```

**Change to:**
```jsx
const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'register', label: 'Register' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'campGroups', label: 'Camp Groups' },
];
```

**Changes:**
1. Add `attendance` tab after `overview`
2. Remove conditional logic (`if (hasSharedEvents)`)
3. Change tab ID from `sharedAttendance` to `attendance`
4. Change label from "Shared Attendance" to "Attendance"

#### 2.2.2 Props Interface Update (Optional)
**Location:** Lines 3-7

**Current:**
```jsx
function AttendanceTabNavigation({
  activeTab,
  onTabChange,
  hasSharedEvents = false,
}) {
```

**Suggested change:**
```jsx
function AttendanceTabNavigation({
  activeTab,
  onTabChange,
}) {
```

**Rationale:** `hasSharedEvents` prop no longer needed

---

## 3. Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│ useAttendanceData Hook                              │
│ - Loads all attendance from IndexedDB               │
│ - Includes regular + shared attendance              │
│ - Returns: attendanceData (enhanced)                │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│ AttendanceFilters Component                         │
│ - Attendance status: Yes/No/Invited/Not Invited     │
│ - Section filters: Per-section toggles              │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│ applyFilters function                               │
│ - Filters attendanceData by:                        │
│   • Attendance status (if includeAttendanceFilter)  │
│   • Section ID (if includeSectionFilter)            │
│ - Returns: filteredAttendanceData                   │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│ Attendance Tab (case 'attendance')                  │
│                                                     │
│ 1. Input: filteredAttendanceData                    │
│                                                     │
│ 2. Processing:                                      │
│    a. Group by section (sectionGroups)              │
│    b. Categorize as YP/Adults (isYoungPerson)       │
│    c. Sort by age within sections (getNumericAge)   │
│    d. Count totals (youngPeopleCount, adultsCount)  │
│                                                     │
│ 3. Output: sections array with member lists         │
└─────────────┬───────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│ SectionCardsFlexMasonry Component                   │
│ - Displays sections in brick/masonry layout         │
│ - 3 columns (large), 2 (medium), 1 (small)          │
│ - Shows: section name, counts, member lists         │
└─────────────────────────────────────────────────────┘
```

---

## 4. Props/State Changes

### 4.1 EventAttendance Component

#### State Variables
| Variable | Current Usage | New Usage | Change |
|----------|---------------|-----------|--------|
| `attendanceData` | ✅ Used | ✅ Used | No change |
| `filteredAttendanceData` | ✅ Used in Overview/Register | ✅ Used in Attendance tab | **Extended usage** |
| `sharedAttendanceData` | ✅ Used in Shared Attendance tab | ❌ Remove | **Remove** |
| `loadingSharedAttendance` | ✅ Used for loading state | ❌ Replace with `loading` | **Replace** |
| `loading` | ✅ Used globally | ✅ Used in Attendance tab | **Extended usage** |

#### Props Passed to Child Components
No changes to props structure. All child components receive same props.

---

### 4.2 AttendanceTabNavigation Component

#### Props Interface
| Prop | Current | New | Change |
|------|---------|-----|--------|
| `activeTab` | ✅ Required | ✅ Required | No change |
| `onTabChange` | ✅ Required | ✅ Required | No change |
| `hasSharedEvents` | ✅ Optional (default: false) | ❌ Remove | **Remove** |

#### Internal State
| Variable | Current | New | Change |
|----------|---------|-----|--------|
| `tabs` array | Dynamic (conditional push) | Static | **Simplified** |

---

### 4.3 Data Structure Compatibility

#### SectionCardsFlexMasonry Expected Format
```javascript
{
  sections: [
    {
      sectionid: Number,           // Section ID
      sectionname: String,         // Section display name
      members: [                   // Array of member objects
        {
          scoutid: Number,
          firstname: String,
          lastname: String,
          age: String,             // "18/6" or "25+" format
          // ... other fields
        }
      ],
      youngPeopleCount: Number,    // Computed count
      adultsCount: Number          // Computed count
    }
  ],
  isYoungPerson: Function          // Age categorization function
}
```

**Compatibility:** ✅ Existing data processing logic already creates this format

---

## 5. Testing Considerations

### 5.1 Unit Tests Required

#### EventAttendance.test.jsx
```javascript
describe('Attendance Tab', () => {
  test('displays all attendance data when tab is active', () => {
    // Render with filteredAttendanceData containing multiple sections
    // Verify all sections are displayed
  });

  test('respects attendance status filters', () => {
    // Set attendance filters to Yes only
    // Verify only Yes attendees shown in Attendance tab
  });

  test('respects section filters', () => {
    // Disable one section in filters
    // Verify that section not shown in Attendance tab
  });

  test('groups members by section correctly', () => {
    // Provide data with multiple sections
    // Verify correct section grouping
  });

  test('categorizes YP vs Adults correctly', () => {
    // Provide mixed age data
    // Verify correct YP/Adult counts per section
  });

  test('sorts members by age within sections', () => {
    // Provide unsorted age data
    // Verify ascending age sort within each section
  });

  test('handles empty filtered data gracefully', () => {
    // Set filters that exclude all data
    // Verify "No attendance data available" message
  });
});
```

#### AttendanceTabNavigation.test.jsx
```javascript
describe('AttendanceTabNavigation', () => {
  test('always displays Attendance tab', () => {
    // Render with hasSharedEvents = false
    // Verify Attendance tab is present
  });

  test('Attendance tab is second in order', () => {
    // Verify tab order: Overview → Attendance → Register → Detailed → Camp Groups
  });

  test('activates Attendance tab when clicked', () => {
    // Click Attendance tab
    // Verify onTabChange called with "attendance"
  });
});
```

---

### 5.2 Integration Tests

#### Test Scenarios
1. **Filter Interaction:**
   - Change attendance filters → Verify Attendance tab updates
   - Change section filters → Verify Attendance tab updates
   - Reset filters → Verify Attendance tab shows all data

2. **Data Loading:**
   - Load event with mixed sections → Verify all sections shown
   - Load event with shared sections → Verify shared sections included
   - Load event with no data → Verify empty state message

3. **Tab Navigation:**
   - Switch between tabs → Verify data persistence
   - Apply filters in Overview → Switch to Attendance → Verify same filters applied

4. **Edge Cases:**
   - Very large dataset (100+ members) → Verify performance
   - Single section → Verify masonry layout works with 1 column
   - All filters disabled → Verify empty state

---

### 5.3 Manual Testing Checklist

- [ ] Attendance tab appears for all events (not just shared)
- [ ] Attendance tab is positioned correctly (2nd position)
- [ ] Tab displays filtered attendance data
- [ ] Attendance status filters work correctly
- [ ] Section filters work correctly
- [ ] Members grouped by section
- [ ] YP vs Adults categorized correctly
- [ ] Members sorted by age within sections
- [ ] Masonry layout displays correctly on all screen sizes
- [ ] Section counts (total, YP, adults) are accurate
- [ ] Empty state message when no data
- [ ] Loading state displays correctly
- [ ] Performance acceptable with large datasets

---

## 6. Impact Analysis

### 6.1 User Experience Impact

#### Positive Changes ✅
- **Simplified UI:** Universal "Attendance" tab for all events (no confusion about "Shared Attendance")
- **Better Visibility:** Attendance tab always available (2nd position, high visibility)
- **Consistent Filtering:** Respects same filters as Overview/Register tabs
- **Visual Clarity:** Brick/masonry layout makes it easier to scan attendees at a glance
- **Section Organization:** Clear grouping by section with counts

#### Potential Concerns ⚠️
- **Data Volume:** Displaying ALL attendance may be overwhelming for large multi-section events
  - **Mitigation:** Section filters allow users to focus on specific sections
- **Performance:** More data to render in masonry layout
  - **Mitigation:** `SectionCardsFlexMasonry` already optimized for performance

---

### 6.2 Technical Impact

#### Code Simplification ✅
- **Remove conditional logic:** No more `hasSharedEvents` checks
- **Unified data source:** Single `filteredAttendanceData` instead of separate shared data
- **Remove hook dependency:** Can potentially remove `useSharedAttendance` hook

#### Backward Compatibility ✅
- **No API changes:** Uses existing data structures
- **No database changes:** Uses existing attendance data
- **No breaking changes:** Existing functionality preserved

#### Performance Impact 🔄
- **Positive:** Removes separate data fetching for shared attendance
- **Neutral:** Same rendering logic, just more data
- **Consideration:** Monitor performance with very large datasets (100+ attendees)

---

### 6.3 Maintenance Impact

#### Benefits ✅
- **Less complexity:** Fewer conditional paths in code
- **Easier debugging:** Single data flow for Attendance tab
- **Better testability:** Simpler logic to test

#### Migration Path
1. **Phase 1:** Implement new Attendance tab (this spec)
2. **Phase 2:** Monitor usage and performance
3. **Phase 3:** Remove obsolete `useSharedAttendance` hook if unused elsewhere

---

## 7. Implementation Checklist

### 7.1 Code Changes
- [ ] EventAttendance.jsx:
  - [ ] Rename tab case from `sharedAttendance` to `attendance`
  - [ ] Change data source to `filteredAttendanceData`
  - [ ] Update loading state to use `loading`
  - [ ] Remove `sharedAttendanceData` useMemo
  - [ ] Verify `useSharedAttendance` usage (keep or remove)

- [ ] AttendanceTabNavigation.jsx:
  - [ ] Update tabs array (add Attendance, remove conditional)
  - [ ] Reorder tabs (Attendance → 2nd position)
  - [ ] Remove `hasSharedEvents` prop (if confirmed unused)

### 7.2 Testing
- [ ] Write/update unit tests for EventAttendance
- [ ] Write/update unit tests for AttendanceTabNavigation
- [ ] Run integration tests
- [ ] Manual testing (all scenarios)
- [ ] Performance testing with large datasets

### 7.3 Quality Checks
- [ ] Run `npm run lint` (no errors)
- [ ] Run `npm run test:run` (all tests pass)
- [ ] Run `npm run build` (build succeeds)
- [ ] Manual UI verification

### 7.4 Documentation
- [ ] Update component documentation (if exists)
- [ ] Update user documentation (if exists)
- [ ] Add this spec to docs/specs/ directory

---

## 8. Rollback Plan

### 8.1 If Issues Arise
1. **Revert commits:** Use git to revert changes
2. **Restore old tab logic:**
   - Restore `sharedAttendance` case
   - Restore conditional tab visibility
   - Restore `sharedAttendanceData` logic

### 8.2 Feature Flag Option (Advanced)
```javascript
const USE_UNIVERSAL_ATTENDANCE_TAB = true;

const tabId = USE_UNIVERSAL_ATTENDANCE_TAB ? 'attendance' : 'sharedAttendance';
const dataSource = USE_UNIVERSAL_ATTENDANCE_TAB ? filteredAttendanceData : sharedAttendanceData;
```

---

## 9. Success Metrics

### 9.1 Technical Metrics
- ✅ All tests pass
- ✅ No performance degradation (< 100ms render time)
- ✅ Code coverage maintained or improved
- ✅ No new linting errors

### 9.2 User Metrics (Post-Deployment)
- Monitor usage: % of users using Attendance tab vs other tabs
- Collect feedback: User confusion about tab purpose?
- Performance: Any slowness reports with large datasets?

---

## 10. Questions for Clarification

1. **useSharedAttendance Hook:**
   - Is `hasSharedEvents` used anywhere else in the codebase?
   - Can we safely remove the `useSharedAttendance` hook entirely?

2. **Data Volume:**
   - What is the typical/maximum number of attendees per event?
   - Should we add pagination or virtual scrolling for very large datasets?

3. **User Expectations:**
   - Do users understand the difference between "Attendance" and "Register" tabs?
   - Should we add tooltips or help text to clarify tab purposes?

4. **Loading States:**
   - Should we show a loading spinner while grouping/sorting data?
   - Or is the current loading screen sufficient?

---

## 11. References

### Related Files
- `/src/features/events/components/attendance/EventAttendance.jsx` (lines 770-894)
- `/src/features/events/components/attendance/AttendanceTabNavigation.jsx` (lines 8-17)
- `/src/features/events/hooks/useSharedAttendance.js` (entire file)
- `/src/shared/components/ui/SectionCardsFlexMasonry.jsx` (layout component)

### Related Documentation
- [Attendance Data Flow](/docs/architecture/attendance-data-flow.md) (if exists)
- [Component Architecture](/docs/architecture/component-architecture.md) (if exists)

---

**End of Technical Specification**
