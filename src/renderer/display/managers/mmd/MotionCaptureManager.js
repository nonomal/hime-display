import { Face } from "kalidokit";
import * as faceMeshRoot from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors } from "@mediapipe/drawing_utils ";
// 虽然在node_modules中有训练好的数据，然而我根本不知道应该如何写路径引入，于是先复制粘贴了一份到项目目录下
const solutionPath = "./lib/@mediapipe/face_mesh/";
export class MotionCaptureManager {
  constructor() {
    this.mdoel = null;
    this.onRiggedFaceCallback = null;
  }
  createVideo() {
    this.videoContainer = document.createElement("div");
    this.videoContainer.classList.add("capture__container");
    this.video = document.createElement("video");
    this.videoContainer.appendChild(this.video);
    this.video.classList.add("capture__video");
    this.canvas = document.createElement("canvas");
    this.canvasCtx = this.canvas.getContext("2d");
    this.videoContainer.appendChild(this.canvas);
    this.canvas.classList.add("capture__canvas");
    document.body.appendChild(this.videoContainer);
  }
  start(model = null) {
    this.model = model;
    this.createVideo();
    this.faceMesh = new faceMeshRoot.FaceMesh({
      locateFile: (file) => {
        return `${solutionPath}${file}`;
      },
    });
    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    this.faceMesh.onResults(this.onResults.bind(this));

    this.camera = new Camera(this.video, {
      onFrame: async () => {
        await this.faceMesh.send({ image: this.video });
      },
      width: 640,
      height: 480,
    });
    this.camera.start();
  }
  animationModel(results) {
    if (results.multiFaceLandmarks.length < 1) {
      return;
    }
    const riggedFace = Face.solve(results.multiFaceLandmarks[0], {
      runtime: "mediapipe",
      video: this.video,
    });
    if (this.onRiggedFaceCallback !== null) {
      this.onRiggedFaceCallback(riggedFace);
    }
    if (this.model !== null) {
      this.rigFace(riggedFace);
    }
  }
  rigFace(riggedFace) {
    this.setMorphTargetByName("ウィンク２", 1 - riggedFace.eye.l);
    this.setMorphTargetByName("ウィンク２右", 1 - riggedFace.eye.r);
    this.setMorphTargetByName("あ", riggedFace.mouth.shape.A);
    this.setMorphTargetByName("い", riggedFace.mouth.shape.I);
    this.setMorphTargetByName("う", riggedFace.mouth.shape.U);
    this.setMorphTargetByName("え", riggedFace.mouth.shape.E);
    this.setMorphTargetByName("お", riggedFace.mouth.shape.O);
    const atama = this.model.skeleton.bones.find((b) => b.name === "頭");
    atama.rotation.set(
      -riggedFace.head.x,
      riggedFace.head.y,
      -riggedFace.head.z
    );
  }
  setMorphTargetByName(name, value) {
    const morphTargetIndex = this.model.morphTargetDictionary[name];
    if (morphTargetIndex === undefined) {
      console.warn(
        `MotionCaptureManager: morph target ${name} not found in the skinned mesh`
      );
    } else {
      this.model.morphTargetInfluences[morphTargetIndex] = value;
    }
  }
  drawResults(results) {
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvasCtx.drawImage(
      results.image,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    if (results.multiFaceLandmarks) {
      for (const landmarks of results.multiFaceLandmarks) {
        drawConnectors(
          this.canvasCtx,
          landmarks,
          faceMeshRoot.FACEMESH_TESSELATION,
          { color: "#C0C0C070", lineWidth: 1 }
        );
        drawConnectors(
          this.canvasCtx,
          landmarks,
          faceMeshRoot.FACEMESH_RIGHT_EYE,
          { color: "#FF3030", lineWidth: 1 }
        );
        drawConnectors(
          this.canvasCtx,
          landmarks,
          faceMeshRoot.FACEMESH_RIGHT_EYEBROW,
          { color: "#FF3030", lineWidth: 1 }
        );
        drawConnectors(
          this.canvasCtx,
          landmarks,
          faceMeshRoot.FACEMESH_LEFT_EYE,
          { color: "#30FF30", lineWidth: 1 }
        );
        drawConnectors(
          this.canvasCtx,
          landmarks,
          faceMeshRoot.FACEMESH_LEFT_EYEBROW,
          { color: "#30FF30", lineWidth: 1 }
        );
        drawConnectors(
          this.canvasCtx,
          landmarks,
          faceMeshRoot.FACEMESH_FACE_OVAL,
          { color: "#E0E0E0", lineWidth: 1 }
        );
        drawConnectors(this.canvasCtx, landmarks, faceMeshRoot.FACEMESH_LIPS, {
          color: "#E0E0E0",
          lineWidth: 1,
        });
        // if (solutionOptions.refineLandmarks) {
        drawConnectors(
          this.canvasCtx,
          landmarks,
          faceMeshRoot.FACEMESH_RIGHT_IRIS,
          { color: "#FF3030", lineWidth: 1 }
        );
        drawConnectors(
          this.canvasCtx,
          landmarks,
          faceMeshRoot.FACEMESH_LEFT_IRIS,
          { color: "#30FF30", lineWidth: 1 }
        );
        // }
      }
    }
    this.canvasCtx.restore();
  }
  onResults(results) {
    this.drawResults(results);
    this.animationModel(results);
  }
  onRiggedFace(callback) {
    this.onRiggedFaceCallback = callback;
  }
}