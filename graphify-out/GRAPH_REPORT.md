# Graph Report - .  (2026-11-05)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 208 nodes · 369 edges · 10 communities (4 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9

## God Nodes (most connected - your core abstractions)
1. `CareTrackApp` - 36 edges
2. `BiomedicalEquipmentCatalog` - 14 edges
3. `CareTrackCache` - 13 edges
4. `PatientRegistry` - 12 edges
5. `SettlementService` - 12 edges
6. `VisitService` - 12 edges
7. `EmergencySwapService` - 11 edges
8. `sha256()` - 10 edges
9. `formatARS()` - 10 edges
10. `scripts` - 9 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (10 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (53): badUrl1, badUrl2, batchPeriod, bCatalog, cache, checkin, clean1, cleanImg (+45 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (3): CareTrackApp, formatARS(), Sanitizer

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (23): autoprefixer, description, devDependencies, autoprefixer, postcss, tailwindcss, vite, name (+15 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (7): PROFESSIONAL_FEES, VisitService, rightRotate(), sha256(), evaluateVitals(), formatDate(), formatDateTime()

## Knowledge Gaps
- **70 isolated node(s):** `name`, `version`, `description`, `private`, `type` (+65 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `CareTrackApp` connect `Community 1` to `Community 3`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Why does `BiomedicalEquipmentCatalog` connect `Community 4` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `CareTrackCache` connect `Community 6` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _70 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03571428571428571 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14982578397212543 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._