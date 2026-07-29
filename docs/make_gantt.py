#!/usr/bin/env python3
"""Generate the Cluster 3 Gantt chart as a PNG."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

STUDENT = "Pedro Alvim"
SID = "CTI20260187"
DATE = "29 July 2026"

# (task, start_week, duration_weeks, block)
tasks = [
    ("Client meeting & tool selection", 0, 1, "B1"),
    ("Project plan, Gantt, checklist",   0, 1, "B1"),
    ("GitHub repo & project board",      0, 1, "B1"),
    ("App scaffold & catalogue model",   1, 1, "B2"),
    ("CRUD REST endpoints",              1, 2, "B2"),
    ("Web / desktop / mobile views",     2, 1, "B2"),
    ("Mash-up 1: store-locator map",     3, 1, "B3"),
    ("Mash-up 2: live pricing",          4, 1, "B3"),
    ("Testing & evidence",               4, 1, "B3"),
    ("Assessment doc & submission",      5, 1, "WU"),
]

colors = {"B1": "#4C72B0", "B2": "#55A868", "B3": "#C44E52", "WU": "#8172B3"}
labels = {"B1": "Block 1 – Manage project",
          "B2": "Block 2 – Build web app",
          "B3": "Block 3 – Integrate data",
          "WU": "Wrap-up"}

fig, ax = plt.subplots(figsize=(12, 6.5))
ypos = range(len(tasks))
for i, (name, start, dur, block) in enumerate(tasks):
    ax.barh(i, dur, left=start, height=0.55,
            color=colors[block], edgecolor="black", linewidth=0.6)

ax.set_yticks(list(ypos))
ax.set_yticklabels([t[0] for t in tasks])
ax.invert_yaxis()
ax.set_xticks(range(7))
ax.set_xticklabels([f"Wk {i+1}" for i in range(6)] + [""])
ax.set_xlim(0, 6)
ax.set_xlabel("Cluster timeline (weeks)")
ax.set_title("Cluster 3 — Online Bookstore: Project Gantt Chart", fontsize=14, fontweight="bold")
ax.grid(axis="x", linestyle="--", alpha=0.4)

legend_items = [Patch(facecolor=colors[k], edgecolor="black", label=labels[k])
                for k in ["B1", "B2", "B3", "WU"]]
ax.legend(handles=legend_items, loc="lower right", fontsize=9)

fig.text(0.01, 0.01, f"{STUDENT}  |  ID: {SID}  |  {DATE}",
         fontsize=9, color="#333333")
plt.tight_layout(rect=[0, 0.03, 1, 1])
plt.savefig("/root/cluster3-project/docs/gantt-cluster3.png", dpi=150)
print("saved")
