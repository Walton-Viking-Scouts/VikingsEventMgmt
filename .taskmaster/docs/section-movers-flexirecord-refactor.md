# Section Movers FlexiRecord Data Refactor

## Executive Summary

Refactor the Section Movers feature to use Viking Section Movers FlexiRecords as the primary data source, eliminating the current complex data flow that combines multiple sources. This will provide a single source of truth for member data, birth dates, current assignments, and term overrides.

## Current State Analysis

### Current Data Flow Issues:
- Multiple data sources: section summaries, sections data, calculated movers
- Complex state management with assignments and optimistic counts
- Birth dates sourced separately from member data
- Term assignments calculated rather than persisted
- No persistence of term overrides between page loads

### Current API Integration:
- Save functionality partially implemented with batched API calls
- Uses separate data structures for assignments and counts
- Term overrides not properly persisted or loaded

## Requirements

### 1. Data Source Consolidation

**Primary Data Source**: Viking Section Movers FlexiRecords
- Load all accessible FlexiRecords matching "Viking Section Movers" name pattern
- Use same discovery logic as Viking Event Management FlexiRecords
- Exclude sections without Viking Section Movers FlexiRecords

### 2. Field Mapping & Structure

**Required FlexiRecord Fields**:
- Member ID (scout identifier)
- Date of Birth (for age calculations)
- Current Section (member's current section)
- Target Section (assigned destination section) 
- Assignment Term (term for the move - takes priority over calculations)

**Field Discovery**:
- Implement dynamic field mapping using `extractFlexiRecordContext` pattern
- Map human-readable field names to FlexiRecord field IDs (f_1, f_2, etc.)
- Handle missing fields gracefully with appropriate error messages

### 3. Data Loading & Processing

**Page Load Sequence**:
1. Discover all accessible Viking Section Movers FlexiRecords
2. Load FlexiRecord data for each accessible section
3. Extract member data (ID, DOB, current section, assignments, term overrides)
4. Calculate age-based movements using FlexiRecord birth dates
5. Apply existing Assignment Term values (priority over calculated terms)
6. Group members by calculated/assigned terms for display

**Age Calculation Integration**:
- Use existing age calculation logic (`willMemberMoveUp`)
- Source birth dates from FlexiRecord Date of Birth field
- Calculate destination sections based on age thresholds
- Respect existing Assignment Term values over calculated terms

### 4. Term Assignment Logic

**Term Priority System**:
1. **Existing Assignment Term** (highest priority) - Use value from FlexiRecord
2. **Calculated Term** (fallback) - Based on age and term start dates
3. **Never show "Auto"** - Always display the actual term name

**Term Display**:
- Populate dropdown with the current assigned/calculated term as selected
- Show all available terms as options for override
- Save term changes immediately to assignment state
- Persist term overrides to FlexiRecord on save

### 5. Simplified State Management

**Single State Object**:
```javascript
const [memberAssignments, setMemberAssignments] = useState(new Map());
// Key: memberId, Value: { sectionId, sectionName, term }
```

**Data Structure**:
```javascript
{
  memberId: "12345",
  currentSection: "Demo Squirrels",
  targetSection: "Demo Beavers", 
  assignedTerm: "Summer 2026",
  birthDate: "2019-05-15",
  age: 6.8,
  needsMovement: true
}
```

### 6. Save & Reload Workflow

**Save Process**:
1. Group assignments by Target Section for batched API calls
2. Group term overrides by Assignment Term for batched API calls  
3. Use `multiUpdateFlexiRecord` for efficient bulk updates
4. After successful save, reload FlexiRecord data to refresh display
5. Recalculate term groupings based on updated assignments

**API Call Examples**:
```javascript
// Batch 1: 4 members to Demo Beavers
multiUpdateFlexiRecord(currentSectionId, ["id1","id2","id3","id4"], "demo_beavers_id", "f_2", flexiRecordId, token)

// Batch 2: 2 members with Summer 2026 term override  
multiUpdateFlexiRecord(currentSectionId, ["id1","id3"], "Summer 2026", "f_4", flexiRecordId, token)
```

**Post-Save Reload**:
- Reload all Viking Section Movers FlexiRecord data
- Recalculate term groupings with updated assignments
- Reset UI state to reflect persisted changes
- Show success/error notifications

### 7. Error Handling & Edge Cases

**FlexiRecord Validation**:
- Validate required fields exist using `validateVikingSectionMoversFields`
- Handle sections without Viking Section Movers FlexiRecords
- Graceful degradation when FlexiRecord structure is incomplete

**Data Integrity**:
- Validate member IDs exist in target sections
- Handle conflicting assignments (member assigned to multiple sections)
- Prevent saving incomplete assignments (section selected but no term)

**User Experience**:
- Loading states during FlexiRecord data fetching
- Error messages for network failures or permission issues
- Progress indicators during bulk save operations
- Confirmation messages for successful saves

## Technical Implementation Strategy

### Phase 1: Data Loading Infrastructure
- Create `useVikingSectionMoversData` hook for FlexiRecord loading
- Implement field mapping discovery and validation
- Build member data transformation pipeline

### Phase 2: UI State Refactor  
- Simplify state management to single assignment Map
- Update components to use FlexiRecord-sourced data
- Remove optimistic count calculations (use real data)

### Phase 3: Term Assignment Integration
- Integrate existing Assignment Term values into term calculation
- Update term display logic to show assigned terms
- Implement term override persistence

### Phase 4: Save & Reload Workflow
- Enhance save function with post-save reload
- Implement efficient batched API calls
- Add comprehensive error handling and user feedback

### Phase 5: Testing & Validation
- Test with multiple sections and FlexiRecord configurations
- Validate data integrity after save/reload cycles
- Ensure backward compatibility with existing assignments

## Success Criteria

1. **Single Data Source**: All member data sourced from Viking Section Movers FlexiRecords
2. **Persistent Term Overrides**: Term selections survive page reloads
3. **Efficient API Usage**: Minimal API calls using batched operations
4. **Real-time Updates**: Page reflects actual FlexiRecord state after saves
5. **Robust Error Handling**: Graceful handling of missing FlexiRecords or network issues
6. **Improved Performance**: Faster page loads with consolidated data fetching

## Dependencies

- Existing FlexiRecord service infrastructure
- Age calculation utilities  
- Field mapping discovery patterns from camp groups
- Batched `multiUpdateFlexiRecord` API functionality

This refactor will provide a much more reliable and maintainable Section Movers feature with proper data persistence and simplified state management.