export interface Controls {
  readonly playPauseButton: HTMLButtonElement;
  readonly stepButton: HTMLButtonElement;
  /** Toggles the uniform grid's debug overlay. One button relabelled with
   * the next action, the way play/pause already is. */
  readonly gridButton: HTMLButtonElement;
  /** Constructs a new world on demand (ADR-0018), at any time, not only at
   * extinction — debugging tooling for sampling seeds quickly. */
  readonly newWorldButton: HTMLButtonElement;
  /** Toggles automatic restart on extinction, on by default from M5
   * (ADR-0018): a fertile world is worth watching as a sequence rather than
   * one dead aquarium. Toggle it off to watch a single world's story play
   * out to its end uninterrupted, M3's own reason for having shipped it
   * off. */
  readonly autoRestartButton: HTMLButtonElement;
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

  const newWorldButton = document.createElement("button");
  newWorldButton.type = "button";
  newWorldButton.textContent = "New world";

  const autoRestartButton = document.createElement("button");
  autoRestartButton.type = "button";
  autoRestartButton.textContent = "Auto-restart: on";

  container.append(
    playPauseButton,
    stepButton,
    gridButton,
    newWorldButton,
    autoRestartButton,
  );
  document.body.appendChild(container);

  return {
    playPauseButton,
    stepButton,
    gridButton,
    newWorldButton,
    autoRestartButton,
  };
}
