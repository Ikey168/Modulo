# Electronics Workbench plugin pack

The Electronics Workbench pack implements the complete maker flow:

`Idea → Specification → Research → Prototype → Schematic → PCB → Assembly → Bring-up → Testing → Enclosure → Done`

| Plugin | Scope |
| --- | --- |
| Electronics Projects | Build type, lifecycle stage, revision, repository, next action, target, and definition of done |
| Components & Procurement | Parts, footprints, stock, storage, datasheets, reorder thresholds, BOM lines, vendors, orders, and substitutions |
| Prototype, Build & Test Lab | Decisions, circuits, prototypes, schematics, PCBs, assembly, expected/observed measurements, firmware, enclosures, repairs, and reusable knowledge |
| Workbench Dashboard | Active builds, BOM blockers, low stock, failed/passed tests, pipeline distribution, and finished artifacts |

Lab entries can be scheduled into the same day blocks used by Planner and Calendar. The pack reuses Hobby Stack, Research Lab intake, Education Core, Home Inventory, and Wishlist rather than copying their data.

KiCad, Git, distributor catalogs, fabrication services, and test-equipment capture remain optional future adapters, so the local core is not coupled to a vendor.
