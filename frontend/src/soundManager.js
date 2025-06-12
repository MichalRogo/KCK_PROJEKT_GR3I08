class SoundManager {
  constructor() {
    this.sounds = {};
    this.initialized = false;
    this.volume = 0.7;
    this.soundPaths = {
      select: '/sounds/select.mp3',
      error: '/sounds/error.mp3',
      win: '/sounds/win.mp3',
      loss: '/sounds/loss.mp3',
      menu: '/sounds/menu.mp3',
      gamemusic: '/sounds/gamemusic.mp3'
    };
  }

  async init() {
    if (this.initialized) return;
    
    const savedVolume = localStorage.getItem('codeBattleVolume');
    if (savedVolume) {
      this.volume = parseFloat(savedVolume);
    }
    
    this.initialized = true;
    console.log('Sound system initialized, volume:', this.volume);
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('codeBattleVolume', this.volume.toString());
    console.log('Volume set to:', this.volume);
  }

  getVolume() {
    return this.volume;
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
      audio.volume = this.volume;
      audio.currentTime = 0;
      await audio.play();
      console.log(`Played: ${id} at volume: ${this.volume}`);
    } catch (error) {
      console.warn(`Failed to play ${id}:`, error);
    }
  }
}

const soundManager = new SoundManager();
export default soundManager;