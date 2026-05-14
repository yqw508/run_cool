import Phaser from 'phaser';
import './styles.css';
import { GAME_HEIGHT, GAME_WIDTH } from './game/config';
import { RunnerScene } from './game/RunnerScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: 'rgba(0, 0, 0, 0)',
  transparent: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: [RunnerScene]
});

const gameRoot = document.getElementById('game');
if (gameRoot) {
  void import('./three/ThreeTechPreview').then(({ ThreeTechPreview }) => {
    const threePreview = new ThreeTechPreview(gameRoot);
    window.addEventListener('beforeunload', () => threePreview.dispose(), { once: true });
  });
}
