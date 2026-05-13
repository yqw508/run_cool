import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type PreviewMode = 'idle' | 'run';

export class ThreeTechPreview {
  private readonly host: HTMLDivElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private readonly clock = new THREE.Clock();
  private readonly loader = new GLTFLoader();
  private readonly rig = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();
  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly floorGlow: THREE.Mesh;
  private mixer?: THREE.AnimationMixer;
  private activeAction?: THREE.AnimationAction;
  private actions: Partial<Record<PreviewMode, THREE.AnimationAction>> = {};
  private modelLoaded = false;
  private mode: PreviewMode = 'idle';
  private frameId = 0;
  private disposed = false;

  constructor(parent: HTMLElement) {
    this.host = document.createElement('div');
    this.host.className = 'three-tech-preview';
    parent.appendChild(this.host);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.host.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 1.25, 5.2);
    this.camera.lookAt(0, 0.72, 0);
    this.scene.add(this.camera);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(2.4, 4.2, 3);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x86d7ff, 1.1);
    fillLight.position.set(-3, 1.8, 2);
    this.scene.add(fillLight);

    this.floorGlow = this.createFloorGlow();
    this.scene.add(this.floorGlow);
    this.buildPlaceholderRunner();
    this.scene.add(this.rig);
    void this.loadCharacter('/assets/models/tech-runner.gltf').catch(() => {
      this.modelLoaded = false;
    });
    this.resize();

    window.addEventListener('resize', this.resize);
    window.addEventListener('run-cool:screen', this.handleScreenEvent);
    this.host.classList.toggle('is-visible', document.body.dataset.runCoolScreen === 'character-lobby');
    this.animate();
  }

  async loadCharacter(url: string): Promise<void> {
    const gltf = await this.loader.loadAsync(url);
    this.rig.clear();
    this.mixer?.stopAllAction();
    this.rig.add(gltf.scene);
    this.rig.position.set(0, 0, 0);
    this.rig.rotation.y = -0.35;
    this.rig.scale.setScalar(1);
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    this.actions = {};
    gltf.animations.forEach((clip) => {
      if (clip.name === 'idle' || clip.name === 'run') {
        this.actions[clip.name] = this.mixer?.clipAction(clip);
      }
    });
    this.modelLoaded = true;
    this.mode = 'idle';
    this.setMode('idle');
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('run-cool:screen', this.handleScreenEvent);
    this.host.remove();
    this.renderer.dispose();
  }

  private readonly resize = (): void => {
    const width = Math.max(118, Math.round(this.host.clientWidth));
    const height = Math.max(154, Math.round(this.host.clientHeight));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly handleScreenEvent = (event: Event): void => {
    const detail = (event as CustomEvent<{ screen: string }>).detail;
    const show = detail?.screen === 'character-lobby';
    this.host.classList.toggle('is-visible', show);
  };

  private animate = (): void => {
    if (this.disposed) {
      return;
    }

    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;
    const modePhase = elapsed % 5.2;
    this.setMode(modePhase > 3.2 ? 'run' : 'idle');
    this.mixer?.update(delta);
    this.updateRig(elapsed);
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.animate);
  };

  private setMode(mode: PreviewMode): void {
    if (mode === this.mode && this.activeAction) {
      return;
    }

    this.mode = mode;
    const nextAction = this.actions[mode];
    if (!nextAction) {
      return;
    }

    nextAction.reset().fadeIn(0.18).play();
    if (this.activeAction && this.activeAction !== nextAction) {
      this.activeAction.fadeOut(0.18);
    }
    this.activeAction = nextAction;
  }

  private createFloorGlow(): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(1.05, 48);
    const material = new THREE.MeshBasicMaterial({ color: 0xffd447, transparent: true, opacity: 0.22 });
    const glow = new THREE.Mesh(geometry, material);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.03;
    return glow;
  }

  private buildPlaceholderRunner(): void {
    const skin = new THREE.MeshStandardMaterial({ color: 0xffc9a3, roughness: 0.72 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x302219, roughness: 0.88 });
    const outfit = new THREE.MeshStandardMaterial({ color: 0x4aa7ff, roughness: 0.58, metalness: 0.02 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xffd447, roughness: 0.45 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x263845, roughness: 0.76 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.72, 8, 18), outfit);
    torso.position.y = 1.04;
    this.body.add(torso);

    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.36, 0.04), accent);
    bib.position.set(0, 1.16, 0.36);
    this.body.add(bib);

    this.head.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 24), skin));
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.355, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
    hairCap.position.y = 0.08;
    this.head.add(hairCap);
    this.head.position.y = 1.7;
    this.body.add(this.head);

    this.addLimb(this.leftArm, skin, 0.53, 1.3, 0.18);
    this.addLimb(this.rightArm, skin, -0.53, 1.3, 0.18);
    this.addLimb(this.leftLeg, outfit, 0.22, 0.55, 0.22);
    this.addLimb(this.rightLeg, outfit, -0.22, 0.55, 0.22);

    this.addShoe(this.leftLeg, shoe);
    this.addShoe(this.rightLeg, shoe);
    this.rig.add(this.body);
    this.rig.position.y = -0.02;
    this.rig.rotation.y = -0.35;
  }

  private addLimb(group: THREE.Group, material: THREE.Material, x: number, y: number, radius: number): void {
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(radius, 0.52, 8, 14), material);
    limb.position.y = -0.28;
    group.add(limb);
    group.position.set(x, y, 0);
    this.body.add(group);
  }

  private addShoe(group: THREE.Group, material: THREE.Material): void {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.44), material);
    foot.position.set(0, -0.62, 0.1);
    group.add(foot);
  }

  private updateRig(elapsed: number): void {
    const breath = Math.sin(elapsed * 3.1);
    this.floorGlow.scale.setScalar(1 + breath * 0.035);
    this.floorGlow.position.y = -0.03 + Math.abs(Math.sin(elapsed * 10.5)) * (this.mode === 'run' ? 0.025 : 0);

    if (this.modelLoaded) {
      this.rig.position.y = this.mode === 'run' ? Math.abs(Math.sin(elapsed * 10.5)) * 0.04 : breath * 0.012;
      return;
    }

    if (this.mode === 'idle') {
      this.body.scale.set(1 + breath * 0.012, 1 + breath * 0.025, 1);
      this.body.position.y = breath * 0.018;
      this.head.rotation.z = Math.sin(elapsed * 1.8) * 0.045;
      this.leftArm.rotation.x = -0.25 + Math.sin(elapsed * 2.2) * 0.08;
      this.rightArm.rotation.x = 0.2 - Math.sin(elapsed * 2.2) * 0.08;
      this.leftLeg.rotation.x = 0.04;
      this.rightLeg.rotation.x = -0.04;
      return;
    }

    const stride = Math.sin(elapsed * 10.5);
    const counter = Math.cos(elapsed * 10.5);
    this.body.scale.set(1, 1.02 + Math.abs(stride) * 0.018, 1);
    this.body.position.y = Math.abs(stride) * 0.06;
    this.leftLeg.rotation.x = stride * 0.72;
    this.rightLeg.rotation.x = -stride * 0.72;
    this.leftArm.rotation.x = -stride * 0.62;
    this.rightArm.rotation.x = stride * 0.62;
    this.head.rotation.z = counter * 0.035;
  }
}
