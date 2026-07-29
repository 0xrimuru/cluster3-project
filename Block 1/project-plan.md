# Project Plan — Cluster 3 Online Bookstore

**Student:** Pedro Alvim **Student ID:** CTI20260187
**Unit:** ICTPRG530 — Manage projects using software management tools
**Date:** 29 July 2026 **Version:** 1.0

---

## 1. Purpose

This plan describes how the Cluster 3 project — an online **bookstore** available on **web, desktop and mobile** — will be planned, tracked and delivered using professional software project-management and source-control tools.

## 2. Scope

### In scope
- A **webstore** (browser) where customers browse a book catalogue, view details, and add to cart.
- A **desktop** front-end offering the same core catalogue features.
- A **mobile** front-end (responsive/mobile view) for browsing on phones.
- A shared back-end service exposing the book catalogue via a REST API (full CRUD: create, read, update, delete).
- Two data mash-ups in Block 3 (e.g. a store-locator map and live international pricing).
- Project artefacts: plan, schedule/Gantt, milestone checklist, meeting minutes, repo and board.

### Out of scope
- Real payment processing / live checkout.
- Real user accounts, passwords, or production hosting.
- Warehouse/inventory or shipping integrations.

### Assumptions
- Free tooling only (GitHub, Git, draw.io, VS Code).
- Sample/seed data is acceptable in place of a live production database.
- The trainer acts as the client for requirements sign-off.

### Constraints
- Fixed cluster timeframe (see schedule below).
- Solo developer (the student performs all roles).
- Must use version control with an auditable commit history.

## 3. Deliverables

| # | Deliverable | Block |
|---|-------------|-------|
| 1 | Project plan (this document) | 1 |
| 2 | Milestone checklist | 1 |
| 3 | Client meeting agenda + signed minutes | 1 |
| 4 | Gantt chart | 1 |
| 5 | GitHub repo + project board | 1 |
| 6 | Working web application with CRUD REST API | 2 |
| 7 | Two integrated data mash-ups | 3 |

## 4. Schedule

| Phase | Work | Planned window |
|-------|------|----------------|
| Block 1 — Planning | Client meeting, tool selection, plan, Gantt, repo, board | Week 1 |
| Block 2 — Build | Web app scaffold, catalogue model, CRUD REST endpoints, views for web/desktop/mobile | Weeks 2–3 |
| Block 3 — Integrate | Mash-up 1 (map), Mash-up 2 (pricing), testing, evidence | Weeks 4–5 |
| Wrap-up | Final testing, assessment document, submission | Week 6 |

*(Adjust the weeks to your actual class dates — the Gantt chart mirrors this table.)*

## 5. Roles and responsibilities (who does what)

As a solo project the student performs every role; the table shows which "hat" is worn for each activity, which is how professional teams divide the same work.

| Role | Responsibility | Assigned to |
|------|----------------|-------------|
| Client | Provides requirements, signs off minutes | Trainer (role-play) |
| Project manager | Maintains plan, board, Gantt; tracks progress | Pedro Alvim |
| Developer | Writes and commits code | Pedro Alvim |
| Tester | Verifies features, records evidence | Pedro Alvim |
| Documenter | Maintains README and assessment doc | Pedro Alvim |

## 6. Tools selected

| Purpose | Tool | Why |
|---------|------|-----|
| Source control | **Git + GitHub** | Industry standard; free; full commit history gives authentic, dated evidence. |
| Project management / board | **GitHub Projects** | Free, lives beside the repo, links issues to commits — one place to track work. |
| Scheduling / Gantt | **draw.io** | Free diagramming, exports PNG for the assessment. |
| Code editor | **Visual Studio Code** | Free; Git integration and debugger built in. |

## 7. How tool use is monitored

- **Git history** — commits are made per phase with clear messages; `git log` provides an auditable, dated record of activity.
- **GitHub Projects board** — cards move To Do → In Progress → Done, giving a live view of progress against the plan.
- **Milestone checklist** — ticked off as each artefact/feature is completed (see `milestone-checklist.md`).
- **Trainer check-ins** — first commit and tool choices confirmed with the trainer as an early authenticity signal.

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Scope creep beyond cluster time | Medium | High | Lock scope in the client meeting; park extras. |
| External API changes/limits (Block 3) | Medium | Medium | Cache responses; document any substitution as a managed change. |
| Losing work | Low | High | Commit and push to GitHub frequently. |

---

*Approved by (client/trainer): ___________________________  Date: ____________*
