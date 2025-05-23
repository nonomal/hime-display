import { ModelManager3D } from "./ModelManager3D";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OutlineEffect } from "three/examples/jsm/effects/OutlineEffect.js";
import { MouseFocusHelper } from "@display/utils/3d/MouseFocusHelper.js";
import { buildNodeInfoTreeAndList } from "@display/utils/3d/NodeInfo";
import { TransformMonitor } from "@display/utils/3d/Monitor";
import { MorphMonitor } from "@display/utils/vroid/Monitor";
import { VRoidFaceMeshCaptureManager as FaceMeshCaptureManager } from "@display/utils/capture/VRoidFaceMeshCaptureManager";
import { VRoidHolisticCaptureManager as HolisticCaptureManager } from "@display/utils/capture/VRoidHolisticCaptureManager";
import {
  VRMHumanBoneName,
  VRMExpressionPresetName,
  VRMLoaderPlugin,
} from "@pixiv/three-vrm";

// 用于转头……VRM使用的坐标系和THREE是反的，不转的话模型永远是后脑勺对着你
const turnHeadQuaternion = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0, Math.PI, 0)
);
export class VroidManager extends ModelManager3D {
  constructor(parentApp) {
    super(parentApp);
    this._initObjects();
  }
  switchIn() {
    this.clock = new THREE.Clock();
    this.ModelLoader = new GLTFLoader();
    this.ModelLoader.register((parser) => new VRMLoaderPlugin(parser));
    this.transformMonitor = new TransformMonitor();
    this.morphMonitor = new MorphMonitor();
    // scene
    this.scene = new THREE.Scene();
    this._addLight();
    //camera
    this.camera = new THREE.PerspectiveCamera(
      30,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(0.0, 1.0, 5.0);
    this.scene.add(this.camera);
    //renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.antialias,
      aplpha: true,
      canvas: document.getElementById("display-canvas"),
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(this.resolution);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    //effect
    this.effect = new OutlineEffect(this.renderer);
    this.effect.enabled = this.config.display["vroid-outline-effect"];
    this.config.display["vroid-orbit-controls"] && this._initOrbitControls();
    this._addEventListeners();
  }
  _addLight() {
    const directionalLight = new THREE.DirectionalLight(0xffffff, Math.PI);
    directionalLight.position.set(1.0, 1.0, 1.0).normalize();
    this.scene.add(directionalLight);
  }
  loadModel(modelInfo) {
    return new Promise((resolve, reject) => {
      this._initInstantConfig();
      const modelFile = modelInfo.entranceFile;
      this.ModelLoader.load(modelFile, (gltf) => {
        const vrm = gltf.userData.vrm;
        console.log("[Hime Display] VRM Loaded");
        this._clearModel();
        this.model = vrm.scene;
        // 为了保证3D控制的通用性，将顶部的vrm对象挂载到了内部的模型上
        this.model.vrm = vrm;
        // VRM1.0新机制，默认使用代理骨骼(Normalized Human Bones)控制模型，这里是开关
        // https://github.com/pixiv/three-vrm/blob/dev/guides/migration-guide-1.0.md#normalized-human-bones
        // this.model.vrm.humanoid.autoUpdateHumanBones = false;
        // 手动添加一个模型复位函数
        this.model.pose = function () {
          this.vrm.humanoid.resetNormalizedPose();
        };
        // 模型绕Y轴旋转180度
        this.model.rotateY(Math.PI);
        this.scene.add(this.model);
        if (!this.shouldRender) {
          this.shouldRender = true;
          this._render();
        }
        this._initMouceFocusHelper();
        resolve(this._buildModelControlInfo(modelInfo));
      });
    });
  }
  _initInstantConfig() {
    const manager = this;
    // 由于没有存数据库，这就要求这里的初始配置和控制面板那边的默认值保持一致
    this.instantConfig = {
      vrmUpdate: true,
      _trackMouse: true,
      get trackMouse() {
        return this._trackMouse;
      },
      set trackMouse(value) {
        this._trackMouse = value;
        if (!value) {
          manager.mouseFocusHelper.object.rotation.set(0, 0, 0);
        }
      },
    };
  }
  _initMouceFocusHelper() {
    this.mouseFocusHelper = new MouseFocusHelper(
      this.model.vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.Head),
      // this.model.vrm.humanoid.getBoneNode(VRMHumanBoneName.Head),
      this.camera
    );
  }
  _buildModelControlInfo(modelInfo) {
    const modelControlInfo = {
      description: [
        { label: "name", value: modelInfo.name },
        { label: "extension-name", value: modelInfo.extensionName },
        { label: "model-version", value: this.model.vrm.meta.version },
        { label: "author", value: this.model.vrm.meta.author },
        {
          label: "sexual-ussage-name",
          value: this.model.vrm.meta.sexualUssageName,
        },
        {
          label: "violent-ussage-name",
          value: this.model.vrm.meta.violentUssageName,
        },
      ],
      morph: Object.values(VRMExpressionPresetName),
      // 必须在添加上模型后再构建信息
      transform: buildNodeInfoTreeAndList(this.scene),
    };
    return modelControlInfo;
  }
  _updateObjects() {
    if (this.stats !== null) {
      this.stats.begin();
      this.stats.end();
    }
    if (this._sendToModelControl !== null) {
      if (this.transformMonitor.checkUpdate()) {
        this._sendToModelControl({
          channel: "manager:update-node-transform",
          data: this.transformMonitor.transform,
        });
      }
      if (this.morphMonitor.checkUpdate()) {
        this._sendToModelControl({
          channel: "manager:update-node-morph",
          data: {
            weight: this.morphMonitor.value,
          },
        });
      }
    }
    // 播放动画的时候模型还盯着鼠标看，转身都不带扭头的那效果……我实在是看不下去了
    if (
      this.instantConfig?.trackMouse &&
      this.animationManager === null &&
      this.captureManagerNow === null
    ) {
      this.mouseFocusHelper?.focus();
      // 解决VRoid的Y轴反转问题
      this.mouseFocusHelper?.object.quaternion.multiply(turnHeadQuaternion);
    }
    if (this.instantConfig.vrmUpdate) {
      // 此项更新一个是物理模拟，另一个是morph
      this.model.vrm.update(this.clock.getDelta());
    }
  }
  handleMessage(message) {
    switch (message.channel) {
      case "control:bind-node-transform": {
        this._bindNodeTransform(message.data.nodeId);
        break;
      }
      case "control:set-node-transform": {
        this._setNodeTransform(message.data);
        break;
      }
      case "control:launch-capture": {
        const { type } = message.data;
        if (type === "faceMesh") {
          this.captureManagerNow = new FaceMeshCaptureManager();
        } else if (type === "holistic") {
          this.captureManagerNow = new HolisticCaptureManager();
        }
        this.captureManagerNow.setTarget(this.model);
        this.captureManagerNow.start();
        break;
      }
      case "control:quit-capture": {
        this._quitCapture();
        this.model.pose();
        break;
      }
      case "control:bind-morph-target": {
        const { morphName } = message.data;
        this.morphMonitor.bind(morphName, this.model);
        break;
      }
      case "control:set-morph-weight": {
        this._setMorphWeight(message.data);
        break;
      }
      case "control:change-instant-config": {
        const { name, value } = message.data;
        this.instantConfig[name] = value;
        break;
      }
    }
  }
  _setMorphWeight({ morphName, weight }) {
    this.model.vrm.expressionManager.setValue(morphName, weight);
  }
  // 不使用箭头函数会导致this的指向出错，若使用bind更改this指向，会导致返回的function和原函数不同，无法移出事件监听器
  _onPointerMove = (event) => {
    // 加上?，防止没载入模型时出错
    this.mouseFocusHelper?.update(event.clientX, event.clientY);
  };
}
