/**
 * The release the page is running, small and out of the way in the bottom-right
 * corner, the one corner the HUD, the controls and the inspector leave free.
 */
export function mountVersionBadge(version: string): void {
  const badge = document.createElement("div");
  badge.textContent = `v${version}`;
  badge.style.position = "fixed";
  badge.style.bottom = "8px";
  badge.style.right = "8px";
  badge.style.zIndex = "10";
  badge.style.padding = "2px 6px";
  badge.style.background = "rgba(0, 0, 0, 0.55)";
  badge.style.color = "rgba(255, 255, 255, 0.7)";
  badge.style.fontFamily = "monospace";
  badge.style.fontSize = "11px";
  badge.style.pointerEvents = "none";
  document.body.appendChild(badge);
}
