const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;

// Audio State
let sfxVolume = 0.5;
let musicVolume = 0.3;

// Music Nodes
let musicOsc1: OscillatorNode | null = null;
let musicOsc2: OscillatorNode | null = null;
let musicGain: GainNode | null = null;
let isMusicPlaying = false;

const getAudioCtx = () => {
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
};

// --- Volume Controls ---

export const setSfxVolume = (volume: number) => {
  sfxVolume = Math.max(0, Math.min(1, volume));
};

export const setMusicVolume = (volume: number) => {
  musicVolume = Math.max(0, Math.min(1, volume));
  if (musicGain && audioCtx) {
    // Smooth transition
    musicGain.gain.setTargetAtTime(musicVolume * 0.15, audioCtx.currentTime, 0.1);
  }
};

export const getSfxVolume = () => sfxVolume;
export const getMusicVolume = () => musicVolume;

// --- Background Music (Ambient Drone) ---

export const startMusic = () => {
  if (isMusicPlaying) return;
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(e => console.error(e));
  }

  // Create nodes
  musicOsc1 = ctx.createOscillator();
  musicOsc2 = ctx.createOscillator();
  musicGain = ctx.createGain();
  
  // Oscillator 1: Low Drone
  musicOsc1.type = 'sine';
  musicOsc1.frequency.setValueAtTime(55, ctx.currentTime); // A1
  
  // Oscillator 2: Harmony (Fifth)
  musicOsc2.type = 'triangle';
  musicOsc2.frequency.setValueAtTime(82.41, ctx.currentTime); // E2
  
  // Filter for Osc 2 to make it softer
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;

  // Connection Graph
  musicOsc1.connect(musicGain);
  musicOsc2.connect(filter);
  filter.connect(musicGain);
  musicGain.connect(ctx.destination);
  
  // Fade in
  musicGain.gain.setValueAtTime(0, ctx.currentTime);
  musicGain.gain.linearRampToValueAtTime(musicVolume * 0.15, ctx.currentTime + 2);

  musicOsc1.start();
  musicOsc2.start();
  isMusicPlaying = true;
};

export const stopMusic = () => {
  if (!isMusicPlaying || !musicGain || !audioCtx) return;
  
  const ctx = audioCtx;
  const osc1 = musicOsc1;
  const osc2 = musicOsc2;
  const gain = musicGain;

  // Fade out
  try {
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    
    setTimeout(() => {
        osc1?.stop();
        osc2?.stop();
        // Cleanup references if they haven't been restarted
        if (musicOsc1 === osc1) {
            musicOsc1 = null;
            musicOsc2 = null;
            musicGain = null;
            isMusicPlaying = false;
        }
    }, 600);
  } catch (e) {
    console.error("Error stopping music", e);
  }
};

// --- SFX ---

export const playSound = (type: 'paddle' | 'brick' | 'wall' | 'powerup' | 'shoot' | 'gameover' | 'victory' | 'start' | 'pierce') => {
  if (sfxVolume <= 0.01) return; // Muted

  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  const now = ctx.currentTime;
  const vol = sfxVolume; 

  switch (type) {
    case 'paddle':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      gainNode.gain.setValueAtTime(0.3 * vol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
      
    case 'wall':
      osc.type = 'square';
      osc.frequency.setValueAtTime(200, now);
      gainNode.gain.setValueAtTime(0.1 * vol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
      break;

    case 'brick':
      osc.type = 'triangle';
      // Random pitch for variety
      const pitch = 300 + Math.random() * 200;
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch / 2, now + 0.1);
      gainNode.gain.setValueAtTime(0.2 * vol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
      break;

    case 'pierce':
      // Heavy impact: Square wave with rapid filter envelope
      osc.type = 'square';
      osc.frequency.setValueAtTime(100, now); // Low punch
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
      
      const pFilter = ctx.createBiquadFilter();
      pFilter.type = 'lowpass';
      pFilter.frequency.setValueAtTime(400, now);
      pFilter.frequency.linearRampToValueAtTime(50, now + 0.2);
      
      osc.disconnect();
      osc.connect(pFilter);
      pFilter.connect(gainNode);

      gainNode.gain.setValueAtTime(0.5 * vol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;

    case 'powerup':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.3);
      // Tremolo
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 15;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 500;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + 0.3);
      
      gainNode.gain.setValueAtTime(0.2 * vol, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;

    case 'shoot':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      
      // Lowpass filter sweep
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
      
      osc.disconnect();
      osc.connect(filter);
      filter.connect(gainNode);

      gainNode.gain.setValueAtTime(0.2 * vol, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;

    case 'gameover':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(50, now + 1);
      gainNode.gain.setValueAtTime(0.4 * vol, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 1);
      osc.start(now);
      osc.stop(now + 1);
      break;

    case 'victory':
      // Arpeggio
      const notes = [440, 554, 659, 880]; // A Major
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        o.connect(g);
        g.connect(ctx.destination);
        const start = now + i * 0.1;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.2 * vol, start + 0.05);
        g.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
        o.start(start);
        o.stop(start + 0.5);
      });
      break;

    case 'start':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3 * vol, now + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
      break;
  }
};