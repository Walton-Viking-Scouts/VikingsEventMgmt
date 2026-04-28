# Data Flows: API → IndexedDB & SQLite

How OSM API responses flow into the two storage backends — IndexedDB on web, SQLite on native iOS — and where the two diverge. Each section is a Mermaid diagram so it renders inline on GitHub and most Markdown viewers.

The point of this document is to make alignment (or misalignment) between the two backends visible at a glance. The "Alignment status" table at the end lists the concrete gaps that still need closing.

---

## 1. Top-level overview

Every save goes through `databaseService` which branches per platform. IndexedDB is used both as the web fallback and (separately) for a couple of utility caches on iOS — but the main data is split as shown.

```mermaid
flowchart TB
  subgraph API["OSM API (via backend)"]
    A1[get_user_roles<br/>+ startup_data]
    A2[get_events]
    A3[get_event_attendance]
    A4[get_event_attendance<br/>shared sections]
    A5[get_members]
    A6[get_terms]
    A7[get_flexi_records]
    A8[get_flexi_structure]
    A9[get_flexi_data]
  end

  subgraph DS["DatabaseService (single facade, branches per platform)"]
    SS[saveSections]
    SE[saveEvents]
    SA[saveAttendance]
    SSA[saveSharedAttendance]
    SM[saveMembers]
    ST[saveTerms]
    SFL[saveFlexiLists]
    SFS[saveFlexiStructure]
    SFD[saveFlexiData]
  end

  A1 --> SS
  A2 --> SE
  A3 --> SA
  A4 --> SSA
  A5 --> SM
  A6 --> ST
  A7 --> SFL
  A8 --> SFS
  A9 --> SFD

  DS -->|"!isNative or no db"| WEB[(IndexedDB<br/>vikings_db)]
  DS -->|"isNative iOS"| NATIVE[(SQLite<br/>vikings_db)]
```

---

## 2. Sections

```mermaid
flowchart TB
  API["OSM API → auth.js getUserRoles()<br/>raw items: { sectionid, sectionname, section, isDefault, permissions }"]
  API --> Map["Map response (auth.js:198):<br/>sectiontype = item.section ?? item.sectionname<br/>+ enriched fields preserved"]
  Map --> Save["databaseService.saveSections(sections)"]
  Save --> Validate["safeParseArray(SectionSchema)<br/>✓ runs on BOTH paths"]
  Validate --> Branch{"isNative<br/>&& this.db?"}

  Branch -->|"web"| IDBOp["IndexedDBService.bulkReplaceSections<br/>store.clear() + store.put({...section, updated_at})"]
  IDBOp --> IDBStore["⚙️ IndexedDB store: sections<br/>keyPath: sectionid<br/>persists ALL fields incl.<br/>section, isDefault, permissions"]

  Branch -->|"iOS"| SQL["_runInTransaction:<br/>1. DELETE FROM sections<br/>2. INSERT OR REPLACE INTO sections (3 cols)"]
  SQL --> SQLTable["⚙️ SQLite table: sections<br/>PK: sectionid<br/>cols: sectionid, sectionname, sectiontype<br/>extra fields DROPPED"]

  IDBStore -.->|"alignment gap"| MISMATCH["⚠️ Web keeps `section` field<br/>SQLite drops it<br/>(was the SectionsList toLowerCase crash)"]
  SQLTable -.-> MISMATCH
```

---

## 3. Events

```mermaid
flowchart TB
  API["OSM API → events.js getEvents()<br/>response.items per section"]
  API --> Save["databaseService.saveEvents(sectionId, events)"]
  Save --> Branch{"isNative<br/>&& this.db?"}

  Branch -->|"web"| WebVal["safeParseArray(EventSchema)<br/>⚠️ runs on web ONLY"]
  WebVal --> IDBOp["IndexedDBService.bulkReplaceEventsForSection<br/>cursor delete by sectionid + put each event"]
  IDBOp --> IDBStore["⚙️ IndexedDB store: events<br/>keyPath: eventid, indexed by sectionid<br/>persists full event object incl. extras"]

  Branch -->|"iOS"| SQLNoVal["⚠️ NO validation on this path"]
  SQLNoVal --> SQL["_runInTransaction:<br/>1. DELETE FROM events WHERE sectionid=?<br/>2. INSERT INTO events (11 cols)"]
  SQL --> SQLTable["⚙️ SQLite table: events<br/>PK: eventid, FK→sections.sectionid<br/>cols: eventid, sectionid, termid, name, date,<br/>startdate(_g), enddate(_g), location, notes"]

  WebVal -.->|"alignment gap"| GAP1["⚠️ saveEvents validates only on web.<br/>iOS gets raw API shape into SQLite.<br/>Plain INSERT (no OR REPLACE) — UNIQUE risk."]
  SQLNoVal -.-> GAP1
```

