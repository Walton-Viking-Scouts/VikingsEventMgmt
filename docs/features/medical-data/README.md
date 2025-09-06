---
title: "Medical Data Display Overview"
description: "Display and caching of medical data from Online Scout Manager"
created: "2025-01-06"
last_updated: "2025-01-06"
version: "1.0.0"
tags: ["medical", "display", "osm", "caching"]
related_docs: ["data-states.md"]
---

# Medical Data Display Overview

Simple display and local caching of medical data from Online Scout Manager for Scout event planning and safety awareness.

## 🏥 Medical Data Display System

### Purpose and Scope
The medical data display system provides leaders with access to medical information from OSM for:
- **Event Planning**: Understanding medical needs when planning activities
- **Safety Awareness**: Leaders can see relevant medical information for members
- **Data Export**: Include medical data in attendance and member exports
- **Offline Access**: Cached medical data available when offline

### Data Types Displayed
The app displays three core medical fields from OSM:
- **Allergies**: Member allergy information
- **Medical Details**: General medical information and notes
- **Dietary Requirements**: Dietary restrictions and special requirements

## 🔐 Data Source and Security

### Data Source
- **OSM Integration**: Medical data comes from Online Scout Manager
- **Local Caching**: Data is cached locally for offline access
- **No Data Collection**: The app does not collect or store medical data independently
- **Display Only**: The app provides a display layer for OSM medical data

### Access Control
The app uses standard OSM authentication and permissions:
- **OSM Permissions**: Access controlled by OSM role and permissions
- **Leader Access**: Leaders with appropriate OSM permissions can view medical data
- **Standard Security**: Uses the same security as other app data (no special medical data security)

## 📊 Medical Data Display Features

### Data State Indicators
The app provides visual indicators to help assess medical data quality:

- **Missing Data** (⚠️ yellow badge): Fields that are empty or null
- **Confirmed None** (plain text): User explicitly entered "none", "no allergies", etc.
- **System Default** (⚠️ yellow badge): System-provided "N/A" values
- **Has Data** (● red badge): Actual medical information is present

### Display Components
```typescript
import { MedicalDataPill } from '../components/medical/MedicalDataPill';
import { MedicalDataSummary } from '../components/medical/MedicalDataSummary';

function MemberMedicalDisplay({ member }) {
  return (
    <div>
      <MedicalDataPill 
        field="allergies" 
        value={member.allergies} 
      />
      <MedicalDataPill 
        field="medical_details" 
        value={member.medical_details} 
      />
      <MedicalDataPill 
        field="dietary_requirements" 
        value={member.dietary_requirements} 
      />
    </div>
  );
}
```

### Where Medical Data Appears
- **Attendance View**: Medical indicators for members during events
- **Member Detail Modal**: Full medical information display
- **Member Tables**: Medical data columns in comprehensive member lists
- **CSV Exports**: Medical data included in exported attendance and member data

## 📊 Medical Data States

### Data State Categories
See [Medical Data States](data-states.md) for detailed information on how the app categorizes medical data:

#### Missing Data
- Empty or null fields that may need information
- Displayed with yellow warning badge (⚠️)
- Helps identify incomplete medical information

#### Confirmed None
- User explicitly entered "none", "no allergies", "N/A", etc.
- Displayed as plain text without badges
- Indicates intentional confirmation of no medical issues

#### System Default
- System-provided default values like "N/A"
- Displayed with yellow warning badge (⚠️)
- May need user verification or update

#### Has Data
- Actual medical information is present
- Displayed with red indicator badge (●)
- Contains meaningful medical information for leaders

### Medical Information Types
The app displays three types of medical information from OSM:
- **Allergies**: Any allergies the member has
- **Medical Details**: General medical conditions or notes
- **Dietary Requirements**: Special dietary needs or restrictions

## 🔧 Implementation Guide

### Basic Medical Data Display
```typescript
import { MedicalDataPill } from '../components/medical/MedicalDataPill';
import { MedicalDataField } from '../components/medical/MedicalDataField';

function MemberMedicalInfo({ member }) {
  return (
    <div className="medical-info">
      <MedicalDataField 
        label="Allergies"
        field="allergies"
        value={member.allergies}
      />
      <MedicalDataField 
        label="Medical Details"
        field="medical_details"
        value={member.medical_details}
      />
      <MedicalDataField 
        label="Dietary Requirements"
        field="dietary_requirements"
        value={member.dietary_requirements}
      />
    </div>
  );
}
```

