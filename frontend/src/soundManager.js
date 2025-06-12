class SoundManager {
  constructor() {
    this.sounds = {};
    this.initialized = false;
    this.soundPaths = {
      select: '/sounds/select.mp3',
      error: '/sounds/error.mp3',
      win: '/sounds/win.mp3',
      loss: '/sounds/loss.mp3'
    };
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    console.log('Sound system initialized');
  }

  async loadSound(id) {
    if (this.sounds[id]) return this.sounds[id];
    
    const path = this.soundPaths[id];
    if (!path) {
      console.warn(`Sound not found: ${id}`);
      return null;
    }

    const audio = new Audio(path);
    audio.preload = 'auto';
    this.sounds[id] = audio;
    return audio;
  }

  async play(id) {
    if (!this.initialized) return;
    
    let audio = this.sounds[id];
    if (!audio) {
      audio = await this.loadSound(id);
    }
    
    if (!audio) return;

    try {
      audio.currentTime = 0;
      await audio.play();
      console.log(`Played: ${id}`);
    } catch (error) {
      console.warn(`Failed to play ${id}:`, error);
    }
  }
}

const soundManager = new SoundManager();
export default soundManager;