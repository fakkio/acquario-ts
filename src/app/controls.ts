export interface Controls {
  readonly playPauseButton: HTMLButtonElement;
  readonly stepButton: HTMLButtonElement;
  /** Toggles the uniform grid's debug overlay. One button relabelled with
   * the next action, the way play/pause already is. */
  readonly gridButton: HTMLButtonElement;
}

/**
 * Structure only — every later milestone debugs one tick at a time through
 * these controls, so their DOM identity stays stable even as the HUD shell
 * (M0's next ticket) grows around them.
 */
export function mountControls(): Controls {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "8px";
  container.style.left = "8px";
  container.style.display = "flex";
  container.style.gap = "8px";
  container.style.zIndex = "10";

  const playPauseButton = document.createElement("button");
  playPauseButton.type = "button";
  playPauseButton.textContent = "Play";

  const stepButton = document.createElement("button");
  stepButton.type = "button";
  stepButton.textContent = "Step";

  const gridButton = document.createElement("button");
  gridButton.type = "button";
  gridButton.textContent = "Show grid";

  container.append(playPauseButton, stepButton, gridButton);
  document.body.appendChild(container);

  return {playPauseButton, stepButton, gridButton};
}
