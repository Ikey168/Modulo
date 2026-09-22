# Education System plugin pack

The Education System pack provides structured learning management without
turning courses, sessions, or assessments into generic PARA tasks. It installs
five independently installable plugins:

| Plugin | Contribution |
|---|---|
| Learning Core | Programs and courses, providers, instructors, dates, outcomes, and optional PARA links |
| Curriculum | A Program → Course → Module → Lesson → Activity hierarchy with completion tracking |
| Study Planner | Weekly study sessions with duration, focus notes, and the shared eight day blocks |
| Assignments & Assessments | Exercises, assignments, exams, projects, deadlines, submissions, scores, and feedback |
| Education Dashboard | Active learning, progress, weekly study time, planned sessions, upcoming work, and overdue warnings |

All five plugins use a shared versioned `modulo-education-v1` store. Learning
records may link to PARA Projects, Areas, and Goals while remaining owned by
the education system. Deleting a curriculum branch also removes its dependent
study sessions and assignments.

The pack deliberately includes no migration or import plugin.
