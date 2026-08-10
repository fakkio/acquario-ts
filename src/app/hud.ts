export interface Hud {
  setField(key: string, label: string, value: string): void;
}

interface HudField {
  readonly valueEl: HTMLSpanElement;
}

/**
 * Structure only: fields are keyed rows appended in first-set order, so M2
 * (pool levels, live carbon) and M5 (gene mean ± σ, CSV export) can call
 * `setField` with new keys without touching the rows already here.
 */
export function mountHud(): Hud {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "8px";
  container.style.right = "8px";
  container.style.zIndex = "10";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "2px";
  container.style.padding = "6px 10px";
  container.style.background = "rgba(0, 0, 0, 0.55)";
  container.style.color = "#fff";
  container.style.fontFamily = "monospace";
  container.style.fontSize = "12px";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  const fields = new Map<string, HudField>();

  return {
    setField(key, label, value) {
      let field = fields.get(key);
      if (!field) {
        const row = document.createElement("div");
        const labelEl = document.createElement("span");
        labelEl.textContent = `${label}: `;
        const valueEl = document.createElement("span");
        row.append(labelEl, valueEl);
        container.appendChild(row);
        field = {valueEl};
        fields.set(key, field);
      }
      field.valueEl.textContent = value;
    },
  };
}
