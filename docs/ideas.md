# Future ideas

Unshaped ideas for later versions, logged before they're worth a `vision.md` section, an ADR or a ticket. An idea graduates out of this file the moment it lands in `vision.md`, an ADR or an issue — delete it here at that point rather than leaving it duplicated.

- A founder archive: the next world's generation 0 mutated from genomes carried forward from the last, holding the seed pinned so genetics is the only axis that varies between worlds (ADR-0018 — in-session memory only, and the selection criterion is deliberately still open). What would make it worth persisting rather than keeping in memory: carrying the archive across launches, so reopening AcquarioTS resumes from the genomes the last session ended on. That needs persistence v0.1 does not have and a genome schema worth versioning, which the four-field record on its way to `Gene[]` is not — so it waits for v0.2 rather than for M5, whose done-criteria runs require cross-run inheritance to be off anyway (ADR-0018).
- Growth during life.
- Embryonic development.
- Organelle damage.
- Organelles created or destroyed during life.
- More complex reproduction.
- Asynchronous organelle simulation.
- Full genealogy, including a genealogical tree view.
- Manual genome editor.
- User-designed organisms.
- Richer metabolic systems.
- New organelle types.
- Advanced brain visualisation, including synapse visualisation.
- Picture-in-picture view for a selected organism.
- Passive photosynthesis and passive respiration rates proportional to body area rather than to diameter, which would create a genuine trade-off between diameter and body area. Respiration already scales with area; photosynthesis currently scales with diameter, and that choice is what keeps energy income linear in `r`, the assumption `r_opt = 2·c₀/α` rests on — moving it to area needs that derivation reworked too.
- Bodies occupy every grid cell they overlap, not only the one their centre falls in.
