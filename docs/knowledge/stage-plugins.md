# Knowledge: plugins grouped by information mode

Knowledge is navigation organized around the ten Information Intake Modes. There is no Research Workflow dashboard or engine to open or install. Each entry opens the plugin that performs a concrete job.

| Stage | Modulo plugins |
| --- | --- |
| Awareness | Information Intake Router, Feeds & Reading Inbox, Web Watch, Document Inbox & OCR, Universal Inbox, Bookmarks & Read Later, Web Archive & Read Later |
| Exploration | Research Projects & Trails, Mode Workbench |
| Deep Research | Sources, Claims, Evidence Synthesis, Reading Annotations, Citation Manager |
| Decision Support | Decision Journal, Decision Cases |
| Problem-Solving | Problem Solver |
| Creation | Creation Briefs, Manuscripts, Editorial Workflow, Publishing, Information Outputs |
| Externalization | Procedure Design, Executable Runbooks, Living Documents |
| Internalization | Learning, Curriculum, Study, Assignments, Flashcards & Spaced Repetition, Learning Goals, Skill Tree, Practice Plans |
| Iteration | Experiments, Reproducibility |
| Maintenance | Knowledge Maintenance, Timeline, Workspace Time Machine, What Changed? |

Notes, Canvas, Graph, Tags, and Saved Searches appear in Notes & Tools, the first section of Knowledge. Domain-specific dashboards, when installed, belong to their domain's stage.

## Replacing the previous app roles

- Miniflux/newsletter triage: feeds, web monitoring, and inbox tools in Awareness.
- Wallabag saves and annotation: bookmarks and web archive in Awareness; annotations and citations in Deep Research.
- Notion research structures: projects, sources, claims, synthesis, output templates, and decision records.
- Notion playbooks: Procedure Design and Executable Runbooks in Externalization.
- Anki-style practice: Modulo's Flashcards & Spaced Repetition, Study, and Practice Plans in Internalization.

These are functional role assignments, not a claim of full feature or import compatibility with those products. Existing optional integrations remain available. This change does not import or delete data in external applications.

## Existing installations and data

The old `research-workflow-engine` and `information-dashboard` IDs remain internal, viewless compatibility entries. They are absent from marketplace metadata and current packs. On startup, existing installations gain the independent role plugins through dependency repair.

Role plugins retain the existing research view IDs and shared research records. Decision and problem lists filter the same case collection by kind. Creation briefs and procedure designs similarly filter by kind; saving one kind preserves the other. The five Notes & Tools entries retain their view IDs.

The shared navigation applies to web and Android. Deployment and installation are separate from the source change.