### Medical Data in Tables
```typescript
import { MedicalDataPill } from '../components/medical/MedicalDataPill';

function MemberTableRow({ member }) {
  return (
    <tr>
      <td>{member.name}</td>
      <td>
        <MedicalDataPill 
          field="allergies" 
          value={member.allergies} 
        />
      </td>
      <td>
        <MedicalDataPill 
          field="medical_details" 
          value={member.medical_details} 
        />
      </td>
      {/* Other columns */}
    </tr>
  );
}
```

### Medical Data Summary
```typescript
import { MedicalDataSummary } from '../components/medical/MedicalDataSummary';

function MemberDetailModal({ member }) {
  return (
    <div>
      <h2>{member.name}</h2>
      <MedicalDataSummary member={member} />
      {/* Other member details */}
    </div>
  );
}
```

## 📱 Mobile Medical Features

### Offline Access
- **Cached Data**: Medical data is cached locally for offline viewing
- **Sync with OSM**: Data syncs from OSM when online
- **Consistent Display**: Same medical data display on mobile and web

### Export Features
- **CSV Export**: Medical data included in attendance and member exports
- **Event Planning**: Export medical data for camp and event planning
- **Offline Reports**: Generate reports with cached medical data

## 🧪 Testing Medical Data Features

### Component Testing
```typescript
import { render, screen } from '@testing-library/react';
import { MedicalDataPill } from '../components/medical/MedicalDataPill';

describe('Medical Data Display', () => {
  it('shows missing data indicator for empty fields', () => {
    render(
      <MedicalDataPill 
        field="allergies" 
        value="" 
      />
    );
    
    expect(screen.getByText(/missing/i)).toBeInTheDocument();
  });

  it('shows confirmed none for explicit none values', () => {
    render(
      <MedicalDataPill 
        field="allergies" 
        value="none" 
      />
    );
    
    expect(screen.getByText(/none/i)).toBeInTheDocument();
  });

  it('shows data indicator when medical info present', () => {
    render(
      <MedicalDataPill 
        field="allergies" 
        value="Nuts, dairy" 
      />
    );
    
    expect(screen.getByText(/nuts, dairy/i)).toBeInTheDocument();
  });
});
```

### Data State Testing
- **State Classification**: Test correct categorization of data states
- **Visual Indicators**: Verify correct badges and styling
- **Export Integration**: Test medical data in CSV exports

## 📋 Data Handling

### OSM Data Integration
- **Data Source**: All medical data originates from Online Scout Manager
- **No Independent Storage**: App does not store medical data independently
- **Caching Only**: Local storage is for caching and offline access only
- **OSM Compliance**: Relies on OSM's data protection and compliance measures

### Data Synchronization
- **OSM Sync**: Medical data syncs from OSM along with other member data
- **Standard Priority**: No special sync priority for medical data
- **Offline Caching**: Cached locally for offline viewing like other member data

## 🐛 Troubleshooting

### Common Issues
- **Medical Data Not Showing**: Check OSM permissions and data sync
- **Incorrect Data States**: Verify data format and content from OSM
- **Export Issues**: Ensure medical data is properly synced before export

### Debug Information
Medical data issues are typically related to:
- **OSM Permissions**: User may not have access to medical data in OSM
- **Data Format**: OSM data may be in unexpected format
- **Sync Status**: Medical data may not have synced from OSM yet

### Data State Debugging
```typescript
// Check medical data state classification
const dataState = getMedicalDataState(value);
console.log('Medical data state:', dataState);

// Verify medical data structure
console.log('Member medical data:', {
  allergies: member.allergies,
  medical_details: member.medical_details,
  dietary_requirements: member.dietary_requirements
});
```

## 📚 Related Documentation

### Implementation Details
- [Medical Data States](data-states.md) - Detailed data state categorization

### Architecture
- [Data Management](../../architecture/data-management.md) - Overall data architecture
- [OSM Integration](../../architecture/authentication.md) - OSM authentication and data access

### Development
- [Component Development](../../development/) - Creating medical data display components
- [Testing Strategy](../../development/testing-strategy.md) - Testing medical data features

---

*For detailed information about medical data state categorization, see [Medical Data States](data-states.md).*