import Phaser from 'phaser';
import { CHARACTER_PRESETS, DEFAULT_SELECTION, type CharacterPreset, type CharacterSelection, resolveSelection } from './characters';
import { GAME_HEIGHT, GAME_WIDTH, JUMP_DURATION_MS, PLAYER_Y, SLIDE_DURATION_MS, type LaneIndex } from './config';
import { applyDamage, createHealthState, isDefeated, type HealthState } from './health';
import { bindSwipeInput, type GestureDirection } from './input';
import { getThemeForRunDistance, LEVEL_THEMES, type LevelTheme, type ThemeObstacle } from './levels';
import { getLaneX, getRunSpeed, getScore, getSpawnDelay, nextLane } from './progression';

type GameState = 'setup' | 'running' | 'paused' | 'ended';
type SetupStep = 'character' | 'map';
type RunnerPose = 'run' | 'jump' | 'slide';
type ObstacleKind = 'block' | 'bar';

type Obstacle = Phaser.GameObjects.Container & {
  body: Phaser.Physics.Arcade.Body;
  kind: ObstacleKind;
  damageHandled?: boolean;
};

type Collectible = Phaser.GameObjects.Star & {
  body: Phaser.Physics.Arcade.Body;
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
  private healthState: HealthState = createHealthState();
  private currentTheme: LevelTheme = LEVEL_THEMES[0];
  private selectedThemeIndex = 0;
  private activeMusicKey = '';
  private audioContext?: AudioContext;
  private musicOscillator?: OscillatorNode;
  private musicGain?: GainNode;
  private runStartedAt = 0;
  private distanceMeters = 0;
  private stars = 0;
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

    this.physics.add.overlap(this.player, this.collectibles, (_, star) => this.collectStar(star as Collectible));
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

    this.worldLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, theme.skyColor));
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
    this.scoreText = this.add.text(16, 18, '得分 0  星星 0', {
      ...TEXT_STYLE,
      color: '#ffffff',
      fontSize: '18px',
      fontStyle: 'bold'
    });
    this.themeLabelText = this.add.text(16, 44, '场景 校园', {
      ...TEXT_STYLE,
      color: '#ffffff',
      fontSize: '15px',
      fontStyle: 'bold'
    });
    this.healthText = this.add.text(16, 68, '生命 ♥♥♥', {
      ...TEXT_STYLE,
      color: '#ffffff',
      fontSize: '15px',
      fontStyle: 'bold'
    });
    const hintText = this.add
      .text(GAME_WIDTH / 2, 98, '左右换道  上滑跳跃  下滑滑行', {
        ...TEXT_STYLE,
        color: '#ffffff',
        fontSize: '15px'
      })
      .setOrigin(0.5);
    const pauseButton = this.createButton(GAME_WIDTH - 48, 34, 62, 34, '\u6682\u505c', 0xfff1a8, () => this.pauseRun());
    this.hudLayer.add([this.scoreText, this.themeLabelText, this.healthText, hintText, pauseButton]);
  }

  private updateHud(): void {
    this.scoreText.setText(`得分 ${getScore(this.distanceMeters, this.stars)}  星星 ${this.stars}`);
    this.themeLabelText.setText(`场景 ${this.currentTheme.label}`);
    this.healthText.setText(`生命 ${'♥'.repeat(this.healthState.current)}${'♡'.repeat(this.healthState.max - this.healthState.current)}`);
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
    this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x8fd7ff));
    this.setupLayer.add(this.add.circle(66, 86, 34, 0xffe46b));
    this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, 596, GAME_WIDTH, 206, 0x74c973));
    this.setupLayer.add(this.add.ellipse(GAME_WIDTH / 2, 532, 326, 116, 0x5cb66a));
    this.setupLayer.add(this.add.ellipse(GAME_WIDTH / 2, 542, 278, 74, 0x79d184, 0.92));
    this.setupLayer.add(this.add.rectangle(72, 176, 120, 76, 0xf6f1df).setStrokeStyle(3, 0xcf5d45));
    this.setupLayer.add(this.add.rectangle(72, 126, 130, 20, 0xcf5d45));
    this.setupLayer.add(this.add.rectangle(290, 162, 90, 64, 0xdff2fb).setStrokeStyle(3, 0x4f9ed8));
    this.setupLayer.add(this.add.rectangle(290, 116, 100, 18, 0x4f9ed8));

    this.setupLayer.add(
      this.add
        .text(GAME_WIDTH / 2, 50, '选择角色', {
          ...TEXT_STYLE,
          color: '#ffffff',
          fontSize: '28px',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setStroke('#2f80ed', 5)
    );

    CHARACTER_PRESETS.forEach((preset, index) => this.addLobbyCharacter(preset, index));
    this.addCharacterDetails();

    this.setupLayer.add(this.createButton(86, 650, 120, 42, '上一个', 0xdff2fb, () => this.selectLobbyCharacter(this.selectedCharacterIndex - 1)));
    this.setupLayer.add(this.createButton(304, 650, 120, 42, '下一个', 0xdff2fb, () => this.selectLobbyCharacter(this.selectedCharacterIndex + 1)));
    this.setupLayer.add(
      this.createButton(GAME_WIDTH / 2, 696, 236, 48, '下一步  选地图', 0xffd447, () => {
        this.setupStep = 'map';
        this.refreshSetup();
      })
    );
  }

  private addLobbyCharacter(preset: CharacterPreset, index: number): void {
    const selected = index === this.selectedCharacterIndex;
    const spots = [
      { x: 68, y: 430, scale: 0.5 },
      { x: 130, y: 342, scale: 0.48 },
      { x: 195, y: 346, scale: 0.52 },
      { x: 270, y: 352, scale: 0.48 },
      { x: 328, y: 430, scale: 0.5 }
    ];
    const homeSpot = spots[index];
    const spot = selected ? { x: GAME_WIDTH / 2, y: 354, scale: 0.82 } : homeSpot;
    const character = this.add
      .container(spot.x, spot.y)
      .setScale(selected ? spot.scale * 1.36 : spot.scale)
      .setAlpha(selected ? 1 : 0.78)
      .setDepth(selected ? 8 : 2 + index);

    character.add(this.add.ellipse(0, 38, 96, 20, 0x000000, selected ? 0.2 : 0.11));
    this.drawLobbyScene(character, preset);
    character.setInteractive(new Phaser.Geom.Rectangle(-58, -150, 116, 190), Phaser.Geom.Rectangle.Contains);
    character.on('pointerup', () => this.selectLobbyCharacter(index));
    this.setupLayer.add(character);

    if (selected) {
      character.add(this.add.circle(0, -48, 74, 0xffd447, 0.18).setStrokeStyle(4, 0xffd447, 0.72).setDepth(-2));
      this.tweens.add({
        targets: character,
        scale: spot.scale * 1.48,
        duration: 190,
        ease: 'Back.easeOut'
      });
      this.tweens.add({
        targets: character,
        y: spot.y - 8,
        duration: 980,
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
    if (preset.id === 'little-star') {
      const swing = this.add.container(0, -8);
      const shadow = this.add.ellipse(0, 42, 92, 18, 0x000000, 0.12);
      character.add(shadow);
      swing.add(this.add.line(0, 0, -42, -112, -24, 18, 0xffffff, 0.75).setOrigin(0).setLineWidth(3));
      swing.add(this.add.line(0, 0, 42, -112, 24, 18, 0xffffff, 0.75).setOrigin(0).setLineWidth(3));
      swing.add(this.add.rectangle(0, 32, 86, 10, 0xffd447).setStrokeStyle(2, 0x8c5a2b));
      const sprite = this.add.image(0, 36, preset.lobbyAssetKey).setOrigin(0.5, 1).setDisplaySize(112, 168);
      swing.add(sprite);
      character.add(swing);
      this.tweens.add({ targets: swing, angle: { from: -8, to: 8 }, duration: 980, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.addBreathingTween(sprite, shadow, 1320, 0.018);
      return;
    }

    const imageHolder = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 40, preset.id === 'baby-brother' ? 100 : 82, 18, 0x000000, 0.12);
    character.add(shadow);
    const displayHeight = preset.id === 'baby-brother' ? 122 : 168;
    const displayWidth = preset.id === 'baby-brother' ? 130 : 118;
    const sprite = this.add.image(0, 36, preset.lobbyAssetKey).setOrigin(0.5, 1).setDisplaySize(displayWidth, displayHeight);
    imageHolder.add(sprite);
    character.add(imageHolder);
    this.addBreathingTween(sprite, shadow, preset.id === 'baby-brother' ? 1040 : 1280, preset.id === 'baby-brother' ? 0.026 : 0.018);

    if (preset.id === 'baby-brother') {
      this.tweens.add({ targets: imageHolder, x: 8, angle: -3, duration: 980, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return;
    }

    if (preset.id === 'ice-princess') {
      for (let i = 0; i < 4; i += 1) {
        const sparkle = this.add.star(-44 + i * 30, -86 + (i % 2) * 22, 4, 2, 6, 0xffffff, 0.94);
        character.add(sparkle);
        this.tweens.add({ targets: sparkle, alpha: 0.25, scale: 1.5, duration: 620 + i * 120, yoyo: true, repeat: -1 });
      }
      return;
    }

    if (preset.id === 'pudding') {
      this.tweens.add({ targets: imageHolder, angle: { from: -2.5, to: 2.5 }, duration: 1180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return;
    }

    this.tweens.add({ targets: imageHolder, y: -4, duration: 1120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private addBreathingTween(
    sprite: Phaser.GameObjects.Image,
    shadow: Phaser.GameObjects.Ellipse,
    duration: number,
    amount: number
  ): void {
    this.tweens.add({
      targets: sprite,
      scaleX: sprite.scaleX * (1 + amount),
      scaleY: sprite.scaleY * (1 - amount * 0.7),
      y: sprite.y - 3,
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: shadow,
      scaleX: 1.08,
      alpha: 0.08,
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
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
    this.refreshSetup();
    this.redrawPlayer();
  }

  private addCharacterDetails(): void {
    const preset = CHARACTER_PRESETS[this.selectedCharacterIndex];
    const panel = this.add.container(GAME_WIDTH / 2, 574);
    panel.add(this.add.rectangle(0, 0, 330, 92, 0xffffff, 0.94).setStrokeStyle(3, 0xffd447));
    panel.add(
      this.add
        .text(-142, -28, preset.label, {
          ...TEXT_STYLE,
          fontSize: '22px',
          fontStyle: 'bold'
        })
        .setOrigin(0, 0.5)
    );
    panel.add(
      this.add
        .text(142, -28, preset.age, {
          ...TEXT_STYLE,
          color: '#527084',
          fontSize: '14px'
        })
        .setOrigin(1, 0.5)
    );
    panel.add(
      this.add
        .text(-142, 14, preset.description, {
          ...TEXT_STYLE,
          color: '#527084',
          fontSize: '15px',
          wordWrap: { width: 284 }
        })
        .setOrigin(0, 0.5)
    );
    this.setupLayer.add(panel);
    this.tweens.add({
      targets: panel,
      y: 562,
      alpha: { from: 0, to: 1 },
      duration: 220,
      ease: 'Sine.easeOut'
    });
  }

  private createMapSelect(): void {
    this.setupLayer.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x8fd7ff));
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
    this.drawCharacterParts(visual, resolveSelection(this.selection));
    player.add(visual);
    this.playerVisual = visual;
  }

  private drawCharacterParts(player: Phaser.GameObjects.Container, preset: CharacterPreset): void {
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
      this.setPose('slide', SLIDE_DURATION_MS);
      this.tweens.add({
        targets: this.playerVisual ?? this.player,
        scaleX: 1.12,
        scaleY: 0.68,
        angle: -8,
        yoyo: true,
        duration: SLIDE_DURATION_MS / 2,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          (this.playerVisual ?? this.player).setScale(1);
          (this.playerVisual ?? this.player).setAngle(0);
        }
      });
    }
  }

  private setPose(pose: RunnerPose, duration: number): void {
    this.pose = pose;
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
        scaleX: 1.04,
        scaleY: 0.97,
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
  }

  private stopRunAnimation(): void {
    this.runTweens.forEach((tween) => tween.stop());
    this.runTweens = [];
    this.playerVisual?.setPosition(0, 0).setScale(1).setAngle(0);
  }

  private enterSetup(): void {
    this.state = 'setup';
    this.stopThemeMusic();
    this.overlayLayer.setVisible(false);
    this.setupLayer.setVisible(true);
    this.resultLayer.setVisible(false);
    this.hudLayer.setVisible(false);
    this.player.setVisible(true);
    this.player.setPosition(getLaneX(1), PLAYER_Y);
    this.stopRunAnimation();
  }

  private startRun(): void {
    this.state = 'running';
    this.setupLayer.setVisible(false);
    this.resultLayer.setVisible(false);
    this.hudLayer.setVisible(true);
    this.currentLane = 1;
    this.healthState = createHealthState();
    this.currentTheme = LEVEL_THEMES[this.selectedThemeIndex];
    this.distanceMeters = 0;
    this.stars = 0;
    this.runStartedAt = this.time.now;
    this.nextSpawnAt = this.time.now + 600;
    this.pose = 'run';
    this.player.setVisible(true).setPosition(getLaneX(this.currentLane), PLAYER_Y).setScale(1).setAlpha(1);
    this.playerVisual?.setPosition(0, 0).setScale(1).setAngle(0);
    this.startRunAnimation();
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
      this.spawnStar(((lane + Phaser.Math.Between(1, 2)) % 3) as LaneIndex);
      return;
    }

    this.spawnStar(lane);
    this.spawnStar(((lane + 1) % 3) as LaneIndex);
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
    const cueText = kind === 'block' ? '跳' : '蹲';
    const cue = this.add.container(0, cueY);
    cue.add(this.add.circle(0, 0, 17, cueColor, 0.95).setStrokeStyle(3, 0xffffff));

    if (kind === 'block') {
      cue.add(this.add.triangle(0, -3, -8, 6, 8, 6, 0, -9, 0xffffff));
      cue.add(this.add.rectangle(0, 7, 6, 11, 0xffffff));
    } else {
      cue.add(this.add.rectangle(0, -7, 6, 11, 0xffffff));
      cue.add(this.add.triangle(0, 6, -8, -3, 8, -3, 0, 10, 0xffffff));
    }

    cue.add(
      this.add
        .text(23, 0, cueText, {
          ...TEXT_STYLE,
          color: '#ffffff',
          fontSize: '13px',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setStroke('#17263a', 4)
    );
    obstacle.add(cue);
  }

  private spawnStar(lane: LaneIndex): void {
    const star = this.add.star(getLaneX(lane), 110, 5, 8, 18, 0xffd447) as Collectible;
    star.setScale(0.55);
    this.physics.add.existing(star);
    star.body.setAllowGravity(false);
    this.collectibles.add(star);
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
      const star = child as Collectible;
      star.y += moveY;
      star.rotation += delta / 260;
      star.setScale(Math.min(1.2, star.scale + delta / 9000));
      if (star.y > GAME_HEIGHT + 40) {
        star.destroy();
      }
      return true;
    });
  }

  private collectStar(star: Collectible): void {
    if (this.state !== 'running') {
      return;
    }

    this.stars += 1;
    star.destroy();
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
    this.state = 'ended';
    this.stopRunAnimation();
    this.stopThemeMusic();
    this.hudLayer.setVisible(false);
    this.clearObjects();
    const score = getScore(this.distanceMeters, this.stars);
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
      .text(GAME_WIDTH / 2, 356, `星星 ${this.stars}  距离 ${Math.floor(this.distanceMeters)}米`, {
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




