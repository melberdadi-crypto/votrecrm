// Détection du visage (TinyFaceDetector, modèle hébergé avec le site).
export async function loadFaceDetector() {
  const faceapi = await import("../vendor/face-api/face-api.esm.js");
  await faceapi.nets.tinyFaceDetector.loadFromUri(new URL("../vendor/face-api/model/", import.meta.url).href);
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
  return async canvas => {
    try {
      const d = await faceapi.detectSingleFace(canvas, opts);
      if (!d) return null;
      const b = d.box; return { x: b.x + b.width / 2, y: b.y + b.height / 2, h: b.height };
    } catch (e) { return null; }
  };
}