---

## 4. Attendance (regular + shared)

```mermaid
flowchart TB
  subgraph getEventAttendance["getEventAttendance() — regular"]
    APIa["OSM API: ?sectionid&termid&eventid<br/>response.items"]
    APIa --> SaveA1["databaseService.saveAttendance(eventId, rawItems)<br/>⚠️ first call with RAW items missing eventid/sectionid"]
    APIa --> Map["syncEventAttendance maps to coreRecords:<br/>{scoutid, eventid, sectionid, attending, patrol, notes}"]
    Map --> SaveA2["databaseService.saveAttendance(eventId, coreRecords)<br/>second call — properly shaped"]
  end

  subgraph getSharedEventAttendance["getSharedEventAttendance() — shared sections"]
    APIs["OSM API: shared event endpoint"]
    APIs --> MapS["Map to coreSharedRecords with isSharedSection=true"]
    MapS --> SaveS["databaseService.saveSharedAttendance(eventId, records)"]
  end

  SaveA1 --> ValA["safeParseArray(AttendanceSchema)<br/>+ unknown-key check"]
  SaveA2 --> ValA
  SaveS --> ValSh["safeParseArray(AttendanceSchema)<br/>+ unknown-key check"]

  ValA --> BranchA{"isNative?"}
  ValSh --> BranchS{"isNative?"}

  BranchA -->|"web"| IDBA["IndexedDBService.bulkReplaceAttendanceForEvent<br/>cursor delete by eventid (excl. shared) + put"]
  BranchS -->|"web"| IDBS["IndexedDBService share path<br/>cursor delete WHERE isSharedSection=1 + put"]
  IDBA --> IDBStore["⚙️ IndexedDB store: attendance<br/>keyPath: [eventid, scoutid]<br/>indexed by eventid, scoutid, sectionid"]
  IDBS --> IDBStore

  BranchA -->|"iOS"| SQLA["_runInTransaction:<br/>1. DELETE FROM attendance WHERE eventid=?<br/>2. INSERT OR REPLACE INTO attendance"]
  BranchS -->|"iOS"| SQLS["_runInTransaction:<br/>1. DELETE WHERE eventid=? AND isSharedSection=1<br/>2. INSERT OR REPLACE INTO attendance (isSharedSection=1)"]
  SQLA --> SQLTable["⚙️ SQLite table: attendance<br/>PK: (eventid, scoutid)<br/>cols: eventid, scoutid, sectionid, attending,<br/>patrol, notes, isSharedSection<br/>(sectionid + isSharedSection added in migration 002)"]
  SQLS --> SQLTable
```

---

## 5. Members — biggest asymmetry

The two backends store members in structurally different ways. IndexedDB normalises into a dual-store (one row per scout in `core_members`, plus one row per (scout, section) in `member_section`). SQLite collapses everything onto a single `members` row keyed by scoutid, with the multi-section information JSON-encoded in the `sections` column. Both `getMembers()` paths reassemble the same shape on read.

```mermaid
flowchart TB
  API["OSM API → members.js<br/>response includes core info + section membership(s)<br/>+ contact_groups + custom_data + sectionMemberships[]"]
  API --> Save["databaseService.saveMembers(sectionIds, members)"]
  Save --> Branch{"isNative<br/>&& this.db?"}

  Branch -->|"web"| Split["Split each member into:<br/>• coreMember (identity, JSON blobs)<br/>• one sectionMember per role/section"]
  Split --> IDBCore["IndexedDBService.bulkUpsertCoreMembers"]
  Split --> IDBSec["IndexedDBService.bulkUpsertMemberSections"]
  IDBCore --> CoreStore["⚙️ IndexedDB: core_members<br/>keyPath: scoutid<br/>identity + JSON blobs<br/>(contact_groups, custom_data, flattened_fields)"]
  IDBSec --> SecStore["⚙️ IndexedDB: member_section<br/>keyPath: [scoutid, sectionid]<br/>per-section role: sectionname,<br/>person_type, patrol, dates"]

  Branch -->|"iOS"| Loop["For each member: REPLACE INTO members<br/>(wrapped in _runInTransaction)"]
  Loop --> SQLTable["⚙️ SQLite: members (single table)<br/>PK: scoutid (one row per scout, NOT per (scout, section))<br/>JSON-encoded: sections, contact_groups,<br/>custom_data, flattened_fields, read_only<br/>section info collapsed into top-level columns"]

  CoreStore -.->|"alignment gap (by design)"| GAP["⚠️ IndexedDB normalises to dual-store<br/>(scout can have N sections cleanly).<br/>SQLite collapses to one row per scout<br/>+ JSON-encoded `sections` array.<br/>Read paths in getMembers() reassemble<br/>shape on both sides."]
  SecStore -.-> GAP
  SQLTable -.-> GAP
```

