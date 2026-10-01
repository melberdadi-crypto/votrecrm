// Transcription Whisper dans un Web Worker (aucun serveur, aucuns frais).
import { pipeline, env } from "../vendor/transformers/transformers.min.js";

let asr = null, loadedModel = null;
self.onmessage = async ({ data }) => {
  try {
    const { audio, model, local } = data;
    env.backends.onnx.wasm.wasmPaths = new URL("../vendor/transformers/", import.meta.url).href;
    if (local) { env.allowRemoteModels = false; env.allowLocalModels = true; env.localModelPath = new URL("../models/", import.meta.url).pathname; }
    else { env.allowLocalModels = false; env.allowRemoteModels = true; }
    if (!asr || loadedModel !== model) {
      asr = await pipeline("automatic-speech-recognition", model, {
        dtype: { encoder_model: "q8", decoder_model_merged: "q8" }, device: "wasm",
        progress_callback: p => { if (p.status === "progress" && p.total) self.postMessage({ type: "download", file: p.file, loaded: p.loaded, total: p.total }); }
      });
      loadedModel = model;
    }
    self.postMessage({ type: "stage", stage: "transcribe" });
    const out = await asr(audio, { language: "french", task: "transcribe", return_timestamps: "word", chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ type: "done", out });
  } catch (e) {
    self.postMessage({ type: "error", message: (e && e.message) || String(e) });
  }
};
