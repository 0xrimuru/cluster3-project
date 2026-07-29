# Block 1 — Your Step-by-Step Guide (the parts only you can do)

**Student:** Pedro Alvim **ID:** CTI20260187

I've built all the documents for you. This guide walks you through the hands-on parts I can't do from here: the client meeting, creating the GitHub repo + first commit, the project board, and screenshots. Do them in order.

> **Golden rule for evidence:** every screenshot must clearly show **your name (Pedro Alvim), your student ID (CTI20260187) and the date**. Easiest way: keep a sticky note / text box on screen, or set your GitHub profile name and a repo description that include them.

---

## Step 1 — Run the client meeting (in class)

1. Take the printed/opened `meeting-agenda-minutes.md` to the role-play meeting.
2. Work through Part A (agenda). For each platform, **ask the questions already listed** under sections 3, 4 and 5 and write the client's real answers into the blanks.
3. After the meeting, fill Part C (actions) and get the client (trainer) to **sign Part D**.
4. Keep the signed copy — a scan or photo is your "signed meeting minutes" evidence.

## Step 2 — Create the GitHub repository

1. Sign in at https://github.com (create a free account if needed).
2. Click **+ ▸ New repository**.
3. Name it `cluster3-project`. Description: `Cluster 3 bookstore — Pedro Alvim CTI20260187`.
4. Set to Public (or Private if your trainer prefers). **Do not** add a README/gitignore — we already have them.
5. Click **Create repository** and copy the HTTPS URL it shows.
6. 📸 **Screenshot the repo page** (name + description visible).

## Step 3 — Push the project (first commit)

I've already run `git init` and staged the first commit locally in the folder I'm sending you. On your computer, open a terminal in the `cluster3-project` folder and run:

```bash
git remote add origin https://github.com/<your-username>/cluster3-project.git
git branch -M main
git push -u origin main
```

If Git asks who you are first, run:
```bash
git config user.name "Pedro Alvim"
git config user.email "your-email@example.com"
```

Then on GitHub open the repo and click into the commit.
📸 **Screenshot the first commit** (commit message, hash and date visible).

> If you'd rather not use the terminal: on the new empty repo GitHub shows an "uploading an existing file" link — drag the whole folder in and commit through the browser. The commit still counts as your first commit.

## Step 4 — Set up the project board

1. In your repo, open the **Projects** tab ▸ **New project** ▸ **Board**.
2. Name it `Cluster 3 Board`.
3. Add three columns: **To Do**, **In Progress**, **Done**.
4. Add a card for each milestone (copy from `milestone-checklist.md`), e.g. "Client meeting & minutes", "Repo + first commit", "Project plan", "Gantt chart", "Block 2: CRUD endpoints"…
5. Move the Block 1 cards you've finished into **Done**.
6. 📸 **Screenshot the board.**

## Step 5 — Drop everything into the assessment document

1. Open your official assessment document.
2. Paste the **Meeting section** and **Phase 1 section** from `phase1-assessment-draft.md`, adjusting any bracketed notes to match your real meeting.
3. Insert your four screenshots + the Gantt image in the evidence area.

## Step 6 — End-of-week checklist (tick these off)

- [ ] Attended client meeting; minutes completed **and signed**
- [ ] GitHub repo created with first commit
- [ ] Project board set up
- [ ] Project plan + Gantt + milestone checklist saved in `/docs`
- [ ] Phase 1 section drafted in assessment doc

---

### What to send back to me when you're done
Tell me once the repo is pushed and the meeting is signed. Then just say **"start Block 2"** and I'll scaffold the bookstore web app (the CRUD REST API and the web/desktop/mobile views).
