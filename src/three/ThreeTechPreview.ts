import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type LobbyActor = {
  root: THREE.Group;
  mixer?: THREE.AnimationMixer;
  idle?: THREE.AnimationAction;
  run?: THREE.AnimationAction;
  baseScale: number;
  selectedScale: number;
  home: THREE.Vector3;
};

type ActorStyle = {
  skin: number;
  hair: number;
  outfit: number;
  accent: number;
  shoe: number;
  materialTone?: 'soft' | 'silky' | 'uniform';
};

const ACTOR_STYLES: ActorStyle[] = [
  { skin: 0xffc8a8, hair: 0x4a2b1b, outfit: 0xffffff, accent: 0xaee6ff, shoe: 0x86d7ff, materialTone: 'soft' },
  { skin: 0xffc39f, hair: 0x23170f, outfit: 0x2f80ed, accent: 0xffd447, shoe: 0xffffff },
  { skin: 0xffd6ba, hair: 0xf7f3d8, outfit: 0x9be7ff, accent: 0xffffff, shoe: 0x65c7f7, materialTone: 'silky' },
  { skin: 0xffc7a6, hair: 0x3b2418, outfit: 0xff87b7, accent: 0xffd1e1, shoe: 0xff5a76, materialTone: 'silky' },
  { skin: 0xffc29e, hair: 0x1f1a18, outfit: 0x264a8f, accent: 0xffd447, shoe: 0x17263a, materialTone: 'uniform' }
];

