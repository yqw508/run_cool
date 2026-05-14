import * as THREE from 'three';

type RunnerPose = 'run' | 'jump' | 'slide';

type CharacterRig = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
};

type LobbyActor = {
  rig: CharacterRig;
  baseScale: number;
  selectedScale: number;
  home: THREE.Vector3;
};

type RunnerState = {
  rig: CharacterRig;
  lane: number;
  targetLane: number;
  pose: RunnerPose;
  poseStartedAt: number;
};

type ActorStyle = {
  skin: number;
  hair: number;
  outfit: number;
  accent: number;
  shoe: number;
  blush: number;
  materialTone?: 'soft' | 'silky' | 'uniform';
};

const ACTOR_STYLES: ActorStyle[] = [
  { skin: 0xffc8a8, hair: 0xd8e6df, outfit: 0xddeee8, accent: 0x384553, shoe: 0xffffff, blush: 0xff9f9f, materialTone: 'soft' },
  { skin: 0xffc39f, hair: 0x15110f, outfit: 0xffffff, accent: 0x4ca3ee, shoe: 0xbec4c8, blush: 0xff9292 },
  { skin: 0xffd6ba, hair: 0xf7f3d8, outfit: 0x9be7ff, accent: 0xffffff, shoe: 0x65c7f7, blush: 0xffa4bd, materialTone: 'silky' },
  { skin: 0xffc7a6, hair: 0xff8fb3, outfit: 0xff87b7, accent: 0xffd447, shoe: 0x9c4b32, blush: 0xff8ca8, materialTone: 'silky' },
  { skin: 0xffc29e, hair: 0x1f1a18, outfit: 0x264a8f, accent: 0xffd447, shoe: 0x17263a, blush: 0xff918f, materialTone: 'uniform' }
];

