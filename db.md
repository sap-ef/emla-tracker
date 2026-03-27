# EMLA Tracker - Database Schema Documentation

**Version:** 1.0
**Last Updated:** 2026-03-24
**Namespace:** EMLATracker

---

## 📋 Table of Contents
- [Overview](#overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Core Entities](#core-entities)
  - [EMLACustomers](#emlacustomers)
  - [OnboardAdvisors](#onboardadvisors)
  - [AnalyzeEngagementProgress](#analyzeengagementprogress)
- [Value Help Entities](#value-help-entities)
  - [EMLATypeVH](#emlatypevh)
  - [BTPOnbAdvEmailVH](#btponbadvemailvh)
- [Data Types Reference](#data-types-reference)
- [Constraints and Validations](#constraints-and-validations)

---

## Overview

The EMLA Tracker database is built on SAP Cloud Application Programming (CAP) model and manages customer onboarding processes for EMLA (Enterprise Managed License Agreement) engagements. The schema tracks customer information, onboarding sessions, advisor assignments, and engagement progress analytics.

### Key Features
- Multi-session tracking (TrackApp, TrackAppTP2, TrackAppSH)
- Automated status synchronization
- Advisor assignment and contact management
- Engagement progress analytics
- Managed entities with audit fields (created/modified by/at)

---

## Entity Relationship Diagram

```
┌─────────────────────┐
│  EMLACustomers      │ (Main Entity)
│  ─────────────      │
│  • Customer Info    │
│  • Product Details  │
│  • Session Tracking │
│  • Status Mgmt      │
└─────────┬───────────┘
          │
          │ references
          ▼
┌─────────────────────┐      ┌─────────────────────────────┐
│  OnboardAdvisors    │      │ AnalyzeEngagementProgress   │
│  ───────────────    │      │ ──────────────────────────  │
│  • Advisor Info     │      │  • Progress Analytics       │
│  • Contact Details  │      │  • Status Tracking          │
└─────────────────────┘      └─────────────────────────────┘
          │
          │ powers
          ▼
┌─────────────────────┐
│ Value Help Entities │
│  • EMLATypeVH       │
│  • BTPOnbAdvEmailVH │
└─────────────────────┘
```

---

## Core Entities

### EMLACustomers

**Purpose:** Primary entity for managing EMLA customer onboarding engagements and tracking their progress through multiple session types.

**Extends:** `managed` (provides `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy`)

**Table Name:** `EMLATracker_EMLACustomers`

#### Fields

##### 🔑 Primary Key
| Field | Type | Description |
|-------|------|-------------|
| `ID` | UUID | Unique identifier for each customer record. Auto-generated primary key. |

##### 👤 Customer Identification
| Field | Type | Length | Description |
|-------|------|--------|-------------|
| `externalID` | String | 40 | External system identifier for customer synchronization (e.g., from CRM or ERP system). |
| `customerName` | String | 250 | Full legal or business name of the customer organization. |
| `customerNumber` | String | 20 | Unique customer identification number in the enterprise system. Used in unique constraint with `emlaType`. |

##### 📦 Product & Engagement Information
| Field | Type | Length | Description |
|-------|------|--------|-------------|
| `emlaType` | String | 50 | Type/category of EMLA engagement (e.g., "RISE with SAP", "GROW with SAP"). Part of unique constraint with `customerNumber`. |
| `productList` | String | 150 | Comma-separated list of product codes included in the EMLA agreement. |
| `productName` | String | 50 | Primary product name associated with this engagement. |
| `productSKU` | String | 12 | Stock Keeping Unit identifier for the main product. |

##### 🌍 Geographic Information
| Field | Type | Length | Description |
|-------|------|--------|-------------|
| `region` | String | 25 | Geographic region for the customer (e.g., "EMEA", "Americas", "APJ"). |
| `country` | String | 25 | Country code or name where the customer is located. |

##### 📅 Timeline
| Field | Type | Description |
|-------|------|-------------|
| `startDate` | Date | Engagement start date or contract effective date. |
| `completedOn` | Date | Date when the entire onboarding process was completed. Set when status changes to "Completed". |

##### 👨‍💼 Advisor Information
| Field | Type | Length | Description |
|-------|------|--------|-------------|
| `erpOnbAdvNome` | String | 100 | Name of the ERP Onboarding Advisor assigned to this customer. (Note: "Nome" suggests Portuguese/Italian origin - "Name") |
| `btpOnbAdvNome` | String | 100 | Name of the BTP (Business Technology Platform) Onboarding Advisor. |
| `btpOnbAdvEmail` | String | 100 | Email address of the BTP Onboarding Advisor. Used for value help and notifications. |

##### 📊 Status Management
| Field | Type | Length | Default | Description |
|-------|------|--------|---------|-------------|
| `status` | String | 100 | - | Overall engagement status (e.g., "In Progress", "Completed", "On Hold", "Cancelled"). |
| `isBTPOnboardingSessionRequired` | Boolean | - | false | Flag indicating whether BTP onboarding sessions are mandatory for this customer. |

##### 🎯 TrackApp Session Management (Primary Session)
| Field | Type | Length | Default | Description |
|-------|------|--------|---------|-------------|
| `trackApp` | String | 36 | - | Session ID/reference for the primary TrackApp onboarding session (typically UUID format). |
| `trackAppStatus` | String | 30 | - | Current status of the primary TrackApp session (e.g., "Scheduled", "In Progress", "Completed", "Rejected"). |
| `trackAppDate` | Date | - | - | Date when the primary TrackApp session was/is scheduled. |
| `isTrackAppCompleted` | Boolean | - | false | Indicates whether the primary TrackApp session has been successfully completed. |
| `isTrackAppRejected` | Boolean | - | false | Indicates whether the primary TrackApp session was rejected or cancelled. |

##### 🎯 TrackApp TP2 Session Management (Technical Platform 2)
| Field | Type | Length | Default | Description |
|-------|------|--------|---------|-------------|
| `trackAppTP2` | String | 36 | - | Session ID/reference for the TrackApp TP2 (Technical Platform 2) session. |
| `trackAppTP2Status` | String | 30 | - | Current status of the TP2 session. |
| `trackAppTP2Date` | Date | - | - | Date when the TP2 session was/is scheduled. |
| `isTrackAppTP2Completed` | Boolean | - | false | Completion flag for TP2 session. |
| `isTrackAppTP2Rejected` | Boolean | - | false | Rejection flag for TP2 session. |

##### 🎯 TrackApp SH Session Management (Success Hub)
| Field | Type | Length | Default | Description |
|-------|------|--------|---------|-------------|
| `trackAppSH` | String | 36 | - | Session ID/reference for the TrackApp Success Hub (SH) session. |
| `trackAppSHStatus` | String | 30 | - | Current status of the Success Hub session. |
| `trackAppSHDate` | Date | - | - | Date when the Success Hub session was/is scheduled. |
| `isTrackAppSHCompleted` | Boolean | - | false | Completion flag for Success Hub session. |
| `isTrackAppSHRejected` | Boolean | - | false | Rejection flag for Success Hub session. |

##### 📝 Additional Information
| Field | Type | Length | Description |
|-------|------|--------|-------------|
| `notes` | String | 5000 | Free-text field for additional notes, comments, or special instructions related to the customer engagement. |

##### 🕒 Managed Fields (Inherited from `managed`)
| Field | Type | Description |
|-------|------|-------------|
| `createdAt` | Timestamp | Timestamp when the record was created. |
| `createdBy` | String | User ID of the person who created the record. |
| `modifiedAt` | Timestamp | Timestamp of the last modification. |
| `modifiedBy` | String | User ID of the person who last modified the record. |

#### Constraints
- **Unique Constraint:** `uniqueCustomerProduct` on combination of `customerNumber` and `emlaType`
  - Ensures one record per customer per EMLA type
  - Prevents duplicate entries for the same customer-product combination

#### Actions (Service Layer)
| Action | Parameters | Return | Description |
|--------|-----------|---------|-------------|
| `setCompleted()` | - | Boolean | Marks the engagement as completed and sets `completedOn` date. |
| `sessionSync()` | - | String | Synchronizes session status from external TrackApp system. |

---

### OnboardAdvisors

**Purpose:** Master data entity storing information about onboarding advisors who can be assigned to customer engagements.

**Table Name:** `EMLATracker_OnboardAdvisors`

#### Fields

| Field | Type | Key | Description |
|-------|------|-----|-------------|
| `onbAdvisor` | String | 🔑 | Unique identifier or username for the onboarding advisor. Primary key. |
| `name` | String | - | Full name of the onboarding advisor. |
| `email` | String | - | Email address for the advisor. Used for notifications and contact. |

#### Usage
- Referenced in `EMLACustomers.btpOnbAdvEmail` for advisor assignment
- Powers the `BTPOnbAdvEmailVH` value help
- Used in advisor selection dropdowns in the UI

---

### AnalyzeEngagementProgress

**Purpose:** Analytics entity for tracking and analyzing engagement progress metrics, particularly for BTP onboarding advisors.

**Table Name:** `EMLATracker_AnalyzeEngagementProgress`

#### Fields

| Field | Type | Key | Description |
|-------|------|-----|-------------|
| `ID` | UUID | 🔑 | Unique identifier for each progress record. |
| `btpOnboardingAdvisor_userId` | String | - | User ID of the BTP onboarding advisor responsible for this engagement task. |
| `status` | String | - | High-level status code for the engagement task. |
| `detailedStatusName` | String | - | Human-readable detailed status description providing more context. |
| `engagementTaskName` | String | - | Name/description of the specific engagement task or milestone being tracked. |
| `customerId` | String | - | Reference to the customer (may link to `EMLACustomers.externalID` or `customerNumber`). |
| `date` | Date | - | Date associated with this progress entry (e.g., task completion date, status change date). |

#### Usage
- Imported via `importAnalyzeEngagementProgress()` action
- Used for progress analytics and reporting dashboards
- Helps track advisor workload and customer engagement health
- Can be filtered by date ranges for temporal analysis

---

## Value Help Entities

Value Help (VH) entities provide dropdown/search help functionality in the UI, typically populated from distinct values in the main entity.

### EMLATypeVH

**Purpose:** Provides a list of unique EMLA types for dropdown selections and filtering.

**Derived From:** `EMLACustomers.emlaType` (grouped/distinct values)

**Table Name:** `EMLATracker_EMLATypeVH`

#### Fields

| Field | Type | Key | Description |
|-------|------|-----|-------------|
| `emlaType` | String | 🔑 | Unique EMLA type value from EMLACustomers. |

**SQL Equivalent:**
```sql
SELECT DISTINCT emlaType
FROM EMLACustomers
GROUP BY emlaType
```

---

### BTPOnbAdvEmailVH

**Purpose:** Provides a list of unique BTP Onboarding Advisor emails for dropdown selections.

**Derived From:** `EMLACustomers.btpOnbAdvEmail` (grouped/distinct values)

**Table Name:** `EMLATracker_BTPOnbAdvEmailVH`

#### Fields

| Field | Type | Key | Description |
|-------|------|-----|-------------|
| `btpOnbAdvEmail` | String | 🔑 | Unique BTP advisor email from EMLACustomers. |

**SQL Equivalent:**
```sql
SELECT DISTINCT btpOnbAdvEmail
FROM EMLACustomers
GROUP BY btpOnbAdvEmail
```

---

## Data Types Reference

### CAP Standard Types

| CDS Type | Database Type | Description | Example |
|----------|---------------|-------------|---------|
| `UUID` | VARCHAR(36) / NVARCHAR(36) | Universally Unique Identifier | `550e8400-e29b-41d4-a716-446655440000` |
| `String(n)` | VARCHAR(n) / NVARCHAR(n) | Variable-length string with max length | `String(100)` → max 100 characters |
| `Date` | DATE | Calendar date without time | `2024-03-15` |
| `Boolean` | BOOLEAN / TINYINT | True/False flag | `true` or `false` |

### Managed Type Fields

The `managed` aspect adds the following fields automatically:

```typescript
{
  createdAt: Timestamp;   // When record was created
  createdBy: String(255); // Who created it
  modifiedAt: Timestamp;  // Last modification time
  modifiedBy: String(255); // Who last modified it
}
```

---

## Constraints and Validations

### Database-Level Constraints

#### 1. Unique Constraint: `uniqueCustomerProduct`
```cds
@assert.unique.uniqueCustomerProduct: [customerNumber, emlaType]
```
**Applies to:** `EMLACustomers`
**Fields:** `customerNumber` + `emlaType`
**Purpose:** Ensures that each customer can have only one engagement record per EMLA type
**Example:** Customer "C12345" can have one "RISE with SAP" record and one "GROW with SAP" record, but not two "RISE with SAP" records.

### Application-Level Validations

1. **Delete Restrictions**
   - `EMLACustomers` entity has delete operations disabled at service level
   - Ensures audit trail and data retention compliance

2. **Required Sessions**
   - `isBTPOnboardingSessionRequired` flag controls whether BTP sessions are mandatory
   - Validation logic should check this before allowing completion

3. **Status Integrity**
   - Completion flags (`isTrackAppCompleted`, etc.) should align with status values
   - Rejection flags should be mutually exclusive with completion flags

---

## Service Actions Reference

### Entity-Bound Actions (EMLACustomers)

| Action | Purpose | Side Effects |
|--------|---------|--------------|
| `setCompleted()` | Mark engagement as complete | Updates `status`, `completedOn` |
| `sessionSync()` | Sync session status from TrackApp | Updates all TrackApp status fields, dates, and completion/rejection flags |

### Unbound Service Actions

| Action | Parameters | Purpose |
|--------|-----------|---------|
| `onbTrackApp()` | `ID: UUID, sessionType: String` | Create/schedule primary TrackApp session |
| `onbTrackAppTP2()` | `ID: UUID, sessionType: String` | Create/schedule TP2 session |
| `onbTrackAppSH()` | `ID: UUID, sessionType: String` | Create/schedule Success Hub session |
| `uploadCSV()` | `csvData: String, csvType: String` | Bulk import customer data from CSV |
| `syncEMLAData()` | - | Sync customer data from external system via destination |
| `updateSessionStatus()` | - | Batch update session statuses from webservice |
| `importAnalyzeEngagementProgress()` | `internalInDays: Integer` | Import progress analytics for specified date range |

---

## Appendix

### Naming Conventions

- **Entity Names:** PascalCase (e.g., `EMLACustomers`)
- **Field Names:** camelCase (e.g., `customerNumber`, `trackAppDate`)
- **Value Help Suffix:** `VH` (e.g., `EMLATypeVH`)
- **Boolean Prefixes:** `is` for state flags (e.g., `isCompleted`)
- **Key Fields:** Typically named `ID` for generated keys

### Common Abbreviations

| Abbreviation | Full Term |
|--------------|-----------|
| EMLA | Enterprise Managed License Agreement |
| BTP | Business Technology Platform |
| ERP | Enterprise Resource Planning |
| Onb | Onboarding |
| Adv | Advisor |
| TP2 | Technical Platform 2 |
| SH | Success Hub |
| VH | Value Help |

---

## Quick Reference: All Tables and Fields

This section provides a flat, searchable list of all tables and their fields for quick lookup.

| Table | Field | Description |
|-------|-------|-------------|
| EMLACustomers | ID | Unique identifier for each customer record. Auto-generated primary key. |
| EMLACustomers | externalID | External system identifier for customer synchronization (e.g., from CRM or ERP system). |
| EMLACustomers | customerName | Full legal or business name of the customer organization. |
| EMLACustomers | customerNumber | Unique customer identification number in the enterprise system. Used in unique constraint with emlaType. |
| EMLACustomers | emlaType | Type/category of EMLA engagement (e.g., "RISE with SAP", "GROW with SAP"). Part of unique constraint with customerNumber. |
| EMLACustomers | region | Geographic region for the customer (e.g., "EMEA", "Americas", "APJ"). |
| EMLACustomers | country | Country code or name where the customer is located. |
| EMLACustomers | startDate | Engagement start date or contract effective date. |
| EMLACustomers | erpOnbAdvNome | Name of the ERP Onboarding Advisor assigned to this customer. |
| EMLACustomers | btpOnbAdvNome | Name of the BTP (Business Technology Platform) Onboarding Advisor. |
| EMLACustomers | btpOnbAdvEmail | Email address of the BTP Onboarding Advisor. Used for value help and notifications. |
| EMLACustomers | status | Overall engagement status (e.g., "In Progress", "Completed", "On Hold", "Cancelled"). |
| EMLACustomers | trackApp | Session ID/reference for the primary TrackApp onboarding session (typically UUID format). |
| EMLACustomers | trackAppTP2 | Session ID/reference for the TrackApp TP2 (Technical Platform 2) session. |
| EMLACustomers | trackAppSH | Session ID/reference for the TrackApp Success Hub (SH) session. |
| EMLACustomers | productList | Comma-separated list of product codes included in the EMLA agreement. |
| EMLACustomers | productName | Primary product name associated with this engagement. |
| EMLACustomers | productSKU | Stock Keeping Unit identifier for the main product. |
| EMLACustomers | isBTPOnboardingSessionRequired | Flag indicating whether BTP onboarding sessions are mandatory for this customer. |
| EMLACustomers | trackAppStatus | Current status of the primary TrackApp session (e.g., "Scheduled", "In Progress", "Completed", "Rejected"). |
| EMLACustomers | trackAppTP2Status | Current status of the TP2 session. |
| EMLACustomers | trackAppSHStatus | Current status of the Success Hub session. |
| EMLACustomers | trackAppDate | Date when the primary TrackApp session was/is scheduled. |
| EMLACustomers | trackAppTP2Date | Date when the TP2 session was/is scheduled. |
| EMLACustomers | trackAppSHDate | Date when the Success Hub session was/is scheduled. |
| EMLACustomers | isTrackAppCompleted | Indicates whether the primary TrackApp session has been successfully completed. |
| EMLACustomers | isTrackAppTP2Completed | Completion flag for TP2 session. |
| EMLACustomers | isTrackAppSHCompleted | Completion flag for Success Hub session. |
| EMLACustomers | isTrackAppRejected | Indicates whether the primary TrackApp session was rejected or cancelled. |
| EMLACustomers | isTrackAppTP2Rejected | Rejection flag for TP2 session. |
| EMLACustomers | isTrackAppSHRejected | Rejection flag for Success Hub session. |
| EMLACustomers | completedOn | Date when the entire onboarding process was completed. Set when status changes to "Completed". |
| EMLACustomers | notes | Free-text field for additional notes, comments, or special instructions related to the customer engagement. |
| EMLACustomers | createdAt | Timestamp when the record was created (inherited from managed aspect). |
| EMLACustomers | createdBy | User ID of the person who created the record (inherited from managed aspect). |
| EMLACustomers | modifiedAt | Timestamp of the last modification (inherited from managed aspect). |
| EMLACustomers | modifiedBy | User ID of the person who last modified the record (inherited from managed aspect). |
| OnboardAdvisors | onbAdvisor | Unique identifier or username for the onboarding advisor. Primary key. |
| OnboardAdvisors | name | Full name of the onboarding advisor. |
| OnboardAdvisors | email | Email address for the advisor. Used for notifications and contact. |
| AnalyzeEngagementProgress | ID | Unique identifier for each progress record. |
| AnalyzeEngagementProgress | btpOnboardingAdvisor_userId | User ID of the BTP onboarding advisor responsible for this engagement task. |
| AnalyzeEngagementProgress | status | High-level status code for the engagement task. |
| AnalyzeEngagementProgress | detailedStatusName | Human-readable detailed status description providing more context. |
| AnalyzeEngagementProgress | engagementTaskName | Name/description of the specific engagement task or milestone being tracked. |
| AnalyzeEngagementProgress | customerId | Reference to the customer (may link to EMLACustomers.externalID or customerNumber). |
| AnalyzeEngagementProgress | date | Date associated with this progress entry (e.g., task completion date, status change date). |
| EMLATypeVH | emlaType | Unique EMLA type value from EMLACustomers. Derived entity for value help. |
| BTPOnbAdvEmailVH | btpOnbAdvEmail | Unique BTP advisor email from EMLACustomers. Derived entity for value help. |

---

**Document Maintenance:** This document should be updated whenever the schema changes. Update the "Last Updated" date at the top of the document.
