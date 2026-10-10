---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/components/RoadmapDashboard.jsx","src/components/GoalsPage.jsx"]
---

# Course Planner app shell (all tabs)

Scope: the whole web app (src/App.jsx and every tab component). Mode: Operate.
Audience: KKU CS students planning their own path on phone and desktop equally; advisor and committee watching demos.
Constraints: blue-white tone pinned by the owner, dark theme kept as an option; must read as KKU College of Computing without official marks (none on hand); Thai UI with English course names.

## Direction contract

THESIS: A calm university portal built to Notion's craft level: the plan, its risks and the next action are legible in one scan. It refuses ornament, emoji-as-icons, neon dark chrome and novelty controls.

OWN-WORLD: White content ground on a cool blue-grey page wash, slate ink, one KKU-blue accent for primary action, selection and the current term; pale sky tint for active rows; hairline borders, soft offset shadows, 8–10px radii. Inter with Noto Sans Thai, tabular figures. One stroke icon family. Status colours (green passed, red failed, amber critical path, blue planned) only where they carry meaning. Dark option: deep navy ground, same blue.

STORY: The student sees when they will graduate, what each term holds, what is at risk and why, then sets goals, records grades or asks the curriculum. The committee sees the computation, not decoration.

FIRST VIEWPORT: Desktop: 248px left sidebar (product name and college line, five nav items with icons, theme toggle and status at the foot). Main: page title, one-line context (tracks · hours · curriculum), one summary strip led by the graduation forecast, a toolbar of plan controls, then four term panels with course rows. Mobile: compact top bar, bottom tab bar, single-column terms.

FORM: The category standard (user picked canon, "University Portal"), quality bar Notion; seed key 1af24202.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
