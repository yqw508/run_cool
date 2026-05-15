import Phaser from 'phaser';
import { CHARACTER_PRESETS, DEFAULT_SELECTION, type CharacterPreset, type CharacterSelection, resolveSelection } from './characters';
import { GAME_HEIGHT, GAME_WIDTH, JUMP_DURATION_MS, PLAYER_Y, SLIDE_DURATION_MS, type CollectibleConfig, type LaneIndex } from './config';
import { applyDamage, createHealthState, isDefeated, type HealthState } from './health';
import { bindSwipeInput, type GestureDirection } from './input';
import { getThemeForRunDistance, LEVEL_THEMES, type LevelTheme, type ThemeObstacle } from './levels';
import { ALL_FINAL_ART_ASSETS, ART_ASSETS } from './artAssets';
import { ALL_OPEN_ASSETS, OPEN_ASSETS } from './openAssets';
import { getLaneX, getRunSpeed, getScore, getSpawnDelay, nextLane } from './progression';

type GameState = 'setup' | 'running' | 'paused' | 'ended';
type SetupStep = 'character' | 'map';
type RunnerPose = 'run' | 'jump' | 'slide';
type ObstacleKind = 'block' | 'bar';
type LobbyScreen = 'character-lobby' | 'map-select' | 'running' | 'result';

type Obstacle = Phaser.GameObjects.Container & {
  body: Phaser.Physics.Arcade.Body;
  kind: ObstacleKind;
  damageHandled?: boolean;
};

type Collectible = Phaser.GameObjects.Container & {
  body: Phaser.Physics.Arcade.Body;
  collectibleId: string;
};

type LayeredBabyRig = {
  head: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  leftArm: Phaser.GameObjects.Container;
  rightArm: Phaser.GameObjects.Container;
  leftLeg: Phaser.GameObjects.Container;
  rightLeg: Phaser.GameObjects.Container;
  pacifier: Phaser.GameObjects.Container;
};

