---
title: "Medical Data States"
description: "Visual indicators for different states of medical information from OSM"
created: "2025-09-06"
last_updated: "2025-09-06"
version: "1.0.0"
tags: ["medical", "data-states", "indicators", "osm"]
related_docs: ["README.md"]
---

# Medical Data State Indicators

## Overview

The application provides visual indicators to distinguish between different states of medical information for members. This helps leaders quickly assess the completeness and reliability of medical data from Online Scout Manager.

## Data States

### ⚠️ Missing Data (Yellow Badge)
- **When shown**: Field is empty, null, or undefined
- **Visual indicator**: Yellow warning badge with "Missing" text
- **Meaning**: No medical information has been provided in OSM
- **Action needed**: Information should be collected and updated in OSM

### Confirmed None (Plain Text)
- **When shown**: User has explicitly entered variations of "none", "no allergies", etc.
- **Visual indicator**: Plain text display without badges
- **Meaning**: User has confirmed there are no medical issues for this field
- **Action needed**: No action - this is confirmed information
- **Examples**: "None", "No allergies", "No dietary requirements", "N/A"

### ⚠️ System Default (Yellow Badge)
- **When shown**: System-provided default values like "N/A"
- **Visual indicator**: Yellow warning badge
- **Meaning**: Default value that may need verification
- **Action needed**: May need user verification or update in OSM

### ● Has Data (Red Badge)
- **When shown**: Member has actual medical information recorded
- **Visual indicator**: Red dot indicator
- **Meaning**: Important medical information is present
- **Action needed**: Review information for event planning
- **Examples**: "Peanut allergy", "Asthma", "Vegetarian diet"

## Medical Data Fields

The app displays three medical data fields from OSM:

### Allergies
- **Field**: `allergies` or `essential_information.allergies`
- **Purpose**: Display any allergies the member has
- **Common values**: "Nuts", "Dairy", "None", "No known allergies"

### Medical Details
- **Field**: `medical_details` or `essential_information.medical_details`
- **Purpose**: General medical conditions or important notes
- **Common values**: "Asthma", "Diabetes", "None", "No medical conditions"

### Dietary Requirements
- **Field**: `dietary_requirements` or `essential_information.dietary_requirements`
- **Purpose**: Special dietary needs or restrictions
- **Common values**: "Vegetarian", "Gluten-free", "None", "No dietary requirements"

## CSV Export Integration

### AttendanceView Export
- Medical data included in comprehensive member exports
- Shows both the actual values and the data state indicators
- Helps with event planning and safety preparation

### MembersList Export
- Medical data columns included in member list exports
- Data state information helps identify incomplete records
- Useful for section-wide medical data audits

## Implementation Details

### Data State Classification
```typescript
function getMedicalDataState(value: string | null | undefined): MedicalDataState {
  if (!value || value.trim() === '') {
    return 'missing';
  }
  
  const lowerValue = value.toLowerCase().trim();
  const noneVariations = ['none', 'no', 'n/a', 'na', 'nil', 'no allergies', 'no medical conditions'];
  
  if (noneVariations.some(variation => lowerValue.includes(variation))) {
    return lowerValue === 'n/a' ? 'system_default' : 'confirmed_none';
  }
  
  return 'has_data';
}
```

### Usage in Application
Medical data states are used throughout the app:
- **AttendanceView**: Medical indicators for members during events
- **ComprehensiveMemberTable**: Medical data columns with state indicators
- **MemberDetailModal**: Full medical information display with states
- **CSV Exports**: Medical data and state information included in exports

## Benefits of Data State Indicators

### For Leaders
- **Quick Assessment**: Instantly see which members have medical information
- **Data Quality**: Identify missing or incomplete medical records
- **Event Planning**: Better preparation for activities with medical considerations
- **Safety Awareness**: Clear visibility of members with medical needs

### For Section Management
- **Data Audits**: Identify members with incomplete medical information
- **OSM Updates**: Know which records need updating in Online Scout Manager
- **Export Quality**: Better data quality in exported reports
- **Compliance**: Ensure medical information is properly recorded

---

*This data state system helps leaders make informed decisions about member safety and event planning based on the quality and completeness of medical information from OSM.*