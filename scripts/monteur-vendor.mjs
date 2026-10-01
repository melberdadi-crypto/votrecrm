// Copie les fichiers de transcription (transformers.js + ONNX Runtime) dans public/monteur/vendor/transformers.
// Ils ne sont pas versionnés dans Git (fichiers volumineux, et faux positif du scanner de secrets de GitHub).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const dest = join(process.cwd(), "public", "monteur", "vendor", "transformers");
mkdirSync(dest, { recursive: true });
const nm = join(process.cwd(), "node_modules");
const tfDir = join(nm, "@huggingface", "transformers", "dist");
const ortNested = join(nm, "@huggingface", "transformers", "node_modules", "onnxruntime-web", "dist");
const ortDir = existsSync(ortNested) ? ortNested : join(nm, "onnxruntime-web", "dist");
const fichiers = [
  [join(tfDir, "transformers.min.js"), "transformers.min.js"],
  [join(ortDir, "ort-wasm-simd-threaded.asyncify.mjs"), "ort-wasm-simd-threaded.asyncify.mjs"],
  [join(ortDir, "ort-wasm-simd-threaded.asyncify.wasm"), "ort-wasm-simd-threaded.asyncify.wasm"],
];
for (const [src, nom] of fichiers) {
  if (!existsSync(src)) { console.error(`[monteur] fichier manquant : ${src}`); process.exit(1); }
  copyFileSync(src, join(dest, nom));
}
console.log(`[monteur] ${fichiers.length} fichiers de transcription copiés`);