---

## 6. Terms, Flexi (homogeneous patterns)

These follow the same DELETE+INSERT-in-transaction shape as the others. Drawn together since they share structure.

```mermaid
flowchart TB
  subgraph Terms[" "]
    TA[OSM API: terms]
    TA --> TSave[saveTerms]
    TSave --> TBranch{native?}
    TBranch -->|web| TVal[validate + bulkReplaceTermsForSection]
    TBranch -->|iOS| TSQL[no validation; DELETE + INSERT in transaction]
    TVal --> TIDB[("IndexedDB: terms<br/>keyPath: termid")]
    TSQL --> TSQLite[("SQLite: terms<br/>PK: termid")]
  end

  subgraph FlexiLists[" "]
    FA[OSM API: flexi list]
    FA --> FSave[saveFlexiLists]
    FSave --> FVal[validate at top]
    FVal --> FBranch{native?}
    FBranch -->|web| FIDB1[bulkReplaceFlexiListsForSection]
    FBranch -->|iOS| FSQL1[DELETE + INSERT OR REPLACE in transaction]
    FIDB1 --> FStore[("IndexedDB: flexi_lists")]
    FSQL1 --> FSQLite[("SQLite: flexi_lists")]
  end

  subgraph FlexiData[" "]
    FDA[OSM API: flexi data]
    FDA --> FDSave[saveFlexiData]
    FDSave --> FDVal[validate at top]
    FDVal --> FDBranch{native?}
    FDBranch -->|web| FDIDB[bulkReplace via index cursor]
    FDBranch -->|iOS| FDSQL[DELETE + INSERT in transaction]
    FDIDB --> FDStore[("IndexedDB: flexi_data")]
    FDSQL --> FDSQLite[("SQLite: flexi_data<br/>PK: extraid+sectionid+termid+scoutid")]
  end
```

---

## Alignment status (at a glance)

| Entity | Validation | Upsert semantics | Field shape | Status |
|---|---|---|---|---|
| sections | ✅ both paths | ✅ both upsert | ⚠️ web keeps `section`, SQLite drops it | UI fixed by reading `sectiontype` |
| events | ⚠️ web only | ⚠️ SQLite uses plain `INSERT` (no OR REPLACE) | ✅ same fields | **Two gaps still** |
| attendance | ✅ both paths | ✅ both upsert (after recent fix) | ✅ aligned (since migration 002) | OK |
| shared attendance | ✅ both paths | ✅ both upsert (after recent fix) | ✅ aligned | OK |
| members | ❌ neither path validates | ✅ both upsert | ⚠️ structurally different (dual-store vs single table + JSON) | **By design** — read paths reassemble |
| terms | ⚠️ web only | ⚠️ SQLite uses plain `INSERT` | ✅ same fields | Same gap as events |
| flexi_lists | ✅ both paths | ✅ both upsert | ✅ aligned | OK |
| flexi_data | ✅ both paths | ⚠️ SQLite uses plain `INSERT` | ✅ aligned | Upsert gap |
| flexi_structure | ✅ both paths | ✅ INSERT OR REPLACE single row | ✅ aligned | OK |

### Concrete follow-ups

1. **Switch to `INSERT OR REPLACE`** in `saveEvents`, `saveTerms`, `saveFlexiData` SQLite paths. Same UNIQUE-constraint trap as the attendance/sections bug.
2. **Lift validation above the `isNative` branch** in `saveEvents` and `saveTerms` (so iOS gets validated too — matches the pattern `saveAttendance` already uses).
3. **Strengthen the schema-parity test** (Layer 2) to flag plain `INSERT INTO` (vs `INSERT OR REPLACE INTO`) on tables that are bulk-rewritten via DELETE+INSERT — would catch (1) at static-analysis time.

---

_Last updated: 2026-04-28. Maintainer note: when adding a new save path, add a node to the relevant diagram and a row to the alignment table — keeps both backends visible to reviewers._