export class ThreeTechPreview {
  private readonly host: HTMLDivElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-2.2, 2.2, 3.05, -0.2, 0.1, 100);
  private readonly clock = new THREE.Clock();
  private readonly loader = new GLTFLoader();
  private readonly actors: LobbyActor[] = [];
  private readonly floorGlows: THREE.Mesh[] = [];
  private selectedIndex = Number(document.body.dataset.runCoolCharacterIndex ?? 0);
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

    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.camera);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.45));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(2.4, 4.2, 5);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x86d7ff, 0.95);
    fillLight.position.set(-3, 1.8, 4);
    this.scene.add(fillLight);

    void this.loadLobbyCharacters('/assets/models/tech-runner.gltf').catch(() => this.buildFallbackLobby());
    this.resize();

    window.addEventListener('resize', this.resize);
    window.addEventListener('run-cool:screen', this.handleScreenEvent);
    window.addEventListener('run-cool:lobby-selection', this.handleSelectionEvent);
    this.host.classList.toggle('is-visible', document.body.dataset.runCoolScreen === 'character-lobby');
    this.animate();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('run-cool:screen', this.handleScreenEvent);
    window.removeEventListener('run-cool:lobby-selection', this.handleSelectionEvent);
    this.host.remove();
    this.renderer.dispose();
  }

  private async loadLobbyCharacters(url: string): Promise<void> {
    const gltf = await this.loader.loadAsync(url);
    this.clearLobbyActors();

    this.getLobbyHomes().forEach((home, index) => {
      const root = gltf.scene.clone(true);
      const group = new THREE.Group();
      group.add(root);
      group.position.copy(home);
      group.rotation.y = -0.32 + (index - 2) * 0.08;
      group.scale.setScalar(this.getActorScale(index, false));
      this.styleActor(root, index);
      this.addActorAccessories(group, index);
      this.scene.add(group);

      const glow = this.createFloorGlow();
      glow.position.set(home.x, home.y - 0.02, -0.04);
      glow.scale.setScalar(index === this.selectedIndex ? 0.8 : 0.58);
      this.scene.add(glow);
      this.floorGlows.push(glow);

      const mixer = new THREE.AnimationMixer(root);
      const idleClip = gltf.animations.find((clip) => clip.name === 'idle');
      const runClip = gltf.animations.find((clip) => clip.name === 'run');
      const idle = idleClip ? mixer.clipAction(idleClip) : undefined;
      const run = runClip ? mixer.clipAction(runClip) : undefined;
      idle?.play();
      run?.play();
      if (run) {
        run.weight = 0;
      }

      this.actors.push({
        root: group,
        mixer,
        idle,
        run,
        baseScale: this.getActorScale(index, false),
        selectedScale: this.getActorScale(index, true),
        home
      });
    });

    this.applySelection();
  }

  private styleActor(root: THREE.Object3D, index: number): void {
    const style = ACTOR_STYLES[index] ?? ACTOR_STYLES[0];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      object.material = this.createActorMaterial(this.pickMeshColor(object, style), style);
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }

  private pickMeshColor(mesh: THREE.Mesh, style: ActorStyle): number {
    const meshName = mesh.name.toLowerCase();
    const materialName = Array.isArray(mesh.material) ? '' : mesh.material.name.toLowerCase();
    const name = `${meshName} ${materialName}`;

    if (name.includes('head') || name.includes('arm') || name.includes('skin')) {
      return style.skin;
    }
    if (name.includes('hair')) {
      return style.hair;
    }
    if (name.includes('bib') || name.includes('accent')) {
      return style.accent;
    }
    if (name.includes('shoe')) {
      return style.shoe;
    }
    return style.outfit;
  }

  private createActorMaterial(color: number, style: ActorStyle): THREE.MeshStandardMaterial {
    if (style.materialTone === 'silky') {
      return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.04 });
    }
    if (style.materialTone === 'uniform') {
      return new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.12 });
    }
    return new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
  }

  private addActorAccessories(group: THREE.Group, index: number): void {
    const style = ACTOR_STYLES[index] ?? ACTOR_STYLES[0];
    if (index === 0) {
      this.addBabyAccessories(group, style);
      return;
    }
    if (index === 1) {
      this.addStarGirlAccessories(group, style);
      return;
    }
    if (index === 2) {
      this.addIcePrincessAccessories(group, style);
      return;
    }
    if (index === 3) {
      this.addPuddingAccessories(group, style);
      return;
    }
    this.addCaptainAccessories(group, style);
  }

  private addBabyAccessories(group: THREE.Group, style: ActorStyle): void {
    const diaper = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.28, 0.18),
      this.createActorMaterial(0xffffff, style)
    );
    diaper.position.set(0, 0.68, 0.16);

    const pacifier = new THREE.Mesh(
      new THREE.CircleGeometry(0.09, 24),
      new THREE.MeshBasicMaterial({ color: 0x65c7f7 })
    );
    pacifier.position.set(0, 1.52, 0.36);

    const curl = new THREE.Mesh(
      new THREE.TorusGeometry(0.08, 0.018, 8, 24),
      this.createActorMaterial(style.hair, style)
    );
    curl.position.set(-0.06, 1.93, 0.08);
    curl.rotation.z = 0.35;

    group.add(diaper, pacifier, curl);
  }

  private addStarGirlAccessories(group: THREE.Group, style: ActorStyle): void {
    const star = new THREE.Mesh(
      new THREE.TetrahedronGeometry(0.13, 0),
      this.createActorMaterial(style.accent, style)
    );
    star.position.set(-0.2, 1.78, 0.22);
    star.rotation.set(0.3, 0.1, 0.78);

    const leftStrap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.58, 0.05), this.createActorMaterial(0x1f5ea8, style));
    leftStrap.position.set(-0.13, 1.13, 0.28);
    leftStrap.rotation.z = -0.12;
    const rightStrap = leftStrap.clone();
    rightStrap.position.x = 0.13;
    rightStrap.rotation.z = 0.12;

    const swingBoard = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 0.18), this.createActorMaterial(0xffd447, style));
    swingBoard.position.set(0, 0.48, -0.05);
    const ropeMaterial = this.createActorMaterial(0xffffff, style);
    const leftRope = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.2, 0.025), ropeMaterial);
    leftRope.position.set(-0.34, 1.08, -0.08);
    const rightRope = leftRope.clone();
    rightRope.position.x = 0.34;

    group.add(star, leftStrap, rightStrap, swingBoard, leftRope, rightRope);
  }

  private addIcePrincessAccessories(group: THREE.Group, style: ActorStyle): void {
    const crownMaterial = this.createActorMaterial(0xffffff, style);
    for (let i = 0; i < 3; i += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 4), crownMaterial);
      spike.position.set((i - 1) * 0.14, 1.95 + (i === 1 ? 0.04 : 0), 0.04);
      spike.rotation.y = Math.PI / 4;
      group.add(spike);
    }

    const cape = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 0.86, 4, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.72, roughness: 0.34 })
    );
    cape.position.set(0, 1.0, -0.18);
    cape.rotation.y = Math.PI / 4;

    const snow = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), this.createActorMaterial(0xffffff, style));
    snow.position.set(0.22, 1.38, 0.34);
    group.add(cape, snow);
  }

  private addPuddingAccessories(group: THREE.Group, style: ActorStyle): void {
    const skirt = new THREE.Mesh(
      new THREE.ConeGeometry(0.52, 0.42, 24, 1, true),
      this.createActorMaterial(style.outfit, style)
    );
    skirt.position.set(0, 0.8, 0);
    skirt.rotation.y = Math.PI;

    const bowLeft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 3), this.createActorMaterial(style.accent, style));
    bowLeft.position.set(-0.13, 1.82, 0.2);
    bowLeft.rotation.set(0, 0, -Math.PI / 2);
    const bowRight = bowLeft.clone();
    bowRight.position.x = 0.13;
    bowRight.rotation.z = Math.PI / 2;

    const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), this.createActorMaterial(0xffd447, style));
    pendant.position.set(0, 1.28, 0.34);
    group.add(skirt, bowLeft, bowRight, pendant);
  }

  private addCaptainAccessories(group: THREE.Group, style: ActorStyle): void {
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 24), this.createActorMaterial(style.outfit, style));
    capTop.position.set(0, 1.88, 0.02);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.055, 0.2), this.createActorMaterial(0x17263a, style));
    visor.position.set(0, 1.81, 0.2);

    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), this.createActorMaterial(style.accent, style));
    badge.position.set(0, 1.26, 0.35);
    badge.rotation.z = Math.PI / 4;

    const wingMaterial = this.createActorMaterial(0xf1f6ff, style);
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.04), wingMaterial);
    leftWing.position.set(-0.18, 1.18, 0.34);
    leftWing.rotation.z = -0.2;
    const rightWing = leftWing.clone();
    rightWing.position.x = 0.18;
    rightWing.rotation.z = 0.2;

    group.add(capTop, visor, badge, leftWing, rightWing);
  }

  private buildFallbackLobby(): void {
    this.clearLobbyActors();
    const material = new THREE.MeshStandardMaterial({ color: 0x4aa7ff, roughness: 0.64 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xffc9a3, roughness: 0.72 });
    this.getLobbyHomes().forEach((home, index) => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.82, 0.22), material);
      body.position.y = 0.8;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.32), skin);
      head.position.y = 1.4;
      group.add(body, head);
      group.position.copy(home);
      group.scale.setScalar(this.getActorScale(index, false));
      this.scene.add(group);
      this.actors.push({ root: group, baseScale: this.getActorScale(index, false), selectedScale: this.getActorScale(index, true), home });
    });
    this.applySelection();
  }

  private clearLobbyActors(): void {
    this.actors.forEach((actor) => {
      actor.mixer?.stopAllAction();
      actor.root.removeFromParent();
    });
    this.floorGlows.forEach((glow) => glow.removeFromParent());
    this.actors.length = 0;
    this.floorGlows.length = 0;
  }

  private readonly resize = (): void => {
    const width = Math.max(260, Math.round(this.host.clientWidth));
    const height = Math.max(300, Math.round(this.host.clientHeight));
    const aspect = width / height;
    this.camera.left = -2.2 * aspect;
    this.camera.right = 2.2 * aspect;
    this.camera.top = 3.05;
    this.camera.bottom = -0.2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly handleScreenEvent = (event: Event): void => {
    const detail = (event as CustomEvent<{ screen: string }>).detail;
    const show = detail?.screen === 'character-lobby';
    this.host.classList.toggle('is-visible', show);
  };

  private readonly handleSelectionEvent = (event: Event): void => {
    const detail = (event as CustomEvent<{ index: number }>).detail;
    this.selectedIndex = detail?.index ?? Number(document.body.dataset.runCoolCharacterIndex ?? 0);
    this.applySelection();
  };

  private animate = (): void => {
    if (this.disposed) {
      return;
    }

    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;
    this.actors.forEach((actor, index) => {
      actor.mixer?.update(delta);
      const selected = index === this.selectedIndex;
      const targetScale = selected ? actor.selectedScale : actor.baseScale;
      const breath = Math.sin(elapsed * (selected ? 3.8 : 2.1) + index * 0.72);
      const bob = Math.sin(elapsed * (selected ? 5.8 : 2.4) + index) * (selected ? 0.035 : 0.018);
      actor.root.position.y = actor.home.y + bob;
      actor.root.rotation.y = -0.32 + (index - 2) * 0.08 + Math.sin(elapsed * 1.2 + index) * 0.04;
      actor.root.rotation.z = this.getActorSway(index, selected, elapsed);
      actor.root.scale.set(targetScale * (1 + breath * 0.012), targetScale * (1 + breath * 0.026), targetScale);
    });
    this.floorGlows.forEach((glow, index) => {
      const selected = index === this.selectedIndex;
      glow.scale.setScalar((selected ? 0.82 : 0.58) + Math.sin(elapsed * 3.2 + index) * 0.025);
    });
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.animate);
  };

  private applySelection(): void {
    this.actors.forEach((actor, index) => {
      const selected = index === this.selectedIndex;
      actor.root.scale.setScalar(selected ? actor.selectedScale : actor.baseScale);
      actor.idle?.setEffectiveWeight(selected ? 0.25 : 1);
      actor.run?.setEffectiveWeight(selected ? 1 : 0);
    });
  }

  private getActorSway(index: number, selected: boolean, elapsed: number): number {
    const strength = selected ? 1.2 : 0.75;
    if (index === 0) {
      return Math.sin(elapsed * 2.4) * 0.045 * strength;
    }
    if (index === 1) {
      return Math.sin(elapsed * 1.5) * 0.08 * strength;
    }
    if (index === 2) {
      return Math.sin(elapsed * 1.25) * 0.035 * strength;
    }
    if (index === 3) {
      return Math.sin(elapsed * 1.8) * 0.05 * strength;
    }
    return Math.sin(elapsed * 1.65) * 0.032 * strength;
  }

  private createFloorGlow(): THREE.Mesh {
    const geometry = new THREE.CircleGeometry(0.58, 40);
    const material = new THREE.MeshBasicMaterial({ color: 0xffd447, transparent: true, opacity: 0.18 });
    return new THREE.Mesh(geometry, material);
  }

  private getLobbyHomes(): THREE.Vector3[] {
    return [
      new THREE.Vector3(-1.16, 0.56, 0),
      new THREE.Vector3(-0.72, 1.12, 0),
      new THREE.Vector3(0, 1.4, 0),
      new THREE.Vector3(0.72, 1.1, 0),
      new THREE.Vector3(1.16, 0.56, 0)
    ];
  }

  private getActorScale(index: number, selected: boolean): number {
    const base = [0.32, 0.26, 0.31, 0.26, 0.32][index] ?? 0.28;
    return selected ? base * 1.14 : base;
  }
}
