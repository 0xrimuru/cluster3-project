# Project Plan — Cluster 3 (ICT50220 Advanced Programming)

**Student:** Pedro Alvim  **Student ID:** CTI20260187
**Unit (this phase):** ICTPRG530 — Manage projects using software management tools
**Date:** 29 July 2026  **Version:** 2.0

---

## 1. Purpose

This plan describes how the Cluster 3 project is planned, tracked and delivered across **all ten units**, using professional project-management and source-control tools. Cluster 3 (Advanced Programming) runs **01/06/2026 – 27/11/2026**, with each unit taught in a two-week block.

## 2. Scope

### The product
One connected **e-commerce project** presented as three faces of the same idea (per the Technical Specifications): a **webstore** (browser), a **desktop** interface, and a **mobile** interface, backed by a shared catalogue/data service. It is built in two stages — an intermediate "pre-alpha" core first, then an advanced version that adds the harder features (NoSQL, advanced UI, dynamic pages, security, advanced programming). The Block 1 planning artefacts use a **bookstore** as the worked example.

### In scope (across the cluster)
- Project management + source control (Block 1)
- MVC application skeleton handling GET/POST/PUT/DELETE (Block 2)
- Two data mashups via external APIs (Block 3)
- Advanced, customisable UI with graphics/multimedia (Block 4)
- Validation of designs against the specification (Block 5)
- Dynamic web pages tested across 2 browsers / 2 devices (Block 6)
- Database integration with full CRUD (Block 7)
- NoSQL data persistence (Block 8)
- Application security: authentication, encryption, injection defence (Block 9)
- Intermediate OOP + GUI (Block 10)

### Out of scope
- Real payment processing / live checkout
- Production hosting / real customer accounts

### Assumptions
- Free tooling only; language/stack confirmed with the assessor (Node.js + MongoDB, or PHP + MySQL + Java, both fit).
- The trainer plays the client for requirements and sign-off.
- Sample/seed data is acceptable in place of live production data.

### Constraints
- Fixed cluster window 01/06/2026 – 27/11/2026; each unit is a two-week block.
- Solo developer (the student performs every role).
- Auditable Git commit history required as authenticity evidence.

## 3. Deliverables

- Master assessment Word document (Calibri 11): `ICT50220(ADP) CLUSTER 3 ASSESSMENTS_CTI20260187_SUB1.docx`, containing the Meeting section + numbered Phase sections.
- All source code in the single `cluster3-project` Git repo (pushed to GitHub).
- Signed client meeting minutes.
- Screenshots for each phase (board, repo, commits, running app, tests) — **name + ID + date on every one**.
- PASS/FAIL test tables, database export, mashup/API evidence, UI evidence, security evidence.
- Live demonstration to the assessor; signed declaration of originality.
- Everything zipped into one compressed folder.

## 4. Schedule (from the CTI task guide)

Teaching-block order and assessment-doc **Phase** numbers differ — both are shown.

| Block | Unit | Focus | Dates | Assess. Phase |
|-------|------|-------|-------|---------------|
| 1 | ICTPRG530 | Manage projects + source control | 01/06 – 12/06/2026 | 1 |
| 2 | ICTPRG556 | MVC framework | 15/06 – 26/06/2026 | 7 |
| — | *Buffer / catch-up* | *finish Blocks 1–2, tidy GitHub* | 29/06 – 17/07/2026 | — |
| 3 | ICTPRG538 | Create mashups | 20/07 – 31/07/2026 | 2 |
| 4 | ICTPRG535 | Build advanced user interfaces | 03/08 – 14/08/2026 | 4 |
| 5 | ICTPRG546 | Validate application designs | 17/08 – 28/08/2026 | TBC* |
| 6 | ICTWEB514 | Create dynamic web pages | 31/08 – 11/09/2026 | 5 |
| 7 | ICTDBS507 | Integrate databases with website | 14/09 – 25/09/2026 | 6 |
| — | *Buffer / catch-up* | *finish evidence, tidy repo* | 28/09 – 16/10/2026 | — |
| 8 | ICTPRG554 | Manage data persistence (NoSQL) | 19/10 – 30/10/2026 | 3 |
| 9 | ICTPRG537 | Implement application security | 02/11 – 13/11/2026 | 8 |
| 10 | ICTPRG549 | Apply intermediate OO language skills | 16/11 – 27/11/2026 | 9 |

\* The assessment doc also references **ICTPRG547 (Apply advanced programming skills)** as Phase 10, and the source guide flags a Phase-5 / ICTPRG546 mismatch — **confirm the exact phase list with your trainer.**

## 5. Roles and responsibilities (who does what)

Solo project — the student wears every "hat"; the table shows which role applies to each activity.

| Role | Responsibility | Assigned to |
|------|----------------|-------------|
| Client | Provides requirements, signs off minutes | Trainer (role-play) |
| Project manager | Maintains plan, board, Gantt; tracks progress | Pedro Alvim |
| Developer | Writes and commits code | Pedro Alvim |
| Tester | Verifies features, records PASS/FAIL evidence | Pedro Alvim |
| Documenter | Maintains README and assessment doc | Pedro Alvim |

## 6. Tools selected

| Purpose | Tool | Why |
|---------|------|-----|
| Source control | Git + GitHub | Industry standard; free; commit history = authentic, dated evidence. |
| Project board | GitHub Projects | Free, beside the repo; links tasks to commits. |
| Gantt / diagrams | draw.io | Free; exports PNG for the assessment. |
| Editor / IDE | Visual Studio Code | Free; Git integration + debugger. |
| API testing | Postman | Capture request/response for the mashups (Block 3). |
| Databases | XAMPP (MySQL) / MongoDB + Compass | Used from Blocks 7–8; confirm with assessor. |

## 7. How tool use is monitored

- **Git history** (`git log`) — a dated, auditable record of every change per phase.
- **GitHub Projects board** — cards move To Do → In Progress → Done, showing progress against this schedule.
- **Milestone checklist** (`milestone-checklist.md`) — ticked off as each artefact/feature completes.
- **Trainer check-ins** — tool choices and the first commit confirmed early as an authenticity signal; weekly commit/board review thereafter.

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Falling behind the 2-week block cadence | Medium | High | Use the two buffer weeks; capture evidence as you build, not at the end. |
| External API changes/limits (Block 3) | Medium | Medium | Cache responses; document any substitution as a managed change. |
| Losing work | Low | High | Commit and push to GitHub frequently. |
| Stack/language not accepted by assessor | Low | High | Confirm language + framework with the assessor before Block 2. |

---

*Approved by (client/trainer): ___________________________  Date: ____________*
