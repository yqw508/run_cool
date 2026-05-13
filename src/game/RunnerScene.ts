import Phaser from 'phaser';
import { CHARACTER_PRESETS, DEFAULT_SELECTION, type CharacterPreset, type CharacterSelection, resolveSelection } from './characters';
import { GAME_HEIGHT, GAME_WIDTH, JUMP_DURATION_MS, PLAYER_Y, SLIDE_DURATION_MS, type LaneIndex } from './config';
import { applyDamage, createHealthState, isDefeated, type HealthState } from './health';
import { bindSwipeInput, type GestureDirection } from './input';
import { getThemeForRunDistance, LEVEL_THEMES, type LevelTheme, type ThemeObstacle } from './levels';
import { getLaneX, getRunSpeed, getScore, getSpawnDelay, nextLane } from './progression';

type GameState = 'setup' | 'running' | 'ended';
type RunnerPose = 'run' | 'jump' | 'slide';
type ObstacleKind = 'block' | 'bar';

type Obstacle = Phaser.GameObjects.Rectangle & {
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
  private selection: CharacterSelection = { ...DEFAULT_SELECTION };
  private currentLane: LaneIndex = 1;
  private player!: Phaser.GameObjects.Container;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private collectibles!: Phaser.Physics.Arcade.Group;
  private worldLayer?: Phaser.GameObjects.Container;
  private setupLayer!: Phaser.GameObjects.Container;
  private hudLayer!: Phaser.GameObjects.Container;
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
  private pose: RunnerPose = 'run';
  private poseTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('RunnerScene');
  }

  create(): void {
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
    this.worldLayer.add(
      this.add
        .text(GAME_WIDTH / 2, 42, '\u840c\u5a03\u9177\u8dd1', {
          ...TEXT_STYLE,
          color: this.toHexColor(theme.titleColor),
          fontSize: '30px',
          fontStyle: 'bold'
        })
        .setOrigin(0.5)
    );
  }

  private drawRoad(theme: LevelTheme): void {
    const road = this.add.graphics();
    road.fillStyle(theme.roadColor, 1);
    road.fillPoints(
      [
        new Phaser.Geom.Point(54, 130),
        new Phaser.Geom.Point(336, 130),
        new Phaser.Geom.Point(390, 642),
        new Phaser.Geom.Point(0, 642)
      ],
      true
    );
    road.lineStyle(3, theme.laneColor, 0.34);
    road.beginPath();
    road.moveTo(145, 130);
    road.lineTo(108, 642);
    road.moveTo(245, 130);
    road.lineTo(282, 642);
    road.strokePath();
    this.worldLayer?.add(road);

    for (let y = 170; y < 630; y += 92) {
      this.worldLayer?.add(this.add.rectangle(GAME_WIDTH / 2, y, 92, 8, theme.laneColor, 0.18));
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
    this.hudLayer.add([this.scoreText, this.themeLabelText, this.healthText, hintText]);
  }

  private updateHud(): void {
    this.scoreText.setText(`得分 ${getScore(this.distanceMeters, this.stars)}  星星 ${this.stars}`);
    this.themeLabelText.setText(`场景 ${this.currentTheme.label}`);
    this.healthText.setText(`生命 ${'♥'.repeat(this.healthState.current)}${'♡'.repeat(this.healthState.max - this.healthState.current)}`);
  }

  private createSetupLayer(): void {
    this.setupLayer = this.add.container(0, 0);
    const panel = this.add.rectangle(GAME_WIDTH / 2, 402, 352, 536, 0xffffff, 0.95).setStrokeStyle(3, 0x1e9ed6);
    const title = this.add
      .text(GAME_WIDTH / 2, 142, '\u9009\u62e9\u89d2\u8272', {
        ...TEXT_STYLE,
        fontSize: '24px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(GAME_WIDTH / 2, 172, '\u5148\u9009\u4eba\u7269\uff0c\u518d\u9009\u60f3\u53bb\u7684\u5173\u5361', {
        ...TEXT_STYLE,
        color: '#527084',
        fontSize: '14px'
      })
      .setOrigin(0.5);
    this.setupLayer.add([panel, title, subtitle]);

    CHARACTER_PRESETS.forEach((preset, index) => this.addCharacterCard(preset, index));
    this.addLevelCards();

    const start = this.createButton(GAME_WIDTH / 2, 646, 230, 50, '\u5f00\u59cb\u9177\u8dd1', 0xffd447, () => this.startRun());
    this.setupLayer.add(start);
  }
  private addCharacterCard(preset: CharacterPreset, index: number): void {
    const x = GAME_WIDTH / 2;
    const y = 214 + index * 54;
    const selected = this.selection.presetId === preset.id;
    const card = this.add.container(x, y);
    const bg = this.add
      .rectangle(0, 0, 308, 46, selected ? 0xfff1a8 : 0xeaf7ff, 1)
      .setStrokeStyle(selected ? 3 : 2, selected ? 0xffb000 : 0x9ed5ef);
    const portrait = this.add.container(-122, 20).setScale(0.34);
    this.drawCharacterParts(portrait, preset);
    const name = this.add.text(-76, -17, preset.label, {
      ...TEXT_STYLE,
      fontSize: '17px',
      fontStyle: 'bold'
    });
    const age = this.add.text(34, -15, preset.age, {
      ...TEXT_STYLE,
      color: '#527084',
      fontSize: '12px'
    });
    const desc = this.add.text(-76, 7, preset.description, {
      ...TEXT_STYLE,
      color: '#527084',
      fontSize: '13px'
    });
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
      this.selection = { presetId: preset.id };
      this.refreshSetup();
      this.redrawPlayer();
    });
    card.add([bg, portrait, name, age, desc]);
    this.setupLayer.add(card);
  }

  private addLevelCards(): void {
    const label = this.add
      .text(GAME_WIDTH / 2, 500, '\u9009\u62e9\u5173\u5361', {
        ...TEXT_STYLE,
        color: '#17263a',
        fontSize: '18px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    this.setupLayer.add(label);

    LEVEL_THEMES.forEach((theme, index) => {
      const x = index % 2 === 0 ? GAME_WIDTH / 2 - 82 : GAME_WIDTH / 2 + 82;
      const y = 536 + Math.floor(index / 2) * 48;
      const selected = index === this.selectedThemeIndex;
      const card = this.add.container(x, y);
      const bg = this.add
        .rectangle(0, 0, 144, 38, selected ? 0xfff1a8 : 0xeaf7ff, 1)
        .setStrokeStyle(selected ? 3 : 2, selected ? 0xffb000 : 0x9ed5ef);
      const swatch = this.add.rectangle(-52, 0, 18, 18, theme.groundColor).setStrokeStyle(2, theme.roadColor);
      const text = this.add
        .text(-34, 0, theme.label, {
          ...TEXT_STYLE,
          color: '#17263a',
          fontSize: '15px',
          fontStyle: 'bold'
        })
        .setOrigin(0, 0.5);
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.selectedThemeIndex = index;
        this.currentTheme = LEVEL_THEMES[index];
        this.drawWorld();
        this.refreshSetup();
      });
      card.add([bg, swatch, text]);
      this.setupLayer.add(card);
    });
  }

  private createResultLayer(): void {
    this.resultLayer = this.add.container(0, 0).setVisible(false);
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
    this.player.removeAll(true);
    this.drawPlayerParts(this.player);
  }

  private drawPlayerParts(player: Phaser.GameObjects.Container): void {
    this.drawCharacterParts(player, resolveSelection(this.selection));
  }

  private drawCharacterParts(player: Phaser.GameObjects.Container, preset: CharacterPreset): void {
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
        targets: this.player,
        scaleY: 0.68,
        yoyo: true,
        duration: SLIDE_DURATION_MS / 2,
        ease: 'Sine.easeInOut',
        onComplete: () => this.player.setScale(1)
      });
    }
  }

  private setPose(pose: RunnerPose, duration: number): void {
    this.pose = pose;
    this.poseTimer?.remove(false);
    this.poseTimer = this.time.delayedCall(duration, () => {
      this.pose = 'run';
    });
  }

  private enterSetup(): void {
    this.state = 'setup';
    this.stopThemeMusic();
    this.setupLayer.setVisible(true);
    this.resultLayer.setVisible(false);
    this.hudLayer.setVisible(false);
    this.player.setVisible(true);
    this.player.setPosition(getLaneX(1), PLAYER_Y);
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
    this.drawWorld();
    this.switchThemeMusic(this.currentTheme);
    this.clearObjects();
    this.updateHud();
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
    const obstacle = this.add.rectangle(
      getLaneX(lane),
      128,
      kind === 'block' ? 58 : 76,
      kind === 'block' ? 46 : 24,
      themeObstacle.color
    ) as Obstacle;
    obstacle.kind = kind;
    obstacle.setStrokeStyle(3, themeObstacle.accentColor);
    this.physics.add.existing(obstacle);
    obstacle.body.setAllowGravity(false);
    obstacle.body.setImmovable(true);
    const label = this.add
      .text(obstacle.x, obstacle.y - 2, themeObstacle.label, {
        ...TEXT_STYLE,
        color: '#ffffff',
        fontSize: '12px',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    obstacle.setData('label', label);
    this.obstacles.add(obstacle);
  }

  private spawnStar(lane: LaneIndex): void {
    const star = this.add.star(getLaneX(lane), 110, 5, 8, 18, 0xffd447) as Collectible;
    this.physics.add.existing(star);
    star.body.setAllowGravity(false);
    this.collectibles.add(star);
  }

  private moveObjects(delta: number, speed: number): void {
    const moveY = (speed * delta) / 1000;
    this.obstacles.children.each((child) => {
      const obstacle = child as Obstacle;
      obstacle.y += moveY;
      obstacle.scale += delta / 9000;
      const label = obstacle.getData('label') as Phaser.GameObjects.Text | undefined;
      if (label) {
        label.setPosition(obstacle.x, obstacle.y - 2);
        label.setScale(obstacle.scale);
      }
      if (obstacle.y > GAME_HEIGHT + 60) {
        label?.destroy();
        obstacle.destroy();
      }
      return true;
    });

    this.collectibles.children.each((child) => {
      const star = child as Collectible;
      star.y += moveY;
      star.rotation += delta / 260;
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
    (obstacle.getData('label') as Phaser.GameObjects.Text | undefined)?.destroy();
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
    this.obstacles.children.each((child) => {
      const obstacle = child as Obstacle;
      (obstacle.getData('label') as Phaser.GameObjects.Text | undefined)?.destroy();
      return true;
    });
    this.obstacles.clear(true, true);
    this.collectibles.clear(true, true);
  }
}




