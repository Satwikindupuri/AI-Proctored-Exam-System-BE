import * as faceDetection from "@tensorflow-models/face-detection";
import "@tensorflow/tfjs";

let detector = null;

export async function loadFaceDetector() {
  if (detector) return detector;

  detector = await faceDetection.createDetector(
    faceDetection.SupportedModels.MediaPipeFaceDetector,
    {
      runtime: "tfjs",
      modelType: "short", // fast & accurate
      maxFaces: 5
    }
  );

  return detector;
}

export async function detectFaces(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return [];

  const model = await loadFaceDetector();
  const faces = await model.estimateFaces(videoEl, {
    flipHorizontal: false
  });

  return faces;
}