export class ThreeTechPreview {
  private readonly host: HTMLDivElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-2.2, 2.2, 3.05, -0.2, 0.1, 100);
  private readonly clock = new THREE.Clock();
  private readonly environment = new THREE.Group();
  private readonly actors: LobbyActor[] = [];
  private readonly floorGlows: THREE.Mesh[] = [];
  private readonly runRoadDashes: THREE.Mesh[] = [];
  private readonly runSpeedMarks: THREE.Mesh[] = [];
  private runner?: RunnerState;
  private currentScreen = document.body.dataset.runCoolScreen ?? 'character-lobby';
  private activeEnvironment = '';
  private runnerGameState = 'setup';
  private runnerRenderMode = 'three-3d';
  private selectedIndex = Number(document.body.dataset.runCoolCharacterIndex ?? 0);
  private frameId = 0;
  private disposed = false;

  constructor(parent: HTMLElement) {
    this.host = document.createElement('div');
    this.host.className = 'three-tech-preview';
    parent.appendChild(this.host);

    this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
    this.renderer.setClearColor(0xbfefff, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.host.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.camera);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.55));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.25);
    keyLight.position.set(2.4, 4.2, 5);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x86d7ff, 1);
    fillLight.position.set(-3, 1.8, 4);
    this.scene.add(fillLight);
    this.scene.add(this.environment);

    this.buildLobbyCharacters();
    this.buildRunnerCharacter();
    this.resize();

    window.addEventListener('resize', this.resize);
    window.addEventListener('run-cool:screen', this.handleScreenEvent);
    window.addEventListener('run-cool:lobby-selection', this.handleSelectionEvent);
    window.addEventListener('run-cool:runner-state', this.handleRunnerStateEvent);
    this.applyScreenVisibility();
    this.animate();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('run-cool:screen', this.handleScreenEvent);
    window.removeEventListener('run-cool:lobby-selection', this.handleSelectionEvent);
    window.removeEventListener('run-cool:runner-state', this.handleRunnerStateEvent);
    this.host.remove();
    this.renderer.dispose();
  }

  private buildLobbyCharacters(): void {
    this.clearLobbyActors();

    this.getLobbyHomes().forEach((home, index) => {
      const rig = this.createCharacterRig(index);
      rig.root.position.copy(home);
      rig.root.rotation.y = -0.28 + (index - 2) * 0.08;
      rig.root.scale.setScalar(this.getActorScale(index, false));
      this.scene.add(rig.root);

      const glow = this.createFloorGlow();
      glow.position.set(home.x, home.y - 0.02, -0.04);
      glow.scale.setScalar(index === this.selectedIndex ? 0.8 : 0.58);
      this.scene.add(glow);
      this.floorGlows.push(glow);

      this.actors.push({
        rig,
        baseScale: this.getActorScale(index, false),
        selectedScale: this.getActorScale(index, true),
        home
      });
    });

    this.applySelection();
  }

  private buildRunnerCharacter(): void {
    this.runner?.rig.root.removeFromParent();

    const rig = this.createCharacterRig(this.selectedIndex);
    rig.root.position.set(this.getRunnerLaneX(1), 0.18, 0.02);
    rig.root.rotation.y = 0.08;
    rig.root.scale.setScalar(this.getRunnerScale(this.selectedIndex));
    rig.root.visible = false;
    this.scene.add(rig.root);

    this.runner = {
      rig,
      lane: 1,
      targetLane: 1,
      pose: 'run',
      poseStartedAt: this.clock.elapsedTime
    };
  }

  private createCharacterRig(index: number): CharacterRig {
    const style = ACTOR_STYLES[index] ?? ACTOR_STYLES[0];
    const root = new THREE.Group();
    const body = new THREE.Group();
    const head = new THREE.Group();
    const leftArm = new THREE.Group();
    const rightArm = new THREE.Group();
    const leftLeg = new THREE.Group();
    const rightLeg = new THREE.Group();

    const bodyMaterial = this.createActorMaterial(style.outfit, style);
    const skinMaterial = this.createActorMaterial(style.skin, style);
    const hairMaterial = this.createActorMaterial(style.hair, style);
    const shoeMaterial = this.createActorMaterial(style.shoe, style);

    const torsoRadius = index === 0 ? 0.31 : index === 4 ? 0.27 : 0.28;
    const torsoLength = index === 0 ? 0.34 : index === 3 ? 0.38 : 0.44;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(torsoRadius, torsoLength, 12, 24), bodyMaterial);
    torso.position.y = index === 0 ? 0.82 : 0.9;
    body.add(torso);

    const headRadius = index === 0 ? 0.36 : index === 2 ? 0.31 : 0.32;
    head.add(new THREE.Mesh(new THREE.SphereGeometry(headRadius, 32, 24), skinMaterial));
    head.position.y = index === 0 ? 1.36 : 1.48;
    body.add(head);

    this.addFace(head, style);
    this.addHair(head, index, hairMaterial);
    this.addLimb(body, leftArm, skinMaterial, -0.34, index === 0 ? 0.96 : 1.05, index === 0 ? 0.1 : 0.09, index === 0 ? 0.28 : 0.36);
    this.addLimb(body, rightArm, skinMaterial, 0.34, index === 0 ? 0.96 : 1.05, index === 0 ? 0.1 : 0.09, index === 0 ? 0.28 : 0.36);
    this.addLimb(body, leftLeg, bodyMaterial, -0.14, index === 0 ? 0.5 : 0.48, 0.1, index === 0 ? 0.28 : 0.42);
    this.addLimb(body, rightLeg, bodyMaterial, 0.14, index === 0 ? 0.5 : 0.48, 0.1, index === 0 ? 0.28 : 0.42);
    this.addShoe(leftLeg, shoeMaterial);
    this.addShoe(rightLeg, shoeMaterial);

    if (index === 0) {
      body.scale.set(1.05, 0.92, 1);
      body.rotation.x = -0.08;
    }

    root.add(body);
    this.addCharacterCostume(root, body, index, style);
    return { root, body, head, leftArm, rightArm, leftLeg, rightLeg };
  }

  private addFace(head: THREE.Group, style: ActorStyle): void {
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x182231 });
    const blushMaterial = new THREE.MeshBasicMaterial({ color: style.blush, transparent: true, opacity: 0.7 });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), eyeMaterial);
    leftEye.position.set(-0.1, 0.03, 0.3);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.1;
    const leftBlush = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), blushMaterial);
    leftBlush.position.set(-0.17, -0.06, 0.28);
    leftBlush.scale.set(1.25, 0.55, 0.18);
    const rightBlush = leftBlush.clone();
    rightBlush.position.x = 0.17;
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.006, 6, 20, Math.PI), new THREE.MeshBasicMaterial({ color: 0x8d4a35 }));
    smile.position.set(0, -0.08, 0.305);
    smile.rotation.z = Math.PI;
    head.add(leftEye, rightEye, leftBlush, rightBlush, smile);
  }

  private addHair(head: THREE.Group, index: number, material: THREE.Material): void {
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.326, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), material);
    hairCap.position.y = 0.08;
    head.add(hairCap);

    if (index === 1) {
      const sideLeft = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), material);
      sideLeft.position.set(-0.27, -0.02, 0.03);
      sideLeft.scale.set(0.72, 1.28, 0.6);
      const sideRight = sideLeft.clone();
      sideRight.position.x = 0.27;
      for (let i = 0; i < 5; i += 1) {
        const bang = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), material);
        bang.position.set(-0.16 + i * 0.08, -0.02, 0.27);
        bang.scale.set(0.9, 1.2, 0.42);
        head.add(bang);
      }
      const roundedFringe = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.42, 7, 10), material);
      roundedFringe.position.set(0, 0.03, 0.29);
      roundedFringe.rotation.z = Math.PI / 2;
      head.add(sideLeft, sideRight, roundedFringe);
      return;
    }

    if (index === 2) {
      const braid = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.45, 8, 14), material);
      braid.position.set(0.28, -0.2, -0.02);
      braid.rotation.z = -0.35;
      const braidTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), material);
      braidTip.position.set(0.36, -0.44, 0.01);
      const wave = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 24, Math.PI), material);
      wave.position.set(-0.04, 0.23, 0.13);
      wave.rotation.z = Math.PI;
      head.add(braid, braidTip, wave);
      return;
    }

    if (index === 3) {
      const braidMaterial = this.createActorMaterial(0xff9fbe, ACTOR_STYLES[3]);
      [-0.28, 0.28].forEach((x, side) => {
        const braid = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.46, 8, 14), braidMaterial);
        braid.position.set(x, -0.23, 0.05);
        braid.rotation.z = side === 0 ? 0.22 : -0.22;
        const tie = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), this.createActorMaterial(0x8fdc72, ACTOR_STYLES[3]));
        tie.position.set(x + (side === 0 ? -0.04 : 0.04), -0.48, 0.08);
        head.add(braid, tie);
      });
      return;
    }

    if (index === 0) {
      const hoodBand = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.58, 8, 14), this.createActorMaterial(0xc9d8d2, ACTOR_STYLES[0]));
      hoodBand.position.set(0, 0.19, 0.13);
      hoodBand.rotation.z = Math.PI / 2;
      const chinTie = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.26, 5, 8), this.createActorMaterial(0xc9d8d2, ACTOR_STYLES[0]));
      chinTie.position.set(0.08, -0.34, 0.24);
      chinTie.rotation.z = -0.35;
      head.add(hoodBand, chinTie);
    }
  }

  private addLimb(
    body: THREE.Group,
    limb: THREE.Group,
    material: THREE.Material,
    x: number,
    y: number,
    radius: number,
    length: number
  ): void {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 10, 16), material);
    mesh.position.y = -length / 2;
    limb.add(mesh);
    limb.position.set(x, y, 0.02);
    body.add(limb);
  }

  private addShoe(leg: THREE.Group, material: THREE.Material): void {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), material);
    shoe.position.set(0, -0.5, 0.06);
    shoe.scale.set(1.35, 0.45, 1.1);
    leg.add(shoe);
  }

  private addCharacterCostume(root: THREE.Group, body: THREE.Group, index: number, style: ActorStyle): void {
    if (index === 0) {
      const vestMaterial = this.createActorMaterial(0xd7c99a, style);
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.12), vestMaterial);
      vest.position.set(0, 0.89, 0.25);
      vest.scale.set(1, 1, 0.72);
      const zipper = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.43, 4, 8), this.createActorMaterial(0xffffff, style));
      zipper.position.set(0, 0.89, 0.33);
      const diaper = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 14), this.createActorMaterial(0xffffff, style));
      diaper.position.set(0, 0.58, 0.02);
      diaper.scale.set(1.25, 0.55, 0.8);
      const goggleFrame = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.018, 8, 22), this.createActorMaterial(0xf0f1ee, style));
      goggleFrame.position.set(-0.11, 1.68, 0.25);
      goggleFrame.scale.set(1.18, 0.78, 0.2);
      const goggleRight = goggleFrame.clone();
      goggleRight.position.x = 0.11;
      const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.08, 4, 8), this.createActorMaterial(0x444d55, style));
      bridge.position.set(0, 1.68, 0.26);
      bridge.rotation.z = Math.PI / 2;
      const lensMaterial = new THREE.MeshBasicMaterial({ color: 0x2f3e4c, transparent: true, opacity: 0.58 });
      const lensLeft = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10), lensMaterial);
      lensLeft.position.set(-0.11, 1.68, 0.26);
      lensLeft.scale.set(1.25, 0.72, 0.12);
      const lensRight = lensLeft.clone();
      lensRight.position.x = 0.11;
      const pacifier = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 18), new THREE.MeshBasicMaterial({ color: 0x65c7f7 }));
      pacifier.position.set(0, 1.43, 0.31);
      body.add(vest, zipper, diaper, goggleFrame, goggleRight, bridge, lensLeft, lensRight, pacifier);
      return;
    }

    if (index === 1) {
      const strapMaterial = this.createActorMaterial(0x1f5ea8, style);
      const bib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.08), strapMaterial);
      bib.position.set(0, 0.92, 0.31);
      const leftPocket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.06), this.createActorMaterial(0x66b7f4, style));
      leftPocket.position.set(-0.08, 0.78, 0.35);
      const rightPocket = leftPocket.clone();
      rightPocket.position.x = 0.08;
      const leftStrap = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.42, 6, 10), strapMaterial);
      leftStrap.position.set(-0.11, 1.02, 0.27);
      leftStrap.rotation.z = -0.12;
      const rightStrap = leftStrap.clone();
      rightStrap.position.x = 0.11;
      rightStrap.rotation.z = 0.12;
      const catPrint = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10), this.createActorMaterial(0x79c9f3, style));
      catPrint.position.set(0, 1.12, 0.32);
      catPrint.scale.set(1.35, 0.8, 0.18);
      const star = new THREE.Mesh(new THREE.TetrahedronGeometry(0.055, 0), this.createActorMaterial(0xffd447, style));
      star.position.set(0.12, 1.13, 0.36);
      star.rotation.set(0.3, 0.2, 0.8);
      body.add(bib, leftPocket, rightPocket, leftStrap, rightStrap, catPrint, star);
      this.addSwingProp(root, style);
      return;
    }

    if (index === 2) {
      this.addSkirt(body, 0x9be7ff, style, 0.45, 0.46);
      const bodice = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.08), this.createActorMaterial(0x7fd8ff, style));
      bodice.position.set(0, 1.02, 0.31);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), this.createActorMaterial(0x2fb9ff, style));
      gem.position.set(0, 1.16, 0.37);
      const cape = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 0.78, 18, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.62, roughness: 0.34 })
      );
      cape.position.set(0, 0.83, -0.18);
      cape.rotation.y = Math.PI / 18;
      const snowflake = this.createSnowflake(0.15);
      snowflake.position.set(0.18, 0.83, 0.34);
      body.add(bodice, gem, cape, snowflake);
      this.addCrown(body, style);
      return;
    }

    if (index === 3) {
      this.addSkirt(body, style.outfit, style, 0.48, 0.42);
      this.addPuddingHat(body, style);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 24, Math.PI), this.createActorMaterial(0x8fdc72, style));
      collar.position.set(0, 1.17, 0.27);
      collar.rotation.z = Math.PI;
      const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), this.createActorMaterial(0xffd447, style));
      pendant.position.set(0, 1.12, 0.31);
      const flower = this.createFlowerPatch(0.07);
      flower.position.set(0.12, 0.72, 0.34);
      body.add(collar, pendant, flower);
      return;
    }

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), this.createActorMaterial(style.outfit, style));
    cap.position.set(0, 1.8, 0.02);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 8), this.createActorMaterial(0x17263a, style));
    visor.position.set(0, 1.73, 0.2);
    visor.scale.set(1.7, 0.22, 0.65);
    const badge = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), this.createActorMaterial(style.accent, style));
    badge.position.set(0, 1.12, 0.31);
    const jacketPanel = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.08), this.createActorMaterial(0x1c396f, style));
    jacketPanel.position.set(0, 0.88, 0.31);
    const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.04), this.createActorMaterial(0xffd447, style));
    wingLeft.position.set(-0.12, 1.16, 0.36);
    wingLeft.rotation.z = -0.18;
    const wingRight = wingLeft.clone();
    wingRight.position.x = 0.12;
    wingRight.rotation.z = 0.18;
    const leftEpaulet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 0.08), this.createActorMaterial(0xffd447, style));
    leftEpaulet.position.set(-0.25, 1.18, 0.18);
    leftEpaulet.rotation.z = 0.18;
    const rightEpaulet = leftEpaulet.clone();
    rightEpaulet.position.x = 0.25;
    rightEpaulet.rotation.z = -0.18;
    const capBadge = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), this.createActorMaterial(0xffd447, style));
    capBadge.position.set(0, 1.85, 0.18);
    body.add(cap, visor, capBadge, jacketPanel, wingLeft, wingRight, leftEpaulet, rightEpaulet, badge);
  }

  private addSkirt(body: THREE.Group, color: number, style: ActorStyle, radius: number, height: number): void {
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 32, 1, true), this.createActorMaterial(color, style));
    skirt.position.set(0, 0.72, 0);
    skirt.rotation.y = Math.PI;
    body.add(skirt);
  }

  private addCrown(body: THREE.Group, style: ActorStyle): void {
    const material = this.createActorMaterial(0xffffff, style);
    for (let i = 0; i < 3; i += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.19, 4), material);
      spike.position.set((i - 1) * 0.12, 1.84 + (i === 1 ? 0.035 : 0), 0.08);
      spike.rotation.y = Math.PI / 4;
      body.add(spike);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), this.createActorMaterial(0x38c6ff, style));
    gem.position.set(0, 1.92, 0.1);
    body.add(gem);
  }

  private addPuddingHat(body: THREE.Group, style: ActorStyle): void {
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 32), this.createActorMaterial(0xffd447, style));
    brim.position.set(0, 1.86, 0.03);
    brim.scale.set(1.15, 0.58, 0.18);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 28), this.createActorMaterial(0xffd447, style));
    cone.position.set(0.02, 2.08, 0.02);
    cone.rotation.z = -0.18;
    const ribbon = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.38, 6, 10), this.createActorMaterial(0xff87b7, style));
    ribbon.position.set(0, 1.94, 0.16);
    ribbon.rotation.z = Math.PI / 2;
    body.add(brim, cone, ribbon);
  }

  private createSnowflake(radius: number): THREE.Group {
    const snowflake = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 6; i += 1) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, radius, 4, 6), material);
      arm.rotation.z = (Math.PI / 6) * i;
      snowflake.add(arm);
    }
    return snowflake;
  }

  private createFlowerPatch(scale: number): THREE.Group {
    const flower = new THREE.Group();
    const center = new THREE.Mesh(new THREE.SphereGeometry(scale * 0.48, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd447 }));
    flower.add(center);
    [0, 1, 2, 3, 4].forEach((i) => {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(scale * 0.42, 10, 8), new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xffffff : 0xfff1a8 }));
      const angle = (Math.PI * 2 * i) / 5;
      petal.position.set(Math.cos(angle) * scale * 0.6, Math.sin(angle) * scale * 0.6, 0.01);
      petal.scale.set(1, 0.74, 0.16);
      flower.add(petal);
    });
    return flower;
  }

  private addSwingProp(root: THREE.Group, style: ActorStyle): void {
    const material = this.createActorMaterial(0xffd447, style);
    const board = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.62, 8, 12), material);
    board.position.set(0, 0.32, -0.04);
    board.rotation.z = Math.PI / 2;
    const ropeMaterial = this.createActorMaterial(0xffffff, style);
    const leftRope = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.9, 5, 8), ropeMaterial);
    leftRope.position.set(-0.31, 0.84, -0.07);
    const rightRope = leftRope.clone();
    rightRope.position.x = 0.31;
    root.add(board, leftRope, rightRope);
  }

  private clearLobbyActors(): void {
    this.actors.forEach((actor) => actor.rig.root.removeFromParent());
    this.floorGlows.forEach((glow) => glow.removeFromParent());
    this.actors.length = 0;
    this.floorGlows.length = 0;
  }

  private readonly resize = (): void => {
    const width = Math.max(260, Math.round(this.host.clientWidth));
    const height = Math.max(300, Math.round(this.host.clientHeight));
    const aspect = width / height;
    const halfWidth = Math.max(1.45, 2.2 * aspect);
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = 3.05;
    this.camera.bottom = -0.2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly handleScreenEvent = (event: Event): void => {
    const detail = (event as CustomEvent<{ screen: string }>).detail;
    this.currentScreen = detail?.screen ?? '';
    this.applyScreenVisibility();
  };

  private readonly handleSelectionEvent = (event: Event): void => {
    const detail = (event as CustomEvent<{ index: number }>).detail;
    this.selectedIndex = detail?.index ?? Number(document.body.dataset.runCoolCharacterIndex ?? 0);
    this.applySelection();
    this.buildRunnerCharacter();
    this.applyScreenVisibility();
  };

  private readonly handleRunnerStateEvent = (event: Event): void => {
    const detail = (event as CustomEvent<{ characterIndex?: number; lane?: number; pose?: RunnerPose; renderMode?: string; state?: string }>).detail;
    if (!this.runner) {
      return;
    }

    if (typeof detail?.characterIndex === 'number' && detail.characterIndex !== this.selectedIndex) {
      this.selectedIndex = detail.characterIndex;
      this.applySelection();
      this.buildRunnerCharacter();
    }

    const runner = this.runner;
    if (typeof detail?.lane === 'number') {
      runner.targetLane = clamp(detail.lane, 0, 2);
    }
    if (detail?.pose && detail.pose !== runner.pose) {
      runner.pose = detail.pose;
      runner.poseStartedAt = this.clock.elapsedTime;
    }
    if (detail?.state === 'paused' || detail?.state === 'running' || detail?.state === 'ended') {
      this.runnerGameState = detail.state;
    }
    if (detail?.renderMode) {
      this.runnerRenderMode = detail.renderMode;
    }
    this.applyScreenVisibility();
  };

  private animate = (): void => {
    if (this.disposed) {
      return;
    }

    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;
    this.actors.forEach((actor, index) => this.updateLobbyActor(actor, index, elapsed));
    this.floorGlows.forEach((glow, index) => {
      const selected = index === this.selectedIndex;
      glow.scale.setScalar((selected ? 0.82 : 0.58) + Math.sin(elapsed * 3.2 + index) * 0.025);
    });
    this.updateRunner(delta, elapsed);
    this.updateRunRoadMotion(elapsed);
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.animate);
  };

  private updateLobbyActor(actor: LobbyActor, index: number, elapsed: number): void {
    const selected = index === this.selectedIndex;
    const targetScale = selected ? actor.selectedScale : actor.baseScale;
    const breath = Math.sin(elapsed * (selected ? 3.8 : 2.1) + index * 0.72);
    const bob = Math.sin(elapsed * (selected ? 5.8 : 2.4) + index) * (selected ? 0.035 : 0.018);
    actor.rig.root.position.y = actor.home.y + bob;
    actor.rig.root.rotation.y = -0.28 + (index - 2) * 0.08 + Math.sin(elapsed * 1.2 + index) * 0.04;
    actor.rig.root.rotation.z = this.getActorSway(index, selected, elapsed);
    actor.rig.root.scale.set(targetScale * (1 + breath * 0.012), targetScale * (1 + breath * 0.026), targetScale);

    if (index === 0) {
      this.poseBabyIdle(actor.rig, elapsed, selected);
      return;
    }
    if (index === 1) {
      this.poseSwingIdle(actor.rig, elapsed, selected);
      return;
    }
    this.poseStandingIdle(actor.rig, elapsed, selected);
  }

  private updateRunner(delta: number, elapsed: number): void {
    if (!this.runner) {
      return;
    }

    const runner = this.runner;
    runner.lane = THREE.MathUtils.damp(runner.lane, runner.targetLane, 12, delta);
    const laneX = this.getRunnerLaneX(runner.lane);
    const poseElapsed = elapsed - runner.poseStartedAt;
    const stride = Math.sin(elapsed * 13);
    const counterStride = Math.cos(elapsed * 13);
    const baseScale = this.getRunnerScale(this.selectedIndex);
    const jumpArc = runner.pose === 'jump' ? Math.sin(Math.min(1, poseElapsed / 0.62) * Math.PI) * 0.42 : 0;
    const slideSquash = runner.pose === 'slide' ? 0.66 : 1;
    const slideLean = runner.pose === 'slide' ? -0.32 : 0;
    const runBob = runner.pose === 'run' ? Math.abs(stride) * 0.032 : 0;

    runner.rig.root.visible = this.currentScreen === 'running' && this.runnerGameState === 'running' && this.runnerRenderMode !== 'layered-2d';
    runner.rig.root.position.set(laneX, 0.02 + jumpArc + runBob, 0.08);
    runner.rig.root.rotation.y = THREE.MathUtils.damp(runner.rig.root.rotation.y, (runner.targetLane - 1) * -0.08, 8, delta);
    runner.rig.root.rotation.x = THREE.MathUtils.damp(runner.rig.root.rotation.x, slideLean, 10, delta);
    runner.rig.root.rotation.z = THREE.MathUtils.damp(runner.rig.root.rotation.z, runner.pose === 'jump' ? Math.sin(poseElapsed * 8) * 0.08 : 0, 8, delta);
    runner.rig.root.scale.set(baseScale * (1 + Math.abs(stride) * 0.012), baseScale * slideSquash * (1 + Math.abs(stride) * 0.018), baseScale);

    if (runner.pose === 'slide') {
      runner.rig.leftArm.rotation.x = -0.65;
      runner.rig.rightArm.rotation.x = -0.65;
      runner.rig.leftLeg.rotation.x = 0.55;
      runner.rig.rightLeg.rotation.x = 0.55;
      return;
    }

    runner.rig.leftArm.rotation.x = -stride * 0.8;
    runner.rig.rightArm.rotation.x = stride * 0.8;
    runner.rig.leftLeg.rotation.x = stride * 0.9;
    runner.rig.rightLeg.rotation.x = -stride * 0.9;
    runner.rig.head.rotation.z = counterStride * 0.025;
  }

  private updateRunRoadMotion(elapsed: number): void {
    if (this.activeEnvironment !== 'run') {
      return;
    }

    this.runRoadDashes.forEach((dash, index) => {
      const y = -0.12 + ((elapsed * 1.28 + index * 0.34) % 3.0);
      const t = clamp((y + 0.12) / 3.0, 0, 1);
      dash.position.y = y;
      dash.scale.set(1.15 - t * 0.78, 1, 1);
      (dash.material as THREE.MeshBasicMaterial).opacity = 0.44 - t * 0.26;
    });

    this.runSpeedMarks.forEach((mark, index) => {
      const y = -0.02 + ((elapsed * 2.05 + index * 0.48) % 2.9);
      const side = index % 2 === 0 ? -1 : 1;
      const t = clamp((y + 0.02) / 2.9, 0, 1);
      mark.position.set(side * (1.55 - t * 0.64), y, -0.03);
      mark.scale.set(1.32 - t * 0.62, 1, 1);
      (mark.material as THREE.MeshBasicMaterial).opacity = 0.28 - t * 0.18;
    });
  }

  private poseStandingIdle(rig: CharacterRig, elapsed: number, selected: boolean): void {
    const strength = selected ? 1 : 0.65;
    rig.leftArm.rotation.x = -0.2 + Math.sin(elapsed * 2.2) * 0.08 * strength;
    rig.rightArm.rotation.x = 0.2 - Math.sin(elapsed * 2.2) * 0.08 * strength;
    rig.leftLeg.rotation.x = Math.sin(elapsed * 1.7) * 0.035 * strength;
    rig.rightLeg.rotation.x = -Math.sin(elapsed * 1.7) * 0.035 * strength;
    rig.head.rotation.z = Math.sin(elapsed * 1.4) * 0.035 * strength;
  }

  private poseBabyIdle(rig: CharacterRig, elapsed: number, selected: boolean): void {
    const strength = selected ? 1 : 0.75;
    rig.body.rotation.z = Math.sin(elapsed * 2.4) * 0.05 * strength;
    rig.leftArm.rotation.x = -0.7 + Math.sin(elapsed * 3) * 0.18;
    rig.rightArm.rotation.x = -0.7 - Math.sin(elapsed * 3) * 0.18;
    rig.leftLeg.rotation.x = Math.sin(elapsed * 2.8) * 0.22;
    rig.rightLeg.rotation.x = -Math.sin(elapsed * 2.8) * 0.22;
  }

  private poseSwingIdle(rig: CharacterRig, elapsed: number, selected: boolean): void {
    const strength = selected ? 1 : 0.7;
    rig.body.rotation.z = Math.sin(elapsed * 1.45) * 0.11 * strength;
    rig.leftArm.rotation.x = -0.28;
    rig.rightArm.rotation.x = -0.28;
    rig.leftLeg.rotation.x = Math.sin(elapsed * 1.45) * 0.18 * strength;
    rig.rightLeg.rotation.x = -Math.sin(elapsed * 1.45) * 0.18 * strength;
  }

  private applySelection(): void {
    this.actors.forEach((actor, index) => {
      actor.rig.root.scale.setScalar(index === this.selectedIndex ? actor.selectedScale : actor.baseScale);
    });
  }

  private applyScreenVisibility(): void {
    const lobbyVisible = this.currentScreen === 'character-lobby';
    const mapVisible = this.currentScreen === 'map-select';
    const runSceneVisible = this.currentScreen === 'running';
    const runningVisible = runSceneVisible && this.runnerGameState === 'running';
    const threeRunnerVisible = runningVisible && this.runnerRenderMode !== 'layered-2d';
    this.updateEnvironment();
    this.host.classList.toggle('is-visible', lobbyVisible || mapVisible || runSceneVisible);
    this.host.classList.toggle('is-lobby', lobbyVisible);
    this.host.classList.toggle('is-map', mapVisible);
    this.host.classList.toggle('is-running', runningVisible);
    this.actors.forEach((actor) => {
      actor.rig.root.visible = lobbyVisible;
    });
    this.floorGlows.forEach((glow) => {
      glow.visible = lobbyVisible;
    });
    if (this.runner) {
      this.runner.rig.root.visible = threeRunnerVisible;
    }
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

  private updateEnvironment(): void {
    const nextEnvironment = this.currentScreen === 'map-select' ? 'map' : this.currentScreen === 'running' ? 'run' : 'lobby';
    if (this.activeEnvironment === nextEnvironment) {
      return;
    }

    this.activeEnvironment = nextEnvironment;
    this.environment.clear();
    this.runRoadDashes.length = 0;
    this.runSpeedMarks.length = 0;
    if (nextEnvironment === 'map') {
      this.buildMapEnvironment();
      return;
    }
    if (nextEnvironment === 'run') {
      this.buildRunEnvironment();
      return;
    }
    this.buildLobbyEnvironment();
  }

  private buildLobbyEnvironment(): void {
    this.renderer.setClearColor(0xbfefff, 1);
    this.addSkyDecor();
    this.addGroundBand(0x70cc72, 0.18, 0.95);
    this.addGardenPath();

    [
      [-1.92, 1.06, 0.72],
      [1.9, 1.12, 0.8],
      [-1.96, 0.2, 0.52],
      [1.98, 0.28, 0.56]
    ].forEach(([x, y, scale]) => this.addTree(x, y, scale));

    [
      [-1.22, 0.7, 0.42, 0x8fdc72],
      [1.22, 0.66, 0.46, 0x8fdc72],
      [-1.52, 0.05, 0.46, 0xffd1e1],
      [1.56, 0.05, 0.48, 0xfff1a8]
    ].forEach(([x, y, scale, color]) => {
      this.environment.add(this.createOval(x, y, scale, scale * 0.28, color, 0.7));
    });

    [
      [-1.7, 0.12, 0xff87b7],
      [-1.45, 0.02, 0xffffff],
      [-1.55, 0.22, 0xffd447],
      [1.52, 0.18, 0xff87b7],
      [1.72, 0.08, 0xffd447],
      [1.36, 0.0, 0xffffff]
    ].forEach(([x, y, color]) => this.addFlower(x, y, color));
  }

  private buildMapEnvironment(): void {
    this.renderer.setClearColor(0x8fd7ff, 1);
    this.addSkyDecor();
    this.addGroundBand(0x6fcb70, 0.08, 0.82);

    const island = new THREE.Group();
    island.position.set(0, 1.1, -0.18);
    island.scale.set(1.02, 1, 1);
    const base = this.createOval(0, 0, 1.35, 1.55, 0xeaf7ff, 0.96);
    const grass = this.createOval(0, 0.02, 1.16, 1.33, 0xbde78a, 0.98);
    island.add(base, grass);
    this.environment.add(island);

    const routeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd447, transparent: true, opacity: 0.9 });
    const points = [
      new THREE.Vector3(-0.62, 1.64, 0.04),
      new THREE.Vector3(0.7, 1.36, 0.04),
      new THREE.Vector3(-0.56, 0.9, 0.04),
      new THREE.Vector3(0.68, 0.54, 0.04)
    ];
    for (let i = 0; i < points.length - 1; i += 1) {
      const start = points[i];
      const end = points[i + 1];
      const mid = start.clone().lerp(end, 0.5);
      const length = start.distanceTo(end);
      const road = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, length, 8, 16), routeMaterial);
      road.position.copy(mid);
      road.rotation.z = Math.atan2(end.y - start.y, end.x - start.x) - Math.PI / 2;
      this.environment.add(road);
    }

    [
      [-0.62, 1.64, 0xcf5d45],
      [0.7, 1.36, 0xff87b7],
      [-0.56, 0.9, 0x2f9e62],
      [0.68, 0.54, 0x7a5cff]
    ].forEach(([x, y, color]) => {
      this.environment.add(this.createOval(x, y - 0.16, 0.42, 0.14, color, 0.22));
    });
  }

  private buildRunEnvironment(): void {
    this.renderer.setClearColor(0x263845, 1);
    this.addRunRoad();
  }

  private addSkyDecor(): void {
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 18), new THREE.MeshBasicMaterial({ color: 0xffe46b }));
    sun.position.set(-1.12, 2.58, -0.2);
    this.environment.add(sun);
    this.environment.add(this.createCloud(1.1, 2.62, 0.52));
    this.environment.add(this.createCloud(0.72, 2.42, 0.68));
  }

  private createCloud(x: number, y: number, scale: number): THREE.Group {
    const cloud = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.48 });
    [-0.18, 0.04, 0.24].forEach((offset, index) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.16 + index * 0.02, 18, 12), material);
      puff.position.set(offset, 0, -0.2);
      puff.scale.set(1.5, 0.52, 0.18);
      cloud.add(puff);
    });
    cloud.position.set(x, y, -0.2);
    cloud.scale.setScalar(scale);
    return cloud;
  }

  private addGroundBand(color: number, y: number, height: number): void {
    const ground = new THREE.Mesh(new THREE.BoxGeometry(5.6, height, 0.08), this.createMat(color, 0.64));
    ground.position.set(0, y, -0.35);
    this.environment.add(ground);
  }

  private addGardenPath(): void {
    const path = new THREE.Shape();
    path.moveTo(-0.22, 1.08);
    path.lineTo(0.22, 1.08);
    path.lineTo(1.2, 0.0);
    path.lineTo(-1.2, 0.0);
    path.closePath();
    const pathMesh = new THREE.Mesh(new THREE.ShapeGeometry(path), new THREE.MeshStandardMaterial({ color: 0xe7d5a8, roughness: 0.72, transparent: true, opacity: 0.82 }));
    pathMesh.position.z = -0.16;
    this.environment.add(pathMesh);
    const shine = this.createOval(0, 0.98, 0.24, 0.06, 0xf6e8bd, 0.52);
    this.environment.add(shine);
  }

  private addRunRoad(): void {
    const roadShape = new THREE.Shape();
    roadShape.moveTo(-3.2, -0.28);
    roadShape.lineTo(3.2, -0.28);
    roadShape.lineTo(0.84, 3.12);
    roadShape.lineTo(-0.84, 3.12);
    roadShape.closePath();
    const road = new THREE.Mesh(new THREE.ShapeGeometry(roadShape), this.createMat(0x263845, 0.62));
    road.position.z = -0.22;
    this.environment.add(road);

    const roadGlow = new THREE.Mesh(new THREE.ShapeGeometry(roadShape), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.035 }));
    roadGlow.position.z = -0.18;
    this.environment.add(roadGlow);

    const shoulderMaterial = new THREE.MeshBasicMaterial({ color: 0xffd447, transparent: true, opacity: 0.42 });
    [-1, 1].forEach((side) => {
      const shoulder = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 3.65, 6, 12), shoulderMaterial);
      shoulder.position.set(side * 1.34, 1.35, -0.08);
      shoulder.rotation.z = side * 0.54;
      this.environment.add(shoulder);
    });

    [-1, 1].forEach((side) => {
      const lane = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 3.55, 6, 12), new THREE.MeshBasicMaterial({ color: 0xdff2fb, transparent: true, opacity: 0.36 }));
      lane.position.set(side * 0.45, 1.35, -0.06);
      lane.rotation.z = side * 0.25;
      this.environment.add(lane);
    });

    [-0.9, 0, 0.9].forEach((x) => {
      const laneBand = new THREE.Mesh(new THREE.BoxGeometry(0.72, 3.7, 0.03), new THREE.MeshBasicMaterial({ color: x === 0 ? 0xffffff : 0x000000, transparent: true, opacity: x === 0 ? 0.025 : 0.035 }));
      laneBand.position.set(x, 1.35, -0.17);
      laneBand.rotation.z = x < 0 ? -0.16 : x > 0 ? 0.16 : 0;
      this.environment.add(laneBand);
    });

    for (let i = 0; i < 9; i += 1) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: 0xdff2fb, transparent: true, opacity: 0.3 }));
      dash.position.set(0, 0.04 + i * 0.31, -0.04);
      this.runRoadDashes.push(dash);
      this.environment.add(dash);
    }

    for (let i = 0; i < 10; i += 1) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.026, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.24 }));
      mark.rotation.z = i % 2 === 0 ? -0.18 : 0.18;
      this.runSpeedMarks.push(mark);
      this.environment.add(mark);
    }
  }

  private addTree(x: number, y: number, scale: number): void {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.48, 8, 12), this.createMat(0x9a6a38, 0.78));
    trunk.position.y = -0.22;
    tree.add(trunk);
    const leafMaterial = this.createMat(0x56c866, 0.62);
    [[0, 0.1, 0.28], [-0.16, -0.02, 0.23], [0.17, -0.02, 0.24]].forEach(([lx, ly, radius]) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), leafMaterial);
      leaf.position.set(lx, ly + 0.18, 0);
      leaf.scale.set(1.08, 0.94, 0.72);
      tree.add(leaf);
    });
    tree.position.set(x, y, -0.05);
    tree.scale.setScalar(scale);
    this.environment.add(tree);
  }

  private addFlower(x: number, y: number, color: number): void {
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.13, 5, 6), this.createMat(0x2f9e62, 0.7));
    stem.position.set(x, y, 0.02);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color }));
    bloom.position.set(x, y + 0.08, 0.04);
    bloom.scale.set(1.2, 0.8, 0.42);
    this.environment.add(stem, bloom);
  }

  private createOval(x: number, y: number, width: number, height: number, color: number, opacity = 1): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
    const oval = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), material);
    oval.position.set(x, y, -0.12);
    oval.scale.set(width, height, 1);
    return oval;
  }

  private createMat(color: number, roughness: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness });
  }

  private createActorMaterial(color: number, style: ActorStyle): THREE.MeshStandardMaterial {
    if (style.materialTone === 'silky') {
      return new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.04 });
    }
    if (style.materialTone === 'uniform') {
      return new THREE.MeshStandardMaterial({ color, roughness: 0.54, metalness: 0.12 });
    }
    return new THREE.MeshStandardMaterial({ color, roughness: 0.68 });
  }

  private getLobbyHomes(): THREE.Vector3[] {
    return [
      new THREE.Vector3(-1.18, 0.96, 0),
      new THREE.Vector3(-0.7, 1.08, 0),
      new THREE.Vector3(0, 1.42, 0),
      new THREE.Vector3(0.72, 1.04, 0),
      new THREE.Vector3(1.18, 0.96, 0)
    ];
  }

  private getActorScale(index: number, selected: boolean): number {
    const base = [0.29, 0.27, 0.3, 0.28, 0.3][index] ?? 0.29;
    return selected ? base * 1.08 : base;
  }

  private getRunnerLaneX(lane: number): number {
    return THREE.MathUtils.lerp(-0.54, 0.54, clamp(lane, 0, 2) / 2);
  }

  private getRunnerScale(index: number): number {
    return [0.28, 0.27, 0.29, 0.28, 0.3][index] ?? 0.28;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