const TEXT_STYLE = {
  fontFamily: '"Microsoft YaHei", "PingFang SC", Arial, sans-serif',
  color: '#17263a'
};

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export class RunnerScene extends Phaser.Scene {
  private state: GameState = 'setup';
  private setupStep: SetupStep = 'character';
  private selection: CharacterSelection = { ...DEFAULT_SELECTION };
  private selectedCharacterIndex = 0;
  private currentLane: LaneIndex = 1;
  private player!: Phaser.GameObjects.Container;
  private playerVisual?: Phaser.GameObjects.Container;
  private layeredBabyRig?: LayeredBabyRig;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private collectibles!: Phaser.Physics.Arcade.Group;
  private worldLayer?: Phaser.GameObjects.Container;
  private setupLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
  private overlayLayer!: Phaser.GameObjects.Container;
  private resultLayer!: Phaser.GameObjects.Container;
  private scoreText!: Phaser.GameObjects.Text;
  private themeLabelText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private collectibleHudIcon!: Phaser.GameObjects.Container;
  private healthState: HealthState = createHealthState();
  private currentTheme: LevelTheme = LEVEL_THEMES[0];
  private collectibleConfig: CollectibleConfig = this.currentTheme.collectible;
  private selectedThemeIndex = 0;
  private activeMusicKey = '';
  private audioContext?: AudioContext;
  private musicOscillator?: OscillatorNode;
  private musicGain?: GainNode;
  private runStartedAt = 0;
  private distanceMeters = 0;
  private collectiblesCollected = 0;
  private nextSpawnAt = 0;
  private pausedAt = 0;
  private hasSeenTutorial = false;
  private pose: RunnerPose = 'run';
  private poseTimer?: Phaser.Time.TimerEvent;
  private runTweens: Phaser.Tweens.Tween[] = [];

  constructor() {
    super('RunnerScene');
  }

  preload(): void {
    CHARACTER_PRESETS.forEach((preset) => {
      this.load.image(preset.assetKey, preset.assetUrl);
      this.load.image(preset.lobbyAssetKey, preset.lobbyAssetUrl);
    });
    ALL_FINAL_ART_ASSETS.forEach((asset) => {
      if (asset.url) {
        this.load.image(asset.key, asset.url);
      }
    });
    ALL_OPEN_ASSETS.forEach((asset) => this.load.image(asset.key, asset.url));
  }

  create(): void {
    document.getElementById('boot-loading')?.remove();
    this.drawWorld();
    this.obstacles = this.physics.add.group();
    this.collectibles = this.physics.add.group();
    this.player = this.createPlayer();
    this.playerBody = this.physics.add.existing(this.player).body as Phaser.Physics.Arcade.Body;
    this.playerBody.setSize(48, 88);
    this.playerBody.setOffset(-24, -88);
    this.player.setPosition(getLaneX(this.currentLane), PLAYER_Y);

    this.createHud();
    this.createSetupLayer();
    this.createResultLayer();
    this.createOverlayLayer();
    this.bindControls();

    this.physics.add.overlap(this.player, this.collectibles, (_, collectible) => this.collectItem(collectible as Collectible));
    this.physics.add.overlap(this.player, this.obstacles, (_, obstacle) => this.hitObstacle(obstacle as Obstacle));
    this.enterSetup();
  }

  update(time: number, delta: number): void {
    if (this.state !== 'running') {
      return;
    }

    const elapsed = time - this.runStartedAt;
    const speed = getRunSpeed(elapsed);
    this.distanceMeters += (speed * delta) / 1000 / 10;
    const nextTheme = getThemeForRunDistance(this.selectedThemeIndex, this.distanceMeters);

    if (nextTheme.id !== this.currentTheme.id) {
      this.currentTheme = nextTheme;
      this.drawWorld();
      this.switchThemeMusic(nextTheme);
    }

    this.updateHud();

    if (time >= this.nextSpawnAt) {
      this.spawnPattern();
      this.nextSpawnAt = time + getSpawnDelay(elapsed);
    }

    this.moveObjects(delta, speed);
  }

  private drawWorld(): void {
    this.worldLayer?.destroy(true);
    this.worldLayer = this.add.container(0, 0).setDepth(-10);
    const theme = this.currentTheme;

    const finalBackground = ART_ASSETS.runnerBackgrounds[theme.id];
    const fallbackBackground = OPEN_ASSETS.backgrounds[theme.id];
    const backgroundKey = this.textures.exists(finalBackground.key) ? finalBackground.key : fallbackBackground.key;
    if (this.textures.exists(backgroundKey)) {
      this.worldLayer.add(
        this.add
          .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, backgroundKey)
          .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
          .setAlpha(backgroundKey === finalBackground.key ? 1 : 0.78)
      );
    }
    this.worldLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, theme.skyColor, 0.22));
    this.worldLayer.add(this.add.circle(68, 82, 34, 0xffe46b));
    this.drawThemeLandmarks(theme);
    this.worldLayer.add(this.add.rectangle(GAME_WIDTH / 2, 680, GAME_WIDTH, 116, theme.groundColor));
    this.drawRoad(theme);
  }

  private drawRoad(theme: LevelTheme): void {
    const road = this.add.graphics();
    const topLeft = new Phaser.Geom.Point(54, 130);
    const topRight = new Phaser.Geom.Point(336, 130);
    const bottomRight = new Phaser.Geom.Point(390, 642);
    const bottomLeft = new Phaser.Geom.Point(0, 642);
    const roadCenter = GAME_WIDTH / 2;

    road.fillStyle(0x263845, 0.28);
    road.fillPoints(
      [
        new Phaser.Geom.Point(topLeft.x - 16, topLeft.y + 18),
        new Phaser.Geom.Point(topRight.x + 16, topRight.y + 18),
        new Phaser.Geom.Point(bottomRight.x + 26, bottomRight.y + 22),
        new Phaser.Geom.Point(bottomLeft.x - 26, bottomLeft.y + 22)
      ],
      true
    );

    road.fillStyle(Phaser.Display.Color.ValueToColor(theme.roadColor).darken(22).color, 1);
    road.fillPoints(
      [
        new Phaser.Geom.Point(bottomLeft.x, bottomLeft.y),
        new Phaser.Geom.Point(bottomRight.x, bottomRight.y),
        new Phaser.Geom.Point(bottomRight.x + 24, bottomRight.y + 34),
        new Phaser.Geom.Point(bottomLeft.x - 24, bottomLeft.y + 34)
      ],
      true
    );

    road.fillStyle(theme.roadColor, 1);
    road.fillPoints([topLeft, topRight, bottomRight, bottomLeft], true);

    road.fillStyle(0xffffff, 0.1);
    road.fillPoints(
      [
        new Phaser.Geom.Point(roadCenter - 28, 134),
        new Phaser.Geom.Point(roadCenter + 28, 134),
        new Phaser.Geom.Point(roadCenter + 62, 636),
        new Phaser.Geom.Point(roadCenter - 62, 636)
      ],
      true
    );

    road.lineStyle(3, theme.laneColor, 0.42);
    road.beginPath();
    road.moveTo(145, 130);
    road.lineTo(108, 642);
    road.moveTo(245, 130);
    road.lineTo(282, 642);
    road.strokePath();
    this.worldLayer?.add(road);

    for (let y = 170; y < 630; y += 92) {
      const scale = Phaser.Math.Linear(0.35, 1.08, (y - 130) / 512);
      this.worldLayer?.add(
        this.add
          .rectangle(GAME_WIDTH / 2, y, 80 * scale, 6 * scale, theme.laneColor, 0.2)
          .setAngle(0)
      );
    }
  }

  private drawThemeLandmarks(theme: LevelTheme): void {
    if (!this.worldLayer) {
      return;
    }

    if (theme.id === 'campus') {
      this.worldLayer.add(this.add.rectangle(95, 142, 96, 74, 0xf6f1df).setStrokeStyle(3, 0xcf5d45));
      this.worldLayer.add(this.add.rectangle(95, 98, 104, 18, 0xcf5d45));
      this.worldLayer.add(this.add.text(58, 127, '教学楼', { ...TEXT_STYLE, fontSize: '14px' }));
      this.worldLayer.add(this.add.ellipse(290, 146, 110, 46, 0xe96f4f, 0.95));
      this.worldLayer.add(this.add.rectangle(286, 94, 86, 46, 0xdff2fb).setStrokeStyle(3, 0x4f9ed8));
      this.worldLayer.add(this.add.text(260, 86, '图书馆', { ...TEXT_STYLE, fontSize: '13px' }));
      return;
    }

    if (theme.id === 'mall') {
      this.worldLayer.add(this.add.rectangle(82, 126, 118, 70, 0x3d2d5c).setStrokeStyle(3, 0xffd447));
      this.worldLayer.add(this.add.text(38, 104, 'GAME', { ...TEXT_STYLE, color: '#ffd447', fontSize: '18px', fontStyle: 'bold' }));
      this.worldLayer.add(this.add.rectangle(224, 122, 96, 64, 0xfff1a8).setStrokeStyle(3, 0xe85d5d));
      this.worldLayer.add(this.add.text(196, 103, '餐厅', { ...TEXT_STYLE, fontSize: '15px' }));
      this.worldLayer.add(this.add.rectangle(326, 112, 86, 56, 0x17263a).setStrokeStyle(3, 0xffffff));
      this.worldLayer.add(this.add.text(301, 96, '影院', { ...TEXT_STYLE, color: '#ffffff', fontSize: '15px' }));
      return;
    }

    if (theme.id === 'zoo') {
      this.worldLayer.add(this.add.rectangle(78, 122, 112, 64, 0xffe2a8).setStrokeStyle(3, 0x8c5a2b));
      this.worldLayer.add(this.add.text(47, 105, '动物园', { ...TEXT_STYLE, fontSize: '16px', fontStyle: 'bold' }));
      this.worldLayer.add(this.add.circle(250, 119, 22, 0xffc66d));
      this.worldLayer.add(this.add.rectangle(250, 144, 66, 16, 0x8c5a2b));
      this.worldLayer.add(this.add.circle(312, 120, 17, 0x6f8f45));
      for (let x = 24; x < 370; x += 34) {
        this.worldLayer.add(this.add.rectangle(x, 168, 7, 44, 0x8c5a2b));
      }
      return;
    }

    this.worldLayer.add(this.add.circle(82, 124, 50, 0xffffff, 0.55).setStrokeStyle(5, 0xff5a76));
    for (let angle = 0; angle < 360; angle += 45) {
      const point = Phaser.Math.RotateAround({ x: 82, y: 74 }, 82, 124, Phaser.Math.DegToRad(angle));
      this.worldLayer.add(this.add.line(0, 0, 82, 124, point.x, point.y, 0xff5a76, 0.45).setOrigin(0));
    }
    this.worldLayer.add(this.add.arc(246, 132, 82, 195, 340, false, 0x7a5cff).setStrokeStyle(8, 0x7a5cff));
    this.worldLayer.add(this.add.triangle(326, 154, -30, 24, 30, 24, 0, -36, 0xff87b7));
    this.worldLayer.add(this.add.rectangle(326, 158, 72, 12, 0xffd447));
  }

  private toHexColor(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  private createHud(): void {
    this.hudLayer = this.add.container(0, 0);
    const statsBg = this.add.graphics();
    statsBg.fillStyle(0x17263a, 0.18);
    statsBg.fillRoundedRect(12, 12, 162, 62, 10);

    const scoreIcon = this.add.container(30, 30);
    scoreIcon.add(this.add.circle(0, 0, 10, 0xffd447).setStrokeStyle(2, 0xffffff));
    scoreIcon.add(this.add.rectangle(0, 14, 10, 8, 0xffd447).setStrokeStyle(2, 0xffffff));
    scoreIcon.add(this.add.rectangle(0, 21, 24, 5, 0xffffff, 0.9));

    this.collectibleHudIcon = this.createCollectibleIcon(96, 31, 0.72, this.collectibleConfig);
    this.scoreText = this.add.text(50, 18, '0', {
      ...TEXT_STYLE,
      color: '#ffffff',
      fontSize: '18px',
      fontStyle: 'bold'
    });
    this.themeLabelText = this.add.text(116, 18, '0', {
      ...TEXT_STYLE,
      color: '#ffffff',
      fontSize: '18px',
      fontStyle: 'bold'
    });
    this.healthText = this.add.text(24, 50, '♥♥♥', {
      ...TEXT_STYLE,
      color: '#ffffff',
      fontSize: '18px',
      fontStyle: 'bold'
    });

    const gestureHint = this.add.container(GAME_WIDTH / 2, 92);
    const gestureBg = this.add.graphics();
    gestureBg.fillStyle(0x17263a, 0.16);
    gestureBg.fillRoundedRect(-88, -19, 176, 38, 18);
    gestureHint.add(gestureBg);
    this.addGestureIcon(gestureHint, -54, 0, 'left');
    this.addGestureIcon(gestureHint, -18, 0, 'right');
    this.addGestureIcon(gestureHint, 24, 0, 'up');
    this.addGestureIcon(gestureHint, 60, 0, 'down');

    const pauseButton = this.createIconButton(GAME_WIDTH - 48, 34, 56, 36, 0xfff1a8, () => this.pauseRun());
    pauseButton.add(this.add.rectangle(-6, 0, 5, 18, 0x17263a));
    pauseButton.add(this.add.rectangle(6, 0, 5, 18, 0x17263a));
    this.hudLayer.add([statsBg, scoreIcon, this.collectibleHudIcon, this.scoreText, this.themeLabelText, this.healthText, gestureHint, pauseButton]);
  }

  private updateHud(): void {
    this.scoreText.setText(`${getScore(this.distanceMeters, this.collectiblesCollected, this.collectibleConfig.scoreValue)}`);
    this.themeLabelText.setText(`${this.collectiblesCollected}`);
    this.healthText.setText(`${'♥'.repeat(this.healthState.current)}${'♡'.repeat(this.healthState.max - this.healthState.current)}`);
  }

  private refreshCollectibleHudIcon(): void {
    const previousIcon = this.collectibleHudIcon;
    const iconIndex = this.hudLayer.getIndex(previousIcon);
    this.collectibleHudIcon = this.createCollectibleIcon(96, 31, 0.72, this.collectibleConfig);
    this.hudLayer.addAt(this.collectibleHudIcon, iconIndex);
    previousIcon.destroy(true);
  }

  private createCollectibleIcon(x: number, y: number, scale: number, config: CollectibleConfig): Phaser.GameObjects.Container {
    const icon = this.add.container(x, y).setScale(scale);
    const asset = OPEN_ASSETS.collectibles[config.kind];
    if (this.textures.exists(asset.key)) {
      icon.add(this.add.image(0, 0, asset.key).setDisplaySize(42, 42));
      return icon;
    }
    if (config.kind === 'coin') {
      icon.add(this.add.circle(0, 0, 15, config.color).setStrokeStyle(3, config.accentColor));
      icon.add(this.add.circle(0, 0, 8, 0xffffff, 0.16));
      icon.add(this.add.rectangle(0, 0, 4, 18, config.accentColor, 0.72));
      return icon;
    }

    if (config.kind === 'flower') {
      for (let i = 0; i < 6; i += 1) {
        const angle = Phaser.Math.DegToRad(i * 60);
        icon.add(this.add.ellipse(Math.cos(angle) * 10, Math.sin(angle) * 10, 13, 18, config.color).setAngle(i * 60));
      }
      icon.add(this.add.circle(0, 0, 8, config.accentColor).setStrokeStyle(2, 0xffffff));
      return icon;
    }

    if (config.kind === 'bottle') {
      icon.add(this.add.rectangle(0, 4, 20, 28, config.color, 0.95).setStrokeStyle(3, config.accentColor));
      icon.add(this.add.rectangle(0, -15, 12, 10, config.accentColor).setStrokeStyle(2, 0x65c7f7));
      icon.add(this.add.rectangle(0, 5, 12, 14, 0xffffff, 0.45));
      return icon;
    }

    if (config.kind === 'leaf') {
      icon.add(this.add.ellipse(0, 0, 24, 34, config.color).setAngle(-28).setStrokeStyle(3, config.accentColor));
      icon.add(this.add.line(0, 0, -3, 11, 8, -12, config.accentColor, 0.9).setLineWidth(2));
      return icon;
    }

    if (config.kind === 'balloon') {
      icon.add(this.add.ellipse(0, -4, 24, 30, config.color).setStrokeStyle(3, config.accentColor));
      icon.add(this.add.triangle(0, 13, -5, 6, 5, 6, 0, 15, config.accentColor));
      icon.add(this.add.line(0, 0, 0, 17, -2, 30, 0xffffff, 0.78).setLineWidth(2));
      return icon;
    }

    icon.add(this.add.star(0, 0, 5, 8, 18, config.color).setStrokeStyle(3, config.accentColor));
    return icon;
  }

  private emitScreen(screen: LobbyScreen): void {
    document.body.dataset.runCoolScreen = screen;
    window.dispatchEvent(new CustomEvent('run-cool:screen', { detail: { screen } }));
  }

  private emitLobbySelection(): void {
    document.body.dataset.runCoolCharacterIndex = `${this.selectedCharacterIndex}`;
    window.dispatchEvent(new CustomEvent('run-cool:lobby-selection', { detail: { index: this.selectedCharacterIndex } }));
  }

  private emitRunnerState(): void {
    document.body.dataset.runCoolLane = `${this.currentLane}`;
    document.body.dataset.runCoolPose = this.pose;
    window.dispatchEvent(
      new CustomEvent('run-cool:runner-state', {
        detail: {
          characterIndex: this.selectedCharacterIndex,
          lane: this.currentLane,
          pose: this.pose,
          renderMode: 'phaser-2d',
          state: this.state
        }
      })
    );
  }

  private createSetupLayer(): void {
    this.setupLayer = this.add.container(0, 0);
    if (this.setupStep === 'character') {
      this.createCharacterLobby();
      return;
    }

    this.createMapSelect();
  }

  private createCharacterLobby(): void {
    this.emitScreen('character-lobby');
    this.emitLobbySelection();
    this.drawGardenLobby();

    this.setupLayer.add(
      this.add
        .text(GAME_WIDTH / 2, 48, '选择角色', {
          ...TEXT_STYLE,
          color: '#24664a',
          fontSize: '26px',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setStroke('#ffffff', 4)
    );

    CHARACTER_PRESETS.forEach((preset, index) => this.addLobbyCharacter(preset, index));
    this.addCharacterDetails();

    this.setupLayer.add(this.createButton(86, 650, 120, 42, '上一个', 0xeaf7d8, () => this.selectLobbyCharacter(this.selectedCharacterIndex - 1)));
    this.setupLayer.add(this.createButton(304, 650, 120, 42, '下一个', 0xeaf7d8, () => this.selectLobbyCharacter(this.selectedCharacterIndex + 1)));
    this.setupLayer.add(
      this.createButton(GAME_WIDTH / 2, 696, 236, 48, '下一步  选地图', 0xffd447, () => {
        this.setupStep = 'map';
        this.refreshSetup();
      })
    );
  }

  private drawGardenLobby(): void {
    if (this.textures.exists(ART_ASSETS.backgrounds.lobby.key)) {
      this.setupLayer.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ART_ASSETS.backgrounds.lobby.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT));
      this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xf7fff4, 0.08));
      this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, 612, GAME_WIDTH, 250, 0x8fdc72, 0.06));
      return;
    } else if (this.textures.exists(OPEN_ASSETS.backgrounds.garden.key)) {
      this.setupLayer.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, OPEN_ASSETS.backgrounds.garden.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.9));
    } else {
      this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xbfefff));
    }
    this.setupLayer.add(this.add.circle(62, 82, 32, 0xffe46b, 0.92));
    this.setupLayer.add(this.add.ellipse(326, 82, 76, 28, 0xffffff, 0.55));
    this.setupLayer.add(this.add.ellipse(284, 104, 108, 34, 0xffffff, 0.46));

    this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, 604, GAME_WIDTH, 240, 0x74c973));
    this.setupLayer.add(this.add.ellipse(72, 548, 142, 72, 0x5bbf6a));
    this.setupLayer.add(this.add.ellipse(318, 548, 142, 72, 0x5bbf6a));
    this.setupLayer.add(this.add.ellipse(GAME_WIDTH / 2, 512, 344, 130, 0x7bdc75, 0.95));
    this.setupLayer.add(this.add.ellipse(GAME_WIDTH / 2, 530, 280, 72, 0xa2e18a, 0.9));

    const path = this.add.graphics();
    path.fillStyle(0xe7d5a8, 0.78);
    path.fillPoints(
      [
        new Phaser.Geom.Point(178, 328),
        new Phaser.Geom.Point(214, 328),
        new Phaser.Geom.Point(330, 642),
        new Phaser.Geom.Point(60, 642)
      ],
      true
    );
    path.lineStyle(4, 0xf6e8bd, 0.66);
    path.strokePoints(
      [
        new Phaser.Geom.Point(178, 328),
        new Phaser.Geom.Point(214, 328),
        new Phaser.Geom.Point(330, 642),
        new Phaser.Geom.Point(60, 642),
        new Phaser.Geom.Point(178, 328)
      ],
      true
    );
    this.setupLayer.add(path);

    for (const tree of [
      { x: 38, y: 282, scale: 0.86 },
      { x: 344, y: 278, scale: 0.92 },
      { x: 24, y: 438, scale: 0.72 },
      { x: 364, y: 438, scale: 0.72 }
    ]) {
      this.setupLayer.add(this.add.rectangle(tree.x, tree.y + 58 * tree.scale, 14 * tree.scale, 72 * tree.scale, 0x9a6a38));
      this.setupLayer.add(this.add.circle(tree.x - 18 * tree.scale, tree.y + 12 * tree.scale, 34 * tree.scale, 0x3fae5f));
      this.setupLayer.add(this.add.circle(tree.x + 16 * tree.scale, tree.y + 10 * tree.scale, 36 * tree.scale, 0x4fbd6d));
      this.setupLayer.add(this.add.circle(tree.x, tree.y - 16 * tree.scale, 38 * tree.scale, 0x61c86f));
    }

    this.setupLayer.add(this.add.ellipse(72, 518, 118, 54, 0xffd1e1, 0.42));
    this.setupLayer.add(this.add.ellipse(318, 518, 112, 48, 0xfff1a8, 0.46));
    this.setupLayer.add(this.add.ellipse(108, 388, 92, 34, 0x8fdc72, 0.86));
    this.setupLayer.add(this.add.ellipse(292, 404, 96, 36, 0x8fdc72, 0.86));

    for (const flower of [
      { x: 42, y: 526, c: 0xff87b7 },
      { x: 62, y: 508, c: 0xffd447 },
      { x: 92, y: 540, c: 0xffffff },
      { x: 294, y: 532, c: 0xffffff },
      { x: 330, y: 504, c: 0xff87b7 },
      { x: 350, y: 520, c: 0xffd447 },
      { x: 132, y: 574, c: 0xffffff },
      { x: 250, y: 574, c: 0xffd447 }
    ]) {
      this.setupLayer.add(this.add.rectangle(flower.x, flower.y + 10, 3, 18, 0x2f9e62));
      this.setupLayer.add(this.add.star(flower.x, flower.y, 6, 3, 8, flower.c).setStrokeStyle(1, 0xffffff));
    }
  }

  private addLobbyCharacter(preset: CharacterPreset, index: number): void {
    const selected = index === this.selectedCharacterIndex;
    const spots = [
      { x: 72, y: 480, scale: 0.72 },
      { x: 100, y: 340, scale: 0.65 },
      { x: 195, y: 300, scale: 0.85 },
      { x: 290, y: 340, scale: 0.65 },
      { x: 318, y: 480, scale: 0.72 }
    ];
    const homeSpot = spots[index];
    const selectedScale = homeSpot.scale * 1.08;
    const character = this.add
      .container(homeSpot.x, homeSpot.y)
      .setScale(selected ? selectedScale : homeSpot.scale)
      .setAlpha(selected ? 1 : 0.82)
      .setDepth(selected ? 14 : 4 + Math.round(homeSpot.y / 10));

    character.add(this.add.ellipse(0, -58, 112, 150, 0xffffff, selected ? 0.2 : 0.13).setDepth(-4));
    this.drawLobbyScene(character, preset);

    if (selected) {
      character.add(this.add.circle(0, -64, 58, 0xffd447, 0.07).setStrokeStyle(3, 0xffd447, 0.38).setDepth(-2));
    }
    character.setInteractive(new Phaser.Geom.Rectangle(-58, -150, 116, 190), Phaser.Geom.Rectangle.Contains);
    character.on('pointerup', () => this.selectLobbyCharacter(index));
    this.setupLayer.add(character);

    if (selected) {
      this.tweens.add({
        targets: character,
        scale: homeSpot.scale * 1.1,
        duration: 220,
        ease: 'Back.easeOut'
      });
      this.tweens.add({
        targets: character,
        y: homeSpot.y - 4,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  private drawLobbyScene(character: Phaser.GameObjects.Container, preset: CharacterPreset): void {
    if (this.textures.exists(preset.lobbyAssetKey)) {
      this.drawLobbyImageScene(character, preset);
      return;
    }

    if (preset.id === 'baby-brother') {
      const baby = this.add.container(0, 0);
      baby.add(this.add.ellipse(0, 4, 70, 48, 0xdff2fb).setStrokeStyle(3, 0x7fc7e8));
      baby.add(this.add.circle(-18, -22, 19, preset.skinColor));
      baby.add(this.add.circle(-26, -28, 8, preset.hairColor));
      baby.add(this.add.circle(-24, -22, 2, 0x17263a));
      baby.add(this.add.arc(-13, -16, 6, 20, 160, false, 0x8d4a35).setStrokeStyle(2, 0x8d4a35));
      baby.add(this.add.rectangle(8, 8, 34, 24, 0xffffff).setStrokeStyle(2, 0x9ed5ef));
      baby.add(this.add.circle(-36, 18, 8, preset.skinColor));
      baby.add(this.add.circle(34, 14, 8, preset.skinColor));
      character.add(baby);
      this.tweens.add({ targets: baby, x: 10, angle: -5, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return;
    }

    if (preset.id === 'little-star') {
      const swing = this.add.container(0, -24);
      swing.add(this.add.line(0, 0, -32, -82, -16, 0, 0xffffff, 0.8).setOrigin(0).setLineWidth(3));
      swing.add(this.add.line(0, 0, 32, -82, 16, 0, 0xffffff, 0.8).setOrigin(0).setLineWidth(3));
      swing.add(this.add.rectangle(0, 8, 62, 9, 0xffd447).setStrokeStyle(2, 0x8c5a2b));
      this.drawFrontCharacter(swing, preset, 0, -16, 0.62);
      character.add(swing);
      this.tweens.add({ targets: swing, angle: { from: -9, to: 9 }, duration: 930, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return;
    }

    if (preset.id === 'ice-princess') {
      this.drawFrontCharacter(character, preset, 0, -18, 0.82);
      for (let i = 0; i < 4; i += 1) {
        const sparkle = this.add.star(-44 + i * 30, -76 + (i % 2) * 24, 4, 2, 6, 0xffffff, 0.92);
        character.add(sparkle);
        this.tweens.add({ targets: sparkle, alpha: 0.25, scale: 1.5, duration: 620 + i * 120, yoyo: true, repeat: -1 });
      }
      return;
    }

    if (preset.id === 'pudding') {
      const dancer = this.add.container(0, -6);
      this.drawFrontCharacter(dancer, preset, 0, -14, 0.76);
      character.add(dancer);
      this.tweens.add({ targets: dancer, angle: { from: -7, to: 7 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return;
    }

    const captain = this.add.container(0, -12);
    this.drawFrontCharacter(captain, preset, 0, -12, 0.76);
    const arm = this.add.rectangle(28, -62, 11, 42, preset.outfitColor).setOrigin(0.5, 1).setAngle(-48);
    captain.add(arm);
    character.add(captain);
    this.tweens.add({ targets: arm, angle: { from: -62, to: -34 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private drawLobbyImageScene(character: Phaser.GameObjects.Container, preset: CharacterPreset): void {
    const size = this.getLobbySpriteSize(preset);
    const shadow = this.add.ellipse(0, 38, size.shadowWidth, 18, 0x000000, 0.1).setDepth(-1);
    const sprite = this.add.image(0, 34, preset.lobbyAssetKey).setOrigin(0.5, 1).setDisplaySize(size.width, size.height);
    const actor = this.add.container(0, 0);
    actor.add(sprite);
    character.add(shadow);
    character.add(actor);

    if (preset.id === 'ice-princess' || preset.id === 'pudding') {
      for (let i = 0; i < 4; i += 1) {
        const sparkle = this.add.star(-44 + i * 30, -82 + (i % 2) * 22, 4, 2, 6, 0xffffff, 0.86);
        character.add(sparkle);
        this.tweens.add({ targets: sparkle, alpha: 0.24, scale: 1.35, duration: 900 + i * 140, yoyo: true, repeat: -1 });
      }
    }

    const idle = this.getLobbyIdleMotion(preset);
    this.tweens.add({ targets: actor, y: idle.y, angle: idle.angle, duration: idle.duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: shadow, scaleX: 0.94, alpha: 0.07, duration: idle.duration, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private getLobbySpriteSize(preset: CharacterPreset): { width: number; height: number; shadowWidth: number } {
    if (preset.id === 'baby-brother') {
      return { width: 116, height: 112, shadowWidth: 86 };
    }
    if (preset.id === 'ice-princess') {
      return { width: 104, height: 156, shadowWidth: 84 };
    }
    if (preset.id === 'pudding') {
      return { width: 112, height: 134, shadowWidth: 88 };
    }
    if (preset.id === 'little-star') {
      return { width: 104, height: 148, shadowWidth: 78 };
    }
    return { width: 100, height: 146, shadowWidth: 78 };
  }

  private getLobbyIdleMotion(preset: CharacterPreset): { y: number; angle: { from: number; to: number }; duration: number } {
    if (preset.id === 'baby-brother') {
      return { y: -3, angle: { from: -1.5, to: 1.5 }, duration: 1700 };
    }
    if (preset.id === 'air-captain') {
      return { y: -4, angle: { from: -1, to: 1.2 }, duration: 1550 };
    }
    if (preset.id === 'pudding') {
      return { y: -3, angle: { from: -1.2, to: 1.2 }, duration: 1650 };
    }
    return { y: -4, angle: { from: -0.8, to: 0.8 }, duration: 1800 };
  }

  private drawFrontCharacter(parent: Phaser.GameObjects.Container, preset: CharacterPreset, x: number, y: number, scale: number): void {
    const body = this.add.container(x, y).setScale(scale);
    body.add(this.add.ellipse(0, 54, 58, 14, 0x000000, 0.14));
    body.add(this.add.rectangle(-12, 34, 13, 36, preset.detailColor));
    body.add(this.add.rectangle(12, 34, 13, 36, preset.detailColor));
    body.add(this.add.rectangle(-12, 54, 20, 8, 0xffffff));
    body.add(this.add.rectangle(12, 54, 20, 8, 0xffffff));
    if (preset.style === 'pinkDress' || preset.style === 'iceDress') {
      body.add(this.add.triangle(0, 2, -32, 48, 32, 48, 0, -30, preset.outfitColor).setStrokeStyle(2, preset.detailColor, 0.7));
    } else {
      body.add(this.add.rectangle(0, 2, 50, 58, preset.outfitColor).setStrokeStyle(2, preset.detailColor, 0.7));
    }
    body.add(this.add.rectangle(0, -20, 42, 9, preset.accentColor));
    body.add(this.add.circle(0, -54, 26, preset.skinColor).setStrokeStyle(2, 0xe7a77e, 0.35));
    body.add(this.add.ellipse(0, -70, 48, 22, preset.hairColor));
    body.add(this.add.circle(-9, -56, 3, 0x17263a));
    body.add(this.add.circle(9, -56, 3, 0x17263a));
    body.add(this.add.arc(0, -47, 9, 20, 160, false, 0x8d4a35).setStrokeStyle(2, 0x8d4a35));
    body.add(this.add.rectangle(-32, 2, 12, 44, preset.skinColor).setAngle(16));
    body.add(this.add.rectangle(32, 2, 12, 44, preset.skinColor).setAngle(-16));
    if (preset.style === 'iceDress') {
      body.add(this.add.triangle(0, -88, -14, -70, 14, -70, 0, -98, 0xffffff).setStrokeStyle(2, 0x73c7ff));
    }
    if (preset.style === 'airUniform') {
      body.add(this.add.rectangle(0, -78, 48, 10, 0x27364a));
      body.add(this.add.rectangle(0, -84, 36, 10, preset.outfitColor));
    }
    parent.add(body);
  }

  private selectLobbyCharacter(index: number): void {
    const normalized = Phaser.Math.Wrap(index, 0, CHARACTER_PRESETS.length);
    this.selectedCharacterIndex = normalized;
    this.selection = { presetId: CHARACTER_PRESETS[normalized].id };
    this.emitLobbySelection();
    this.refreshSetup();
    this.redrawPlayer();
  }

  private addCharacterDetails(): void {
    const preset = CHARACTER_PRESETS[this.selectedCharacterIndex];
    const panel = this.add.container(GAME_WIDTH / 2, 598);
    panel.add(this.add.ellipse(0, 44, 292, 22, 0x1f3b2f, 0.1));
    panel.add(this.add.rectangle(0, 0, 330, 78, 0xffffff, 0.98).setStrokeStyle(3, 0xffd447, 0.9));
    panel.add(this.add.rectangle(0, -36, 330, 8, 0xfff1a8, 0.88));
    panel.add(
      this.add
        .text(-142, -22, preset.label, {
          ...TEXT_STYLE,
          color: '#17263a',
          fontSize: '21px',
          fontStyle: 'bold'
        })
        .setOrigin(0, 0.5)
    );
    panel.add(
      this.add
        .text(142, -22, preset.age, {
          ...TEXT_STYLE,
          color: '#466175',
          fontSize: '14px'
        })
        .setOrigin(1, 0.5)
    );
    panel.add(
      this.add
        .text(-142, 13, preset.description, {
          ...TEXT_STYLE,
          color: '#3f5e6c',
          fontSize: '14px',
          fontStyle: 'bold',
          wordWrap: { width: 284 }
        })
        .setOrigin(0, 0.5)
    );
    this.setupLayer.add(panel);
    this.tweens.add({
      targets: panel,
      y: 586,
      alpha: { from: 0, to: 1 },
      duration: 220,
      ease: 'Sine.easeOut'
    });
  }

  private createMapSelect(): void {
    this.emitScreen('map-select');
    if (this.textures.exists(ART_ASSETS.backgrounds.mapSelect.key)) {
      this.setupLayer.add(this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, ART_ASSETS.backgrounds.mapSelect.key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT));
      this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x8fd7ff, 0.16));
    } else {
      this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x8fd7ff));
    }
    this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, 610, GAME_WIDTH, 220, 0x74c973));
    this.setupLayer.add(
      this.add
        .text(GAME_WIDTH / 2, 48, '选择地图', {
          ...TEXT_STYLE,
          color: '#ffffff',
          fontSize: '28px',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setStroke('#2f80ed', 5)
    );

    const map = this.add.container(GAME_WIDTH / 2, 342);
    map.add(this.add.ellipse(0, 18, 332, 440, 0xeaf7ff, 0.96).setStrokeStyle(4, 0xffffff));
    map.add(this.add.ellipse(0, 28, 286, 386, 0xbde78a, 0.95));
    this.drawMapPath(map);
    this.setupLayer.add(map);

    const nodes = [
      { x: -78, y: -116, icon: '校', color: 0xcf5d45 },
      { x: 86, y: -52, icon: '商', color: 0xff87b7 },
      { x: -70, y: 50, icon: '园', color: 0x2f9e62 },
      { x: 84, y: 126, icon: '乐', color: 0x7a5cff }
    ];

    LEVEL_THEMES.forEach((theme, index) => {
      this.addMapNode(map, theme, index, nodes[index].x, nodes[index].y, nodes[index].icon, nodes[index].color);
    });

    const selectedTheme = LEVEL_THEMES[this.selectedThemeIndex];
    const panel = this.add.container(GAME_WIDTH / 2, 624);
    panel.add(this.add.rectangle(0, 0, 330, 86, 0xffffff, 0.94).setStrokeStyle(3, 0xffd447));
    panel.add(
      this.add
        .text(-136, -18, selectedTheme.label, {
          ...TEXT_STYLE,
          fontSize: '22px',
          fontStyle: 'bold'
        })
        .setOrigin(0, 0.5)
    );
    panel.add(
      this.add
        .text(-136, 20, '点击地图地点选择关卡', {
          ...TEXT_STYLE,
          color: '#527084',
          fontSize: '15px'
        })
        .setOrigin(0, 0.5)
    );
    this.setupLayer.add(panel);
    this.setupLayer.add(this.createButton(86, 696, 116, 44, '返回', 0xdff2fb, () => {
      this.setupStep = 'character';
      this.refreshSetup();
    }));
    this.setupLayer.add(this.createButton(276, 696, 168, 44, '开始酷跑', 0xffd447, () => this.startRun()));
  }

  private drawMapPath(map: Phaser.GameObjects.Container): void {
    const path = this.add.graphics();
    path.lineStyle(10, 0xffffff, 0.7);
    path.beginPath();
    path.moveTo(-78, -116);
    path.lineTo(86, -52);
    path.lineTo(-70, 50);
    path.lineTo(84, 126);
    path.strokePath();
    path.lineStyle(4, 0xffd447, 0.85);
    path.beginPath();
    path.moveTo(-78, -116);
    path.lineTo(86, -52);
    path.lineTo(-70, 50);
    path.lineTo(84, 126);
    path.strokePath();
    map.add(path);
  }

  private addMapNode(
    map: Phaser.GameObjects.Container,
    theme: LevelTheme,
    index: number,
    x: number,
    y: number,
    icon: string,
    color: number
  ): void {
    const selected = index === this.selectedThemeIndex;
    const node = this.add.container(x, y).setScale(selected ? 1.18 : 1);
    node.add(this.add.ellipse(0, 34, 76, 18, 0x000000, 0.16));
    if (selected) {
      node.add(this.add.circle(0, 0, 44, 0xffd447, 0.28).setStrokeStyle(4, 0xffd447));
    }
    node.add(this.add.rectangle(0, 8, 64, 58, 0xffffff).setStrokeStyle(3, color));
    node.add(this.add.rectangle(0, -28, 72, 18, color));
    const finalThumbnail = ART_ASSETS.mapThumbnails[theme.id];
    const fallbackThumbnail = OPEN_ASSETS.backgrounds[theme.id];
    const thumbnailKey = this.textures.exists(finalThumbnail.key) ? finalThumbnail.key : fallbackThumbnail.key;
    if (this.textures.exists(thumbnailKey)) {
      node.add(this.add.image(0, 8, thumbnailKey).setDisplaySize(58, 44).setAlpha(0.82));
    }
    node.add(
      this.add
        .text(0, 4, icon, {
          ...TEXT_STYLE,
          color: this.toHexColor(color),
          fontSize: '24px',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );
    node.add(
      this.add
        .text(0, 52, theme.label, {
          ...TEXT_STYLE,
          color: '#17263a',
          fontSize: '14px',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );
    node.setInteractive(new Phaser.Geom.Circle(0, 0, 52), Phaser.Geom.Circle.Contains);
    node.on('pointerup', () => {
      this.selectedThemeIndex = index;
      this.currentTheme = LEVEL_THEMES[index];
      this.drawWorld();
      this.refreshSetup();
    });
    map.add(node);

    if (selected) {
      this.tweens.add({
        targets: node,
        y: y - 6,
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  private createResultLayer(): void {
    this.resultLayer = this.add.container(0, 0).setVisible(false);
  }

  private createOverlayLayer(): void {
    this.overlayLayer = this.add.container(0, 0).setVisible(false);
  }

  private refreshSetup(): void {
    this.setupLayer.destroy(true);
    this.createSetupLayer();
  }

  private createIconButton(
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, color, 1).setStrokeStyle(2, 0x152238, 0.2);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', onClick);
    button.add(bg);
    return button;
  }

  private addGestureIcon(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    direction: 'left' | 'right' | 'up' | 'down'
  ): void {
    const icon = this.add.container(x, y);
    icon.add(this.add.circle(0, 0, 15, 0xffffff, 0.22).setStrokeStyle(2, 0xffffff, 0.72));

    if (direction === 'left' || direction === 'right') {
      const sign = direction === 'left' ? -1 : 1;
      icon.add(this.add.rectangle(-4 * sign, 0, 15, 5, 0xffffff));
      icon.add(this.add.triangle(8 * sign, 0, -5 * sign, -8, -5 * sign, 8, 7 * sign, 0, 0xffffff));
    } else {
      const sign = direction === 'up' ? -1 : 1;
      icon.add(this.add.rectangle(0, -4 * sign, 5, 15, 0xffffff));
      icon.add(this.add.triangle(0, 8 * sign, -8, -5 * sign, 8, -5 * sign, 0, 7 * sign, 0xffffff));
    }

    parent.add(icon);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, color, 1).setStrokeStyle(2, 0x152238, 0.2);
    const text = this.add
      .text(0, 0, label, {
        ...TEXT_STYLE,
        fontSize: width > 100 ? '18px' : '13px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', onClick);
    button.add([bg, text]);
    return button;
  }

  private createPlayer(): Phaser.GameObjects.Container {
    const player = this.add.container(0, 0);
    this.drawPlayerParts(player);
    return player;
  }

  private redrawPlayer(): void {
    this.stopRunAnimation();
    this.player.removeAll(true);
    this.drawPlayerParts(this.player);
    if (this.state === 'running' && this.pose === 'run') {
      this.startRunAnimation();
    }
  }

  private drawPlayerParts(player: Phaser.GameObjects.Container): void {
    const visual = this.add.container(0, 0);
    this.layeredBabyRig = undefined;
    this.drawCharacterParts(visual, resolveSelection(this.selection));
    player.add(visual);
    this.playerVisual = visual;
  }

  private drawCharacterParts(player: Phaser.GameObjects.Container, preset: CharacterPreset): void {
    if (preset.id === 'baby-brother') {
      this.drawLayeredBabyRunner(player, preset);
      return;
    }

    if (this.textures.exists(preset.assetKey)) {
      player.add(this.add.ellipse(0, 8, 70, 18, 0x000000, 0.14));
      player.add(this.add.image(0, 20, preset.assetKey).setOrigin(0.5, 1).setDisplaySize(108, 162));
      return;
    }

    player.add(this.add.ellipse(0, 8, 62, 16, 0x000000, 0.18));
    player.add(this.add.rectangle(-11, -12, 14, 34, preset.detailColor));
    player.add(this.add.rectangle(11, -12, 14, 34, preset.detailColor));
    player.add(this.add.rectangle(-13, 6, 22, 8, 0xffffff));
    player.add(this.add.rectangle(13, 6, 22, 8, 0xffffff));

    if (preset.style === 'pinkDress' || preset.style === 'iceDress') {
      player.add(this.add.triangle(0, -36, -30, 20, 30, 20, 0, -52, preset.outfitColor));
    } else {
      player.add(this.add.rectangle(0, -48, 48, 56, preset.outfitColor));
    }

    player.add(this.add.rectangle(0, -63, 42, 8, preset.accentColor));
    player.add(this.add.star(0, -44, 5, 4, 9, preset.detailColor));
    player.add(this.add.circle(0, -88, 24, preset.skinColor));
    player.add(this.add.rectangle(0, -104, 44, 14, preset.hairColor));
    player.add(this.add.circle(-8, -90, 3, 0x17263a));
    player.add(this.add.circle(8, -90, 3, 0x17263a));
    player.add(this.add.arc(0, -84, 9, 20, 160, false, 0x8d4a35).setStrokeStyle(2, 0x8d4a35));

    if (preset.style === 'aviatorBaby') {
      player.add(this.add.ellipse(-12, -104, 23, 15, 0xd9edf4).setStrokeStyle(3, preset.detailColor));
      player.add(this.add.ellipse(12, -104, 23, 15, 0xd9edf4).setStrokeStyle(3, preset.detailColor));
    }
  }

  private drawLayeredBabyRunner(player: Phaser.GameObjects.Container, preset: CharacterPreset): void {
    if (this.textures.exists(preset.assetKey)) {
      player.add(this.add.ellipse(0, 22, 76, 18, 0x000000, 0.16));
      player.add(this.add.image(0, 20, preset.assetKey).setOrigin(0.5, 1).setDisplaySize(86, 129));
      this.layeredBabyRig = undefined;
      return;
    }

    const skin = preset.skinColor;
    const diaper = 0xffffff;
    const diaperLine = 0xbfd7e6;
    const pacifierBlue = 0x65c7f7;
    const bonnet = 0xdfeeee;
    const goggle = 0x2d3135;

    player.add(this.add.ellipse(0, 24, 72, 18, 0x000000, 0.14));

    const farSkin = 0xf0ad8b;
    const leftArm = this.add.container(-24, -48);
    leftArm.add(this.add.ellipse(0, 15, 13, 36, farSkin).setStrokeStyle(2, 0xd99173, 0.42));
    leftArm.add(this.add.ellipse(-2, 35, 19, 12, skin).setStrokeStyle(2, 0xf4b58f, 0.5));
    leftArm.setAngle(28);

    const rightArm = this.add.container(24, -48);
    rightArm.add(this.add.ellipse(0, 15, 13, 36, farSkin).setStrokeStyle(2, 0xd99173, 0.42));
    rightArm.add(this.add.ellipse(2, 35, 19, 12, skin).setStrokeStyle(2, 0xf4b58f, 0.5));
    rightArm.setAngle(-28);

    const leftLeg = this.add.container(-18, 0);
    leftLeg.add(this.add.ellipse(0, 0, 15, 28, skin).setStrokeStyle(2, 0xf4b58f, 0.48));
    leftLeg.add(this.add.ellipse(-2, 21, 24, 12, 0xffd2bc).setStrokeStyle(2, 0xf4b58f, 0.42));
    leftLeg.setAngle(-22);

    const rightLeg = this.add.container(18, 0);
    rightLeg.add(this.add.ellipse(0, 0, 15, 28, skin).setStrokeStyle(2, 0xf4b58f, 0.48));
    rightLeg.add(this.add.ellipse(2, 21, 24, 12, 0xffd2bc).setStrokeStyle(2, 0xf4b58f, 0.42));
    rightLeg.setAngle(22);

    const body = this.add.container(0, -28);
    body.add(this.add.ellipse(0, -10, 46, 34, skin).setStrokeStyle(2, 0xf3b590, 0.34));
    body.add(this.add.ellipse(0, 14, 56, 30, diaper).setStrokeStyle(3, diaperLine));
    body.add(this.add.arc(-12, 12, 12, 205, 345, false, diaperLine, 0.45).setStrokeStyle(2, diaperLine, 0.68));
    body.add(this.add.arc(12, 12, 12, 195, 335, false, diaperLine, 0.45).setStrokeStyle(2, diaperLine, 0.68));
    body.add(this.add.line(0, 0, -21, 5, 21, 5, diaperLine, 0.46).setLineWidth(2));
    body.add(this.add.circle(0, 15, 3, 0xaee6ff, 0.72));
    body.setScale(1, 0.72);

    const head = this.add.container(0, -65);
    head.add(this.add.circle(0, 6, 23, skin).setStrokeStyle(2, 0xf4b58f, 0.32));
    head.add(this.add.ellipse(0, -1, 46, 40, bonnet).setStrokeStyle(2, 0xb8c8c6));
    head.add(this.add.arc(0, 15, 16, 205, 335, false, 0xb8c8c6, 0.55).setStrokeStyle(2, 0xb8c8c6));
    head.add(this.add.rectangle(0, -18, 31, 6, 0x8c9799, 0.85));
    head.add(this.add.circle(-9, -21, 7, goggle, 0.78).setStrokeStyle(2, 0xffffff));
    head.add(this.add.circle(9, -21, 7, goggle, 0.78).setStrokeStyle(2, 0xffffff));

    const pacifier = this.add.container(25, -55);
    pacifier.add(this.add.line(0, 0, -13, -3, -4, 7, 0x9ed5ef, 0.72).setOrigin(0));
    pacifier.add(this.add.circle(0, 0, 7, pacifierBlue).setStrokeStyle(2, 0xffffff));
    pacifier.add(this.add.rectangle(0, 0, 13, 5, 0xffffff, 0.8));
    pacifier.add(this.add.circle(0, 0, 3, 0x2f80ed));

    player.add([leftLeg, rightLeg, body, leftArm, rightArm, head, pacifier]);
    this.layeredBabyRig = { head, body, leftArm, rightArm, leftLeg, rightLeg, pacifier };
  }

  private bindControls(): void {
    bindSwipeInput(this, (direction) => this.handleGesture(direction));
    const cursors = this.input.keyboard?.createCursorKeys();

    cursors?.left.on('down', () => this.handleGesture('left'));
    cursors?.right.on('down', () => this.handleGesture('right'));
    cursors?.up.on('down', () => this.handleGesture('up'));
    cursors?.down.on('down', () => this.handleGesture('down'));
  }

  private handleGesture(direction: Exclude<GestureDirection, 'none'>): void {
    if (this.state !== 'running') {
      return;
    }

    if (direction === 'left' || direction === 'right') {
      this.currentLane = nextLane(this.currentLane, direction === 'left' ? -1 : 1);
      this.tweens.add({
        targets: this.player,
        x: getLaneX(this.currentLane),
        duration: 130,
        ease: 'Sine.easeOut'
      });
      this.emitRunnerState();
      return;
    }

    if (direction === 'up') {
      this.setPose('jump', JUMP_DURATION_MS);
      this.tweens.add({
        targets: this.player,
        y: PLAYER_Y - 92,
        yoyo: true,
        duration: JUMP_DURATION_MS / 2,
        ease: 'Sine.easeOut',
        onComplete: () => this.player.setY(PLAYER_Y)
      });
    }

    if (direction === 'down') {
      const poseTarget = this.playerVisual ?? this.player;
      this.setPose('slide', SLIDE_DURATION_MS);
      this.tweens.add({
        targets: poseTarget,
        scaleX: 1.12,
        scaleY: 0.68,
        angle: -8,
        yoyo: true,
        duration: SLIDE_DURATION_MS / 2,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          poseTarget.setScale(1);
          poseTarget.setAngle(0);
        }
      });
    }
  }

  private setPose(pose: RunnerPose, duration: number): void {
    this.pose = pose;
    this.emitRunnerState();
    this.stopRunAnimation();

    if (pose === 'jump') {
      this.tweens.add({
        targets: this.playerVisual,
        angle: 10,
        scaleX: 0.96,
        scaleY: 1.05,
        yoyo: true,
        duration: duration / 2,
        ease: 'Sine.easeOut'
      });
    }

    this.poseTimer?.remove(false);
    this.poseTimer = this.time.delayedCall(duration, () => {
      this.pose = 'run';
      this.emitRunnerState();
      if (this.state === 'running') {
        this.startRunAnimation();
      }
    });
  }

  private startRunAnimation(): void {
    if (!this.playerVisual || this.runTweens.length > 0) {
      return;
    }

    this.playerVisual.setPosition(0, 0).setScale(1).setAngle(0);
    this.runTweens = [
      this.tweens.add({
        targets: this.playerVisual,
        y: -8,
        scaleX: 1.03,
        scaleY: 0.98,
        duration: 150,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      }),
      this.tweens.add({
        targets: this.playerVisual,
        angle: { from: -4, to: 4 },
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
    ];

    if (this.layeredBabyRig) {
      const rig = this.layeredBabyRig;
      this.runTweens.push(
        this.tweens.add({
          targets: rig.leftArm,
          angle: { from: 20, to: 34 },
          y: { from: -55, to: -43 },
          scaleY: { from: 1.08, to: 0.92 },
          duration: 240,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        }),
        this.tweens.add({
          targets: rig.rightLeg,
          angle: { from: 14, to: 28 },
          y: { from: -6, to: 7 },
          scaleY: { from: 0.94, to: 1.08 },
          duration: 240,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        }),
        this.tweens.add({
          targets: rig.rightArm,
          angle: { from: -34, to: -20 },
          y: { from: -43, to: -55 },
          scaleY: { from: 0.92, to: 1.08 },
          duration: 240,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        }),
        this.tweens.add({
          targets: rig.leftLeg,
          angle: { from: -28, to: -14 },
          y: { from: 7, to: -6 },
          scaleY: { from: 1.08, to: 0.94 },
          duration: 240,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        }),
        this.tweens.add({
          targets: rig.body,
          y: { from: -27, to: -31 },
          scaleX: { from: 1.02, to: 0.98 },
          scaleY: { from: 0.7, to: 0.75 },
          duration: 240,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        }),
        this.tweens.add({
          targets: [rig.head, rig.pacifier],
          y: '-=3',
          angle: { from: -2, to: 2 },
          duration: 280,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        })
      );
    }
  }

  private stopRunAnimation(): void {
    this.runTweens.forEach((tween) => tween.stop());
    this.runTweens = [];
    this.playerVisual?.setPosition(0, 0).setScale(1).setAngle(0);
    if (this.layeredBabyRig) {
      this.layeredBabyRig.leftArm.setPosition(-24, -48).setScale(1).setAngle(28);
      this.layeredBabyRig.rightArm.setPosition(24, -48).setScale(1).setAngle(-28);
      this.layeredBabyRig.leftLeg.setPosition(-18, 0).setScale(1).setAngle(-22);
      this.layeredBabyRig.rightLeg.setPosition(18, 0).setScale(1).setAngle(22);
      this.layeredBabyRig.body.setPosition(0, -28).setScale(1, 0.72).setAngle(0);
      this.layeredBabyRig.head.setPosition(0, -65).setScale(1).setAngle(0);
      this.layeredBabyRig.pacifier.setPosition(25, -55).setScale(1).setAngle(0);
    }
  }

  private enterSetup(): void {
    this.state = 'setup';
    this.stopThemeMusic();
    this.overlayLayer.setVisible(false);
    this.setupLayer.setVisible(true);
    this.resultLayer.setVisible(false);
    this.hudLayer.setVisible(false);
    this.player.setVisible(true);
    this.player.setAlpha(1);
    this.player.setPosition(getLaneX(1), PLAYER_Y);
    this.stopRunAnimation();
  }

  private startRun(): void {
    this.emitScreen('running');
    this.state = 'running';
    this.setupLayer.setVisible(false);
    this.resultLayer.setVisible(false);
    this.hudLayer.setVisible(true);
    this.currentLane = 1;
    this.healthState = createHealthState();
    this.currentTheme = LEVEL_THEMES[this.selectedThemeIndex];
    this.collectibleConfig = this.currentTheme.collectible;
    this.refreshCollectibleHudIcon();
    this.distanceMeters = 0;
    this.collectiblesCollected = 0;
    this.runStartedAt = this.time.now;
    this.nextSpawnAt = this.time.now + 600;
    this.pose = 'run';
    this.player
      .setVisible(true)
      .setPosition(getLaneX(this.currentLane), PLAYER_Y)
      .setScale(1)
      .setAlpha(1);
    this.playerVisual?.setPosition(0, 0).setScale(1).setAngle(0);
    this.startRunAnimation();
    this.emitRunnerState();
    this.drawWorld();
    this.switchThemeMusic(this.currentTheme);
    this.clearObjects();
    this.updateHud();
    if (!this.hasSeenTutorial) {
      this.hasSeenTutorial = true;
      this.pauseRun(
        '\u65b0\u624b\u5f15\u5bfc',
        '\u5de6\u53f3\u6ed1\u52a8\u6362\u8dd1\u9053\n\u4e0a\u6ed1\u8df3\u8dc3\uff0c\u4e0b\u6ed1\u6ed1\u884c\n\u78b0\u5230\u969c\u788d\u4f1a\u5148\u6263\u751f\u547d'
      );
    }
  }

  private pauseRun(title = '\u6682\u505c', body = '\u4f11\u606f\u4e00\u4e0b\uff0c\u51c6\u5907\u597d\u518d\u7ee7\u7eed\u9177\u8dd1'): void {
    if (this.state !== 'running') {
      return;
    }

    this.state = 'paused';
    this.pausedAt = this.time.now;
    this.emitRunnerState();
    this.stopRunAnimation();
    this.stopThemeMusic();
    this.showOverlay(title, body);
  }

  private resumeRun(): void {
    if (this.state !== 'paused') {
      return;
    }

    const pausedDuration = this.time.now - this.pausedAt;
    this.runStartedAt += pausedDuration;
    this.nextSpawnAt += pausedDuration;
    this.state = 'running';
    this.emitRunnerState();
    this.overlayLayer.setVisible(false);
    if (this.pose === 'run') {
      this.startRunAnimation();
    }
    this.switchThemeMusic(this.currentTheme);
  }

  private showOverlay(title: string, body: string): void {
    this.overlayLayer.destroy(true);
    this.overlayLayer = this.add.container(0, 0).setVisible(true);
    this.overlayLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x17263a, 0.42));
    this.overlayLayer.add(this.add.rectangle(GAME_WIDTH / 2, 360, 318, 248, 0xffffff, 0.96).setStrokeStyle(3, 0xffd447));
    this.overlayLayer.add(
      this.add
        .text(GAME_WIDTH / 2, 290, title, {
          ...TEXT_STYLE,
          color: '#17263a',
          fontSize: '26px',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );
    this.overlayLayer.add(
      this.add
        .text(GAME_WIDTH / 2, 352, body, {
          ...TEXT_STYLE,
          color: '#527084',
          fontSize: '17px',
          align: 'center',
          lineSpacing: 8
        })
        .setOrigin(0.5)
    );
    this.overlayLayer.add(this.createButton(GAME_WIDTH / 2, 444, 210, 50, '\u7ee7\u7eed\u9177\u8dd1', 0x7ed957, () => this.resumeRun()));
  }

  private spawnPattern(): void {
    const lane = Phaser.Math.Between(0, 2) as LaneIndex;
    const roll = Phaser.Math.Between(0, 9);

    if (roll < 6) {
      this.spawnObstacle(lane, roll < 3 ? 'block' : 'bar');
      this.spawnCollectibleTrail(((lane + Phaser.Math.Between(1, 2)) % 3) as LaneIndex);
      return;
    }

    this.spawnCollectibleTrail(lane);
  }

  private spawnObstacle(lane: LaneIndex, kind: ObstacleKind): void {
    const themeObstacle = Phaser.Utils.Array.GetRandom(this.currentTheme.obstacles) as ThemeObstacle;
    const obstacle = this.add.container(getLaneX(lane), 128) as Obstacle;
    obstacle.kind = kind;
    obstacle.setScale(0.62);
    this.drawObstacle(obstacle, themeObstacle, kind);
    this.physics.add.existing(obstacle);
    obstacle.body.setSize(kind === 'block' ? 64 : 84, kind === 'block' ? 54 : 32);
    obstacle.body.setOffset(kind === 'block' ? -32 : -42, kind === 'block' ? -27 : -16);
    obstacle.body.setAllowGravity(false);
    obstacle.body.setImmovable(true);
    this.obstacles.add(obstacle);
  }

  private drawObstacle(obstacle: Phaser.GameObjects.Container, themeObstacle: ThemeObstacle, kind: ObstacleKind): void {
    obstacle.add(this.add.ellipse(0, kind === 'block' ? 24 : 25, kind === 'block' ? 70 : 92, 12, 0x000000, 0.16));
    this.drawActionCue(obstacle, kind);

    if (themeObstacle.shape === 'schoolRail') {
      const railY = kind === 'block' ? 6 : -30;
      this.addBeveledPanel(obstacle, 0, railY + 16, 94, 42, 10, 0x2f80ed, 0x1d5e9f);
      obstacle.add(this.add.rectangle(0, railY, 88, 10, 0xffd447).setStrokeStyle(2, 0x8c5a2b));
      obstacle.add(this.add.rectangle(0, railY + 28, 88, 8, 0x2f80ed));
      for (let x = -34; x <= 34; x += 17) {
        obstacle.add(this.add.rectangle(x, railY + 15, 7, 34, 0xffffff).setStrokeStyle(2, 0x2f80ed));
      }
      return;
    }

    if (themeObstacle.shape === 'schoolBag') {
      if (kind === 'bar') {
        this.addBeveledPanel(obstacle, 0, -10, 96, 38, 10, 0xffd447, 0xb85a5a);
        obstacle.add(this.add.rectangle(0, -24, 88, 18, 0xffd447).setStrokeStyle(3, 0x9a2d3a));
        obstacle.add(this.add.rectangle(-34, 0, 9, 44, 0xffffff).setStrokeStyle(2, 0xff6b6b));
        obstacle.add(this.add.rectangle(34, 0, 9, 44, 0xffffff).setStrokeStyle(2, 0xff6b6b));
        obstacle.add(this.add.star(0, -24, 5, 4, 8, 0xff6b6b));
        return;
      }
      this.addBeveledPanel(obstacle, 0, 7, 60, 48, 10, themeObstacle.color, 0xa63b48);
      obstacle.add(this.add.rectangle(0, 4, 54, 48, themeObstacle.color).setStrokeStyle(3, 0x9a2d3a));
      obstacle.add(this.add.arc(0, -16, 28, 180, 360, false, 0xffb3b3).setStrokeStyle(5, 0xffb3b3));
      obstacle.add(this.add.rectangle(0, 8, 34, 16, themeObstacle.accentColor, 0.95).setStrokeStyle(2, 0xffd447));
      obstacle.add(this.add.star(0, 8, 5, 4, 8, 0xffd447));
      return;
    }

    if (themeObstacle.shape === 'cart') {
      if (kind === 'bar') {
        this.addBeveledPanel(obstacle, 0, -8, 96, 38, 10, 0xffffff, 0xc86095);
        obstacle.add(this.add.rectangle(0, -22, 88, 16, 0xffffff).setStrokeStyle(3, 0xff87b7));
        obstacle.add(this.add.rectangle(-36, 4, 8, 44, 0xff87b7));
        obstacle.add(this.add.rectangle(36, 4, 8, 44, 0xff87b7));
        obstacle.add(this.add.circle(-30, 28, 6, 0x6a5b7c));
        obstacle.add(this.add.circle(30, 28, 6, 0x6a5b7c));
        return;
      }
      this.addBeveledPanel(obstacle, 0, 3, 74, 34, 9, 0xffffff, 0xc86095);
      obstacle.add(this.add.rectangle(0, -2, 66, 30, 0xffffff).setStrokeStyle(3, 0xff87b7));
      obstacle.add(this.add.line(0, 0, -42, -20, -26, -2, 0xff87b7).setOrigin(0).setLineWidth(4));
      obstacle.add(this.add.line(0, 0, 34, -18, 48, -24, 0xff87b7).setOrigin(0).setLineWidth(4));
      obstacle.add(this.add.circle(-22, 20, 7, 0x6a5b7c));
      obstacle.add(this.add.circle(24, 20, 7, 0x6a5b7c));
      return;
    }

    if (themeObstacle.shape === 'shopStand') {
      if (kind === 'bar') {
        this.addBeveledPanel(obstacle, 0, -13, 102, 34, 9, 0xff87b7, 0xb8497a);
        obstacle.add(this.add.rectangle(0, -26, 94, 18, 0xff87b7).setStrokeStyle(3, 0xe85d5d));
        obstacle.add(this.add.rectangle(-38, 4, 9, 48, 0xfff1a8).setStrokeStyle(2, 0xe85d5d));
        obstacle.add(this.add.rectangle(38, 4, 9, 48, 0xfff1a8).setStrokeStyle(2, 0xe85d5d));
        obstacle.add(this.add.circle(-16, -26, 6, 0xffffff));
        obstacle.add(this.add.circle(16, -26, 6, 0xffd447));
        return;
      }
      this.addBeveledPanel(obstacle, 0, 11, 72, 34, 9, 0xfff1a8, 0xd78b3d);
      obstacle.add(this.add.rectangle(0, 9, 66, 34, 0xfff1a8).setStrokeStyle(3, 0xe85d5d));
      obstacle.add(this.add.triangle(0, -18, -42, 0, 42, 0, 0, -24, 0xff87b7).setStrokeStyle(2, 0xe85d5d));
      obstacle.add(this.add.circle(-18, 8, 6, 0xff5a76));
      obstacle.add(this.add.circle(0, 8, 6, 0xffffff));
      obstacle.add(this.add.circle(18, 8, 6, 0xffd447));
      return;
    }

    if (themeObstacle.shape === 'woodFence') {
      const fenceY = kind === 'block' ? 0 : -32;
      this.addBeveledPanel(obstacle, 0, fenceY + 13, 92, 42, 10, 0x9a6a38, 0x6f451f);
      obstacle.add(this.add.rectangle(0, fenceY, 86, 10, 0xffe2a8).setStrokeStyle(2, 0x8c5a2b));
      obstacle.add(this.add.rectangle(0, fenceY + 22, 86, 10, 0xffe2a8).setStrokeStyle(2, 0x8c5a2b));
      for (let x = -32; x <= 32; x += 16) {
        obstacle.add(this.add.rectangle(x, fenceY + 10, 9, 42, 0x9a6a38).setStrokeStyle(2, 0x6f451f));
      }
      return;
    }

    if (themeObstacle.shape === 'bush') {
      if (kind === 'bar') {
        this.addBeveledPanel(obstacle, 0, -11, 96, 42, 10, 0x2f9e62, 0x1f6d3f);
        obstacle.add(this.add.rectangle(0, -28, 88, 16, 0x2b7a45).setStrokeStyle(2, 0xc6f7b2));
        obstacle.add(this.add.rectangle(-36, 4, 8, 48, 0x2b7a45));
        obstacle.add(this.add.rectangle(36, 4, 8, 48, 0x2b7a45));
        for (let x = -24; x <= 24; x += 16) {
          obstacle.add(this.add.circle(x, -32, 14, 0x2f9e62).setStrokeStyle(2, 0xc6f7b2));
        }
        return;
      }
      this.addBeveledPanel(obstacle, 0, 24, 78, 22, 8, 0x2b7a45, 0x1f6d3f);
      for (let x = -28; x <= 28; x += 14) {
        obstacle.add(this.add.circle(x, 6 - Math.abs(x) / 8, 18, 0x2f9e62).setStrokeStyle(2, 0xc6f7b2));
      }
      obstacle.add(this.add.rectangle(0, 24, 70, 15, 0x2b7a45));
      return;
    }

    if (themeObstacle.shape === 'parkGate') {
      if (kind === 'block') {
        this.addBeveledPanel(obstacle, 0, 13, 78, 44, 10, 0x7a5cff, 0x49359e);
        obstacle.add(this.add.rectangle(0, 10, 70, 42, 0x7a5cff).setStrokeStyle(3, 0xffffff));
        obstacle.add(this.add.star(0, 8, 5, 5, 14, 0xffd447));
        return;
      }
      obstacle.add(this.add.arc(0, 16, 40, 180, 360, false, themeObstacle.color).setStrokeStyle(8, themeObstacle.color));
      obstacle.add(this.add.rectangle(-34, 14, 9, 42, 0xffffff).setStrokeStyle(2, themeObstacle.color));
      obstacle.add(this.add.rectangle(34, 14, 9, 42, 0xffffff).setStrokeStyle(2, themeObstacle.color));
      obstacle.add(this.add.star(0, -20, 5, 5, 12, 0xffd447));
      return;
    }

    for (let i = 0; i < 5; i += 1) {
      const x = -32 + i * 16;
      const color = i % 2 === 0 ? 0xff5a76 : 0xffd447;
      obstacle.add(this.add.line(0, 0, x, 20, x, -10, 0xffffff, 0.8).setOrigin(0).setLineWidth(2));
      obstacle.add(this.add.circle(x, -18, 11, color).setStrokeStyle(2, 0xffffff));
    }
  }

  private addBeveledPanel(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number,
    color: number,
    sideColor: number
  ): void {
    const panel = this.add.graphics();
    const half = width / 2;
    const top = y - height / 2;
    const bottom = y + height / 2;
    panel.fillStyle(sideColor, 0.95);
    panel.fillPoints(
      [
        new Phaser.Geom.Point(x - half, bottom),
        new Phaser.Geom.Point(x + half, bottom),
        new Phaser.Geom.Point(x + half - depth, bottom + depth),
        new Phaser.Geom.Point(x - half - depth, bottom + depth)
      ],
      true
    );
    panel.fillStyle(0xffffff, 0.28);
    panel.fillPoints(
      [
        new Phaser.Geom.Point(x - half, top),
        new Phaser.Geom.Point(x + half, top),
        new Phaser.Geom.Point(x + half - depth, top - depth),
        new Phaser.Geom.Point(x - half - depth, top - depth)
      ],
      true
    );
    panel.fillStyle(color, 0.16);
    panel.fillRoundedRect(x - half, top, width, height, 8);
    parent.add(panel);
  }

  private drawActionCue(obstacle: Phaser.GameObjects.Container, kind: ObstacleKind): void {
    const cueY = kind === 'block' ? -44 : 36;
    const cueColor = kind === 'block' ? 0x7ed957 : 0x65c7f7;
    const cue = this.add.container(0, cueY);
    cue.add(this.add.circle(0, 0, 18, cueColor, 0.95).setStrokeStyle(3, 0xffffff));

    if (kind === 'block') {
      cue.add(this.add.triangle(0, -3, -8, 6, 8, 6, 0, -9, 0xffffff));
      cue.add(this.add.rectangle(0, 7, 6, 11, 0xffffff));
    } else {
      cue.add(this.add.rectangle(0, -7, 6, 11, 0xffffff));
      cue.add(this.add.triangle(0, 6, -8, -3, 8, -3, 0, 10, 0xffffff));
    }

    obstacle.add(cue);
  }

  private spawnCollectibleTrail(lane: LaneIndex): void {
    const count = Phaser.Math.Between(6, 9);
    for (let i = 0; i < count; i += 1) {
      const y = 96 - i * 42;
      const laneOffset = Math.sin(i * 0.7) * 8;
      this.spawnCollectibleAt(getLaneX(lane) + laneOffset, y);
    }
  }

  private spawnCollectibleAt(x: number, y: number): void {
    const collectible = this.add.container(x, y) as Collectible;
    collectible.collectibleId = this.collectibleConfig.id;
    collectible.add(this.createCollectibleIcon(0, 0, 1, this.collectibleConfig));
    collectible.setScale(0.48);
    this.physics.add.existing(collectible);
    collectible.body.setAllowGravity(false);
    collectible.body.setSize(46, 46);
    collectible.body.setOffset(-23, -23);
    this.collectibles.add(collectible);
  }

  private moveObjects(delta: number, speed: number): void {
    const moveY = (speed * delta) / 1000;
    this.obstacles.children.each((child) => {
      const obstacle = child as Obstacle;
      obstacle.y += moveY;
      obstacle.setScale(Math.min(1.35, obstacle.scale + delta / 7600));
      if (obstacle.y > GAME_HEIGHT + 60) {
        obstacle.destroy();
      }
      return true;
    });

    this.collectibles.children.each((child) => {
      const collectible = child as Collectible;
      collectible.y += moveY;
      collectible.rotation += delta / 260;
      collectible.setScale(Math.min(1.2, collectible.scale + delta / 9000));
      if (collectible.y > GAME_HEIGHT + 40) {
        collectible.destroy();
      }
      return true;
    });
  }

  private collectItem(collectible: Collectible): void {
    if (this.state !== 'running') {
      return;
    }

    this.collectiblesCollected += 1;
    collectible.destroy();
  }

  private hitObstacle(obstacle: Obstacle): void {
    if (this.state !== 'running') {
      return;
    }

    const avoided = (obstacle.kind === 'block' && this.pose === 'jump') || (obstacle.kind === 'bar' && this.pose === 'slide');
    if (avoided) {
      return;
    }

    const previousHealth = this.healthState.current;
    this.healthState = applyDamage(this.healthState, this.time.now);

    if (this.healthState.current === previousHealth || obstacle.damageHandled) {
      return;
    }

    obstacle.damageHandled = true;
    obstacle.destroy();
    this.emitRunnerState();
    this.playHitFeedback();
    this.updateHud();

    if (isDefeated(this.healthState)) {
      this.endRun();
    }
  }

  private playHitFeedback(): void {
    this.playHitSound();
    this.cameras.main.shake(140, 0.006);
    this.tweens.add({
      targets: this.player,
      x: this.player.x + (this.player.x < GAME_WIDTH / 2 ? 16 : -16),
      yoyo: true,
      duration: 70,
      repeat: 1,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: this.player,
      alpha: 0.35,
      yoyo: true,
      duration: 110,
      repeat: 5,
      onComplete: () => this.player.setAlpha(1)
    });
  }

  private switchThemeMusic(theme: LevelTheme): void {
    if (this.activeMusicKey === theme.musicKey) {
      return;
    }

    this.stopThemeMusic();
    this.activeMusicKey = theme.musicKey;
    const audioContext = this.getAudioContext();
    if (!audioContext) {
      return;
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = theme.id === 'mall' || theme.id === 'amusement' ? 'triangle' : 'sine';
    oscillator.frequency.value = this.getThemeFrequency(theme);
    gain.gain.value = 0.025;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    this.musicOscillator = oscillator;
    this.musicGain = gain;
  }

  private stopThemeMusic(): void {
    this.musicGain?.disconnect();
    this.musicOscillator?.stop();
    this.musicOscillator?.disconnect();
    this.musicGain = undefined;
    this.musicOscillator = undefined;
    this.activeMusicKey = '';
  }

  private playHitSound(): void {
    const audioContext = this.getAudioContext();
    if (!audioContext) {
      return;
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 150;
    gain.gain.setValueAtTime(0.06, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.16);
  }

  private getAudioContext(): AudioContext | undefined {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return undefined;
    }

    this.audioContext = new AudioContextClass();
    return this.audioContext;
  }

  private getThemeFrequency(theme: LevelTheme): number {
    if (theme.id === 'campus') {
      return 220;
    }
    if (theme.id === 'mall') {
      return 277;
    }
    if (theme.id === 'zoo') {
      return 196;
    }
    return 330;
  }

  private endRun(): void {
    this.emitScreen('result');
    this.state = 'ended';
    this.emitRunnerState();
    this.stopRunAnimation();
    this.stopThemeMusic();
    this.hudLayer.setVisible(false);
    this.clearObjects();
    const score = getScore(this.distanceMeters, this.collectiblesCollected, this.collectibleConfig.scoreValue);
    const preset = resolveSelection(this.selection);
    this.resultLayer.destroy(true);
    this.resultLayer = this.add.container(0, 0);
    const panel = this.add.rectangle(GAME_WIDTH / 2, 362, 328, 300, 0xffffff, 0.95).setStrokeStyle(3, 0xffd447);
    const title = this.add
      .text(GAME_WIDTH / 2, 262, `${preset.label}完成挑战`, {
        ...TEXT_STYLE,
        fontSize: preset.label.length > 4 ? '22px' : '26px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    const scoreText = this.add
      .text(GAME_WIDTH / 2, 314, `得分 ${score}`, {
        ...TEXT_STYLE,
        color: '#2f80ed',
        fontSize: '23px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    const detail = this.add
      .text(GAME_WIDTH / 2, 356, `${this.collectibleConfig.label} ${this.collectiblesCollected}  距离 ${Math.floor(this.distanceMeters)}米`, {
        ...TEXT_STYLE,
        color: '#527084',
        fontSize: '15px'
      })
      .setOrigin(0.5);
    const retry = this.createButton(GAME_WIDTH / 2, 424, 220, 52, '再跑一次', 0x7ed957, () => this.startRun());
    const setup = this.createButton(GAME_WIDTH / 2, 488, 220, 46, '返回选人', 0xdff2fb, () => this.enterSetup());
    this.resultLayer.add([panel, title, scoreText, detail, retry, setup]);
  }

  private clearObjects(): void {
    this.obstacles.clear(true, true);
    this.collectibles.clear(true, true);
  }
}




