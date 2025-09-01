# Medical Data State Indicators

## Overview

The application now provides visual indicators to distinguish between different states of medical information for members. This helps identify where medical data is missing versus where users have explicitly indicated "None" or "N/A".

## Data States

### 🔴 Missing (Red Badge)
- **When shown**: Field is empty, null, or undefined
- **Action needed**: Information should be collected and updated
- **Examples**: Empty allergies field, no medical details provided

### ✅ None (Green Badge) 
- **When shown**: User has explicitly entered variations of "none", "no allergies", etc.
- **Action needed**: No action - this is confirmed safe information
- **Examples**: "None", "No allergies", "No dietary requirements"

### ⚪ N/A (Gray Badge)
- **When shown**: System default values or "not applicable" 
- **Action needed**: No action - field not relevant for this member
- **Examples**: API-provided "N/A" values

### 📋 Present (Blue Badge)
- **When shown**: Member has actual medical information recorded
- **Action needed**: Review information for accuracy
- **Examples**: "Peanut allergy", "Asthma inhaler required"

## CSV Export Enhancements

### AttendanceView Export
- New comprehensive export includes all member fields
- Medical data includes both values and status indicators
- Exports all attendance records with full member details

### MembersList Export
- Enhanced with medical status columns
- Includes consent information
- Shows data state labels (Missing/None/N/A/Present)

## Usage in Components

### MedicalDataDisplay Components
- `MedicalDataBadge`: Shows colored status badge
- `MedicalDataField`: Full field display with badge and colored text
- `MedicalDataSummary`: Overview of all medical fields for a member

### Integration Points
- **AttendanceView**: Medical badges in detailed member tables
- **ComprehensiveMemberTable**: Badges on medical columns  
- **MemberDetailModal**: Enhanced medical information section
- **CSV Exports**: Status indicators included in export data

## Technical Implementation

### Utility Functions
Located in `src/utils/medicalDataUtils.js`:
- `categorizeMedicalData()`: Classifies data state
- `getMedicalDataIndicator()`: Returns visual styling
- `formatMedicalDataForDisplay()`: Formats for UI display
- `getMedicalFieldsFromMember()`: Extracts medical fields with states

### Data Field Mapping
Handles multiple data source patterns:
- Legacy fields: `member.medical_notes`
- Grouped fields: `member.essential_information.allergies`
- Flattened fields: `member.essential_information__allergies`