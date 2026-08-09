export function mountCanvas(doc: Document): HTMLCanvasElement {
  const canvas = doc.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  doc.body.appendChild(canvas);

  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  return canvas;
}
