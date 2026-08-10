export interface Controls {
  readonly playButton: HTMLButtonElement;
  readonly pauseButton: HTMLButtonElement;
  readonly stepButton: HTMLButtonElement;
}

/**
 * Structure only — every later milestone debugs one tick at a time through
 * these three controls, so their DOM identity stays stable even as the HUD
 * shell (M0's next ticket) grows around them.
 */
export function mountControls(): Controls {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "8px";
  container.style.left = "8px";
  container.style.display = "flex";
  container.style.gap = "8px";
  container.style.zIndex = "10";

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.textContent = "Play";

  const pauseButton = document.createElement("button");
  pauseButton.type = "button";
  pauseButton.textContent = "Pause";

  const stepButton = document.createElement("button");
  stepButton.type = "button";
  stepButton.textContent = "Step";

  container.append(playButton, pauseButton, stepButton);
  document.body.appendChild(container);

  return {playButton, pauseButton, stepButton};
}
