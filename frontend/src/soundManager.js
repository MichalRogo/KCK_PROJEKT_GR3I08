class SoundManager {
  constructor() {
    this.sounds = {};
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    console.log('Sound system initialized');
  }

  async play(id) {
    if (!this.initialized) return;
    
    if (id === 'test') {
      try {
        const audio = new Audio('/sounds/select.mp3');
        await audio.play();
        console.log('Success');
      } catch (error) {
        console.warn('Failure:', error);
      }
    }
  }
}

const soundManager = new SoundManager();
export default soundManager;