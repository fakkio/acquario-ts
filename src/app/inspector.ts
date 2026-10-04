import {
  bodyAreaOfRadius,
  capFor,
  maintenanceBreakdown,
  type OrganismView,
  type Resource,
} from "../world";
import type {Selection} from "./selection";

/**
 * The inspector (`docs/vision.md` § Interface, v0.2's first version): a DOM
 * panel in the HUD's style that reads the selected organism's view. It shows
 * the numbers the tick charges rather than recomputing them — maintenance
 * comes from `maintenanceBreakdown`, the world module's own function.
 * Untested per ADR-0013's TDD boundary: verified by running the app.
 */
export interface Inspector {
  /** Redraws the panel for this frame's selection. Cheap when nothing
   * changed: the organelle table is only rebuilt for a new organism. */
  render(selection: Selection): void;
}

const fixed = (value: number, digits = 3): string => value.toFixed(digits);

/** A store against its cap, with how full it is: `937.000/1000.000 (94%)`. */
const store = (organism: OrganismView, resource: Resource): string => {
  const cap = capFor(organism, resource);
  return `${fixed(organism[resource])}/${fixed(cap)} (${(
    (organism[resource] / cap) *
    100
  ).toFixed(0)}%)`;
};

export function mountInspector(): Inspector {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "44px";
  container.style.left = "8px";
  container.style.zIndex = "10";
  container.style.minWidth = "260px";
  container.style.maxHeight = "calc(100vh - 60px)";
  container.style.overflowY = "auto";
  container.style.padding = "6px 10px";
  container.style.background = "rgba(0, 0, 0, 0.55)";
  container.style.color = "#fff";
  container.style.fontFamily = "monospace";
  container.style.fontSize = "12px";
  container.style.pointerEvents = "none";
  container.style.display = "none";
  document.body.appendChild(container);

  const summary = document.createElement("pre");
  summary.style.margin = "0";
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.marginTop = "6px";
  container.append(summary, table);

  let tableFor: OrganismView | null = null;

  const rebuildTable = (organism: OrganismView): void => {
    table.replaceChildren();
    if (organism.organelles.length === 0) {
      tableFor = organism;
      return;
    }

    const head = table.insertRow();
    for (const title of ["type", "id", "radius", "x", "y"]) {
      const cell = document.createElement("th");
      cell.textContent = title;
      cell.style.textAlign = "right";
      cell.style.padding = "0 6px";
      head.appendChild(cell);
    }
    for (const organelle of organism.organelles) {
      const row = table.insertRow();
      const values = [
        organelle.type,
        String(organelle.innovationId),
        fixed(organelle.radius),
        fixed(organelle.x),
        fixed(organelle.y),
      ];
      for (const value of values) {
        const cell = row.insertCell();
        cell.textContent = value;
        cell.style.textAlign = "right";
        cell.style.padding = "0 6px";
      }
    }
    tableFor = organism;
  };

  return {
    render(selection) {
      if (selection.kind === "none") {
        container.style.display = "none";
        tableFor = null;
        return;
      }

      container.style.display = "block";

      if (selection.kind === "dead") {
        summary.textContent = `Died at tick ${String(selection.tick)}`;
        table.replaceChildren();
        tableFor = null;
        return;
      }

      const organism = selection.organism;
      const maintenance = maintenanceBreakdown(organism);
      let organelleArea = 0;
      for (const organelle of organism.organelles) {
        organelleArea += bodyAreaOfRadius(organelle.radius);
      }
      summary.textContent = [
        `Generation ${String(organism.generation)}`,
        "",
        "Genes",
        `  cytoplasm thickness ${fixed(organism.cytoplasmThickness)}`,
        `  mitosis threshold   ${fixed(organism.mitosisEnergyThreshold)}`,
        `  child allocation    ${fixed(organism.childAllocationRatio)}`,
        `  lineage hue         ${fixed(organism.lineageHue)}`,
        "",
        "Body",
        `  radius              ${fixed(organism.bodyRadius)}`,
        `  cytoplasm area      ${fixed(organism.cytoplasmArea)}`,
        `  organelle areas     ${fixed(organelleArea)}`,
        "",
        `Maintenance ${fixed(maintenance.total, 5)} / tick`,
        `  c₀                  ${fixed(maintenance.existence, 5)}`,
        `  cytoplasm           ${fixed(maintenance.cytoplasm, 5)}`,
        `  organelle overheads ${fixed(maintenance.organelleOverheads, 5)}`,
        `  organelle tissue    ${fixed(maintenance.organelleTissue, 5)}`,
        "",
        "Stores",
        `  energy ${store(organism, "energy")}`,
        `  food   ${store(organism, "food")}`,
        `  O₂     ${store(organism, "oxygen")}`,
        `  CO₂    ${store(organism, "carbonDioxide")}`,
        "",
        `Organelles (${String(organism.organelles.length)})`,
      ].join("\n");

      if (tableFor !== organism) {
        rebuildTable(organism);
      }
    },
  };
}
