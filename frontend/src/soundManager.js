class SoundManager {
  constructor() {
    this.sounds = {};
    this.initialized = false;
    this.volumes = {
      master: 0.7,
      effects: 0.8,
      music: 0.5
    };
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
    
    const savedVolumes = localStorage.getItem('codeBattleVolumes');
    if (savedVolumes) {
      this.volumes = { ...this.volumes, ...JSON.parse(savedVolumes) };
    }
    
    this.initialized = true;
    console.log('Sound system initialized, volumes:', this.volumes);
  }

  setVolume(category, volume) {
    this.volumes[category] = Math.max(0, Math.min(1, volume));
    localStorage.setItem('codeBattleVolumes', JSON.stringify(this.volumes));
    
    this.updateAllVolumes();
    console.log(`${category} volume set to:`, this.volumes[category]);
  }

  getVolume(category) {
    return this.volumes[category] || 0;
  }

  updateAllVolumes() {
    Object.keys(this.sounds).forEach(id => {
      this.updateSoundVolume(id);
    });
  }

  updateSoundVolume(id) {
    const sound = this.sounds[id];
    if (sound && sound.audio) {
      const category = this.getSoundCategory(id);
      const categoryVolume = this.volumes[category] || 1.0;
      const masterVolume = this.volumes.master || 1.0;
      let baseVolume = 1.0;
      
      if (id === 'select') {
        baseVolume = 0.4;
      }
      
      sound.audio.volume = baseVolume * categoryVolume * masterVolume;
    }
  }

  getSoundCategory(id) {
    if (id === 'gamemusic') return 'music';
    return 'effects'; // select, error, win, loss, menu
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
    
    const soundData = {
      audio,
      loaded: false
    };
    
    this.sounds[id] = soundData;
    
    audio.addEventListener('canplaythrough', () => {
      soundData.loaded = true;
      this.updateSoundVolume(id);
    });

    audio.addEventListener('error', (e) => {
      console.warn(`Failed to load sound: ${id}`, e);
    });

    return soundData;
  }

  async play(id) {
    if (!this.initialized) return;
    
    let sound = this.sounds[id];
    if (!sound) {
      sound = await this.loadSound(id);
    }
    
    if (!sound || !sound.audio || !sound.loaded) {
      console.warn(`Sound not available: ${id}`);
      return;
    }

    try {
      this.updateSoundVolume(id);
      sound.audio.currentTime = 0;
      await sound.audio.play();
      console.log(`Played: ${id}`);
    } catch (error) {
      console.warn(`Failed to play ${id}:`, error);
    }
  }

  async loop(id) {
    let sound = this.sounds[id];
    if (!sound) {
      sound = await this.loadSound(id);
    }
    
    if (!sound || !sound.audio) return;

    sound.audio.loop = true;
    this.updateSoundVolume(id);
    try {
      await sound.audio.play();
      console.log(`Started looping: ${id}`);
    } catch (error) {
      console.warn(`Failed to loop ${id}:`, error);
    }
  }

  stop(id) {
    const sound = this.sounds[id];
    if (sound && sound.audio) {
      sound.audio.pause();
      sound.audio.currentTime = 0;
      sound.audio.loop = false;
      console.log(`Stopped: ${id}`);
    }
  }
}

const soundManager = new SoundManager();
export default soundManager;