# Assessment Document — Phase 1 Draft (ICTPRG530)

**Student:** Pedro Alvim **Student ID:** CTI20260187 **Date:** 29 July 2026

> Copy the two sections below into the official assessment document. Text in *(brackets/italics)* is a prompt for you to confirm from the real meeting.

---

## Meeting section

**Client meeting held:** 29 July 2026, with the trainer acting as client.

I chaired the kick-off meeting and took minutes using the CTI agenda/minutes template (see `meeting-agenda-minutes.md`). The agenda covered the purpose of the project, the webstore, desktop and mobile requirements, non-functional needs, constraints and timeframe, expected data integrations, and how progress would be reported.

During the meeting I asked the client about each platform:
- **Webstore:** what a visitor must be able to do without an account, which book fields are mandatory, and whether checkout or just a cart is in scope.
- **Desktop:** target platform (Windows vs cross-platform) and whether any offline use is needed.
- **Mobile:** whether a responsive web view is acceptable or a native app is required, and which devices must be supported.

The agreed scope is an online **bookstore** with a shared book catalogue exposed through a REST API, presented as a webstore, a desktop experience and a mobile-friendly view, with cart (no live payment) and two data mash-ups later in the cluster. *(Adjust to match the client's actual answers.)* The minutes were reviewed and **signed by the client** to confirm they are an accurate record.

## Phase 1 section — tools selected, why, and how their use was monitored

**Project management tool — GitHub Projects.** I chose GitHub Projects because it is free, sits directly beside the code repository, and lets me link tasks (issues/cards) to the commits that resolve them. A board with To Do / In Progress / Done columns gives a clear, live picture of progress against the plan.

**Source-control tool — Git with GitHub.** Git is the industry-standard version-control system and GitHub provides free hosting with a full, dated commit history. This history is an authentic, current evidence trail: each phase of work is captured in a commit with a descriptive message, so my activity can be audited over time.

**Supporting tools.** I used **draw.io** to produce the Gantt chart (exported as PNG) and **Visual Studio Code** as the editor because it has built-in Git integration and a debugger, both of which I use later in the cluster.

**How I monitored their use.** I monitored tool use in three ways. First, the **Git commit history** (`git log`) records every change with a date and message, so progress and authorship are traceable. Second, the **GitHub Projects board** was kept current by moving cards across columns as work progressed, which surfaced anything falling behind schedule. Third, the **milestone checklist** (`milestone-checklist.md`) was ticked off as each artefact and feature was completed, and I confirmed my tool choices and first commit with the trainer as an early authenticity check. Together these gave me a continuous, dated view of how the tools were being used across the project.

---

### Evidence to attach in this section
- Signed meeting minutes
- Screenshot: GitHub repository (showing repo name)
- Screenshot: first commit (commit message + date/hash)
- Screenshot: GitHub Projects board
- Gantt chart image (`gantt-cluster3.png`)

*(Every screenshot must show my name, student ID and the date.)*
