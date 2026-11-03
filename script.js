/**
 * Nitro Dash (니트로 대시) - Pure Vanilla JavaScript Engine
 * Runs directly on GitHub Pages with ZERO build step.
 */

// --- 1. CONSTANTS ---
const VIRTUAL_WIDTH = 1200;
const VIRTUAL_HEIGHT = 650;

const ROAD_TOP = 320;
const ROAD_BOTTOM = 580;
const ROAD_HEIGHT = ROAD_BOTTOM - ROAD_TOP; // 260px
const LANE_HEIGHT = ROAD_HEIGHT / 2; // 130px

// Lane center Y coordinates
const LANE_Y = [
  ROAD_TOP + LANE_HEIGHT * 0.5, // Upper lane (~385)
  ROAD_TOP + LANE_HEIGHT * 1.5, // Lower lane (~515)
];

const TOTAL_GAME_TIME = 40.0;
const FEVER_DURATION = 5.0;
const STUN_DURATION = 0.5;
const NEAR_MISS_POINTS = 1000;
const CRASH_POINTS = 1000;
const SMASH_POINTS = 5000;
const NEAR_MISS_NITRO_GAIN = 30;

const NORMAL_ROAD_SPEED = 580;
const FEVER_ROAD_SPEED = 1150;
const MIN_OBSTACLE_SPACING_X = 460;

const NEAR_MISS_EXPANSION_X = 65;
const NEAR_MISS_EXPANSION_Y = 75;

// --- 2. COLLISION HELPERS (SAT & BOUNDS) ---
function projectPolygon(axis, polygon) {
  let min = axis.x * polygon[0].x + axis.y * polygon[0].y;
  let max = min;
  for (let i = 1; i < polygon.length; i++) {
    const p = axis.x * polygon[i].x + axis.y * polygon[i].y;
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return [min, max];
}

function checkPolygonIntersection(polyA, polyB) {
  if (polyA.length < 3 || polyB.length < 3) return false;
  const polygons = [polyA, polyB];

  for (let p = 0; p < polygons.length; p++) {
    const polygon = polygons[p];
    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];
      const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
      const normal = { x: -edge.y, y: edge.x };
      const len = Math.hypot(normal.x, normal.y);
      if (len === 0) continue;
      const axis = { x: normal.x / len, y: normal.y / len };

      const [minA, maxA] = projectPolygon(axis, polyA);
      const [minB, maxB] = projectPolygon(axis, polyB);
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
}

function expandPolygon(poly, marginX, marginY = marginX) {
  if (poly.length === 0) return [];
  let cx = 0;
  let cy = 0;
  for (const pt of poly) {
    cx += pt.x;
    cy += pt.y;
  }
  cx /= poly.length;
  cy /= poly.length;

  return poly.map((pt) => {
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const signX = dx >= 0 ? 1 : -1;
    const signY = dy >= 0 ? 1 : -1;
    return {
      x: pt.x + signX * marginX,
      y: pt.y + signY * marginY,
    };
  });
}

function getBoundingBox(poly) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

function checkAABBOverlap(polyA, polyB) {
  const a = getBoundingBox(polyA);
  const b = getBoundingBox(polyB);
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

// --- 3. WEB AUDIO SYNTHESIZER ---
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.engineGain = null;
    this.engineOsc = null;
    this.isEngineRunning = false;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (muted && this.engineGain && this.ctx) {
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  startEngine() {
    if (this.isEngineRunning || this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(70, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, this.ctx.currentTime);

      this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.isEngineRunning = true;
    } catch (e) {
      // Audio autoplay policy
    }
  }

  updateEnginePitch(speedRatio, isFever = false) {
    if (!this.ctx || !this.engineOsc || !this.engineGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const baseFreq = isFever ? 130 : 70;
    const maxFreq = isFever ? 260 : 150;
    const targetFreq = baseFreq + (maxFreq - baseFreq) * Math.min(speedRatio, 1.5);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);

    const targetGain = isFever ? 0.07 : 0.04;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
  }

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (e) {}
      this.engineOsc = null;
    }
    this.isEngineRunning = false;
  }

  playLaneSwitch() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.08);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playNearMiss() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [1046.5, 1318.5, 1567.98, 2093.0];
    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.035);
      gain.gain.setValueAtTime(0.12, now + idx * 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.035);
      osc.stop(now + idx * 0.035 + 0.2);
    });
  }

  playCrash() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

    oscGain.gain.setValueAtTime(0.25, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);

    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
  }

  playSmash() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);

    oscGain.gain.setValueAtTime(0.25, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.41);

    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.12));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2200, now);
    noiseFilter.Q.setValueAtTime(3, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
  }

  playFeverStart() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0.18, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.28);
      });
    } catch (e) {
      console.warn('Audio playFeverStart error:', e);
    }
  }

  playTick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playGameOver() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.5];
    chords.forEach((freq) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.3);
    });
  }
}

const soundEngine = new SoundEngine();

// --- 4. PARALLAX NIGHT CITY BACKGROUND ---
class Background {
  constructor() {
    this.starSeeds = [];
    this.farBuildings = [];
    this.midBuildings = [];
    this.streetlights = [];
    this.trees = [];
    this.roadOffset = 0;
    this.farOffset = 0;
    this.midOffset = 0;
    this.roadsideOffset = 0;
    this.speedLines = [];

    this.initStars();
    this.initBuildings();
    this.initRoadside();
    this.initSpeedLines();
  }

  initStars() {
    for (let i = 0; i < 70; i++) {
      this.starSeeds.push({
        x: Math.random() * VIRTUAL_WIDTH,
        y: Math.random() * (ROAD_TOP - 40),
        size: Math.random() * 2 + 0.8,
        alpha: Math.random() * 0.7 + 0.3,
        speed: Math.random() * 0.05 + 0.02,
      });
    }
  }

  initBuildings() {
    const neonWords = ['NITRO', 'CYBER', 'DASH', '2077', 'NEON', 'BAR', 'HOTEL'];
    const neonColors = ['#00F0FF', '#FF007F', '#FFE600', '#00FF66', '#9D00FF'];
    let curX = 0;
    while (curX < VIRTUAL_WIDTH * 2.5) {
      const width = Math.random() * 70 + 60;
      const height = Math.random() * 140 + 100;
      const hasSign = Math.random() > 0.45;
      this.farBuildings.push({
        x: curX,
        width,
        height,
        color: '#150f2f',
        windowCols: Math.floor(width / 14),
        windowRows: Math.floor(height / 18),
        windowGlowColor: 'rgba(255, 230, 100, 0.4)',
        hasAntenna: Math.random() > 0.6,
        neonSign: hasSign
          ? {
              text: neonWords[Math.floor(Math.random() * neonWords.length)],
              color: neonColors[Math.floor(Math.random() * neonColors.length)],
            }
          : null,
      });
      curX += width + 12;
    }

    curX = 0;
    while (curX < VIRTUAL_WIDTH * 2.5) {
      const width = Math.random() * 85 + 75;
      const height = Math.random() * 110 + 70;
      this.midBuildings.push({
        x: curX,
        width,
        height,
        color: '#1e1442',
        windowCols: Math.floor(width / 16),
        windowRows: Math.floor(height / 20),
        windowGlowColor: 'rgba(0, 240, 255, 0.5)',
        hasAntenna: Math.random() > 0.5,
      });
      curX += width + 20;
    }
  }

  initRoadside() {
    for (let x = 0; x < VIRTUAL_WIDTH * 2.5; x += 320) {
      this.streetlights.push({ x });
    }
    for (let x = 50; x < VIRTUAL_WIDTH * 2.5; x += 180) {
      this.trees.push({
        x,
        height: Math.random() * 25 + 45,
        type: Math.floor(Math.random() * 2),
      });
    }
  }

  initSpeedLines() {
    for (let i = 0; i < 25; i++) {
      this.speedLines.push({
        x: Math.random() * VIRTUAL_WIDTH,
        y: ROAD_TOP + Math.random() * (ROAD_BOTTOM - ROAD_TOP),
        length: Math.random() * 90 + 50,
        speed: Math.random() * 400 + 700,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }
  }

  update(dt, speed) {
    const speedRatio = speed / NORMAL_ROAD_SPEED;
    this.farOffset = (this.farOffset + speed * 0.18 * dt) % (VIRTUAL_WIDTH * 1.5);
    this.midOffset = (this.midOffset + speed * 0.45 * dt) % (VIRTUAL_WIDTH * 1.5);
    this.roadsideOffset = (this.roadsideOffset + speed * 0.9 * dt) % (VIRTUAL_WIDTH * 1.5);
    this.roadOffset = (this.roadOffset + speed * dt) % 120;

    for (const line of this.speedLines) {
      line.x -= line.speed * speedRatio * dt;
      if (line.x + line.length < 0) {
        line.x = VIRTUAL_WIDTH + Math.random() * 200;
        line.y = ROAD_TOP + 10 + Math.random() * (ROAD_BOTTOM - ROAD_TOP - 20);
        line.length = (Math.random() * 100 + 60) * (speedRatio > 1.2 ? 1.8 : 1);
      }
    }
  }

  draw(ctx, isFever, time) {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, ROAD_TOP);
    if (isFever) {
      skyGrad.addColorStop(0, '#23003b');
      skyGrad.addColorStop(0.5, '#400958');
      skyGrad.addColorStop(1, '#660b73');
    } else {
      skyGrad.addColorStop(0, '#090518');
      skyGrad.addColorStop(0.5, '#130d2d');
      skyGrad.addColorStop(1, '#251347');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, ROAD_TOP);

    // Stars
    ctx.save();
    for (const star of this.starSeeds) {
      const twinkle = Math.sin(time * 3 + star.x) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha * twinkle})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.restore();

    // Moon
    ctx.save();
    const moonX = VIRTUAL_WIDTH - 180;
    const moonY = 85;
    ctx.shadowBlur = 35;
    ctx.shadowColor = isFever ? '#FF007F' : '#00F0FF';
    ctx.fillStyle = isFever ? '#FFB6E9' : '#DCF7FF';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#090518';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(moonX, moonY, 72, 14, -0.3, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isFever ? 'rgba(255, 0, 128, 0.7)' : 'rgba(0, 240, 255, 0.7)';
    ctx.stroke();
    ctx.restore();

    // Skylines
    this.drawFarSkyline(ctx, time, isFever);
    this.drawMidSkyline(ctx, isFever);
    this.drawRoadside(ctx, isFever);
    this.drawRoad(ctx, isFever);
    this.drawSpeedLines(ctx, isFever);
  }

  drawFarSkyline(ctx, time, isFever) {
    ctx.save();
    for (const b of this.farBuildings) {
      const drawX = ((b.x - this.farOffset) % (VIRTUAL_WIDTH * 1.5)) - 100;
      if (drawX > VIRTUAL_WIDTH + 100 || drawX + b.width < -100) continue;
      const drawY = ROAD_TOP - b.height;

      ctx.fillStyle = b.color;
      ctx.fillRect(drawX, drawY, b.width, b.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2b1b59';
      ctx.strokeRect(drawX, drawY, b.width, b.height);

      if (b.hasAntenna) {
        ctx.beginPath();
        ctx.moveTo(drawX + b.width * 0.5, drawY);
        ctx.lineTo(drawX + b.width * 0.5, drawY - 25);
        ctx.strokeStyle = '#4e3391';
        ctx.lineWidth = 2;
        ctx.stroke();

        const blink = Math.sin(time * 6 + b.x) > 0;
        if (blink) {
          ctx.fillStyle = '#FF2A4D';
          ctx.beginPath();
          ctx.arc(drawX + b.width * 0.5, drawY - 26, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = b.windowGlowColor;
      for (let r = 1; r < b.windowRows; r++) {
        for (let c = 1; c < b.windowCols; c++) {
          if ((r * 7 + c * 13 + b.x) % 5 === 0) continue;
          ctx.fillRect(drawX + c * 14, drawY + r * 18, 6, 8);
        }
      }

      if (b.neonSign) {
        ctx.save();
        ctx.font = 'bold 15px Jua, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 12;
        ctx.shadowColor = b.neonSign.color;
        ctx.fillStyle = b.neonSign.color;
        ctx.fillText(b.neonSign.text, drawX + b.width / 2, drawY + 22);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawMidSkyline(ctx, isFever) {
    ctx.save();
    for (const b of this.midBuildings) {
      const drawX = ((b.x - this.midOffset) % (VIRTUAL_WIDTH * 1.5)) - 100;
      if (drawX > VIRTUAL_WIDTH + 100 || drawX + b.width < -100) continue;
      const drawY = ROAD_TOP - b.height;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = -4;
      ctx.fillStyle = b.color;
      ctx.fillRect(drawX, drawY, b.width, b.height);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;

      ctx.fillStyle = isFever ? '#FF007F' : '#00F0FF';
      ctx.fillRect(drawX, drawY, b.width, 3);

      ctx.fillStyle = isFever ? 'rgba(255, 100, 200, 0.35)' : 'rgba(0, 240, 255, 0.35)';
      for (let r = 1; r < b.windowRows; r++) {
        for (let c = 1; c < b.windowCols; c++) {
          if ((r * 11 + c * 17 + b.x) % 4 === 0) continue;
          ctx.fillRect(drawX + c * 16, drawY + r * 20, 7, 10);
        }
      }
    }
    ctx.restore();
  }

  drawRoadside(ctx, isFever) {
    ctx.save();
    for (const t of this.trees) {
      const drawX = ((t.x - this.roadsideOffset) % (VIRTUAL_WIDTH * 1.5)) - 80;
      if (drawX > VIRTUAL_WIDTH + 80 || drawX < -80) continue;
      const baseY = ROAD_TOP;

      ctx.fillStyle = '#261942';
      ctx.fillRect(drawX - 4, baseY - t.height * 0.4, 8, t.height * 0.4);

      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowOffsetY = 6;
      ctx.shadowBlur = 6;
      ctx.fillStyle = isFever ? '#FF007F' : '#14C9A0';
      ctx.beginPath();
      ctx.arc(drawX, baseY - t.height * 0.65, t.height * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0f0a21';
      ctx.stroke();
    }

    for (const light of this.streetlights) {
      const drawX = ((light.x - this.roadsideOffset) % (VIRTUAL_WIDTH * 1.5)) - 80;
      if (drawX > VIRTUAL_WIDTH + 80 || drawX < -80) continue;

      ctx.strokeStyle = '#4A3B72';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(drawX, ROAD_TOP);
      ctx.lineTo(drawX, ROAD_TOP - 90);
      ctx.lineTo(drawX + 30, ROAD_TOP - 95);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(drawX + 30, ROAD_TOP - 95, 5, 0, Math.PI * 2);
      ctx.fill();

      const coneGrad = ctx.createLinearGradient(drawX + 30, ROAD_TOP - 95, drawX + 30, ROAD_BOTTOM);
      coneGrad.addColorStop(0, isFever ? 'rgba(255, 0, 128, 0.25)' : 'rgba(0, 240, 255, 0.22)');
      coneGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(drawX + 30, ROAD_TOP - 95);
      ctx.lineTo(drawX + 110, ROAD_BOTTOM);
      ctx.lineTo(drawX - 50, ROAD_BOTTOM);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawRoad(ctx, isFever) {
    ctx.save();
    const roadGrad = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOTTOM);
    roadGrad.addColorStop(0, '#100D1C');
    roadGrad.addColorStop(0.5, '#171329');
    roadGrad.addColorStop(1, '#0C0A17');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, ROAD_TOP, VIRTUAL_WIDTH, ROAD_BOTTOM - ROAD_TOP);

    const curbColor = isFever ? '#FF007F' : '#00F0FF';
    ctx.shadowBlur = 10;
    ctx.shadowColor = curbColor;
    ctx.fillStyle = curbColor;
    ctx.fillRect(0, ROAD_TOP - 4, VIRTUAL_WIDTH, 6);
    ctx.fillRect(0, ROAD_BOTTOM - 2, VIRTUAL_WIDTH, 8);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for (let x = -this.roadOffset; x < VIRTUAL_WIDTH + 60; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, ROAD_TOP - 12);
      ctx.lineTo(x + 10, ROAD_TOP);
      ctx.moveTo(x, ROAD_BOTTOM);
      ctx.lineTo(x + 10, ROAD_BOTTOM + 12);
      ctx.stroke();
    }

    const dividerY = ROAD_TOP + LANE_HEIGHT;
    ctx.shadowBlur = isFever ? 18 : 12;
    ctx.shadowColor = isFever ? '#FFE600' : '#00F0FF';
    ctx.strokeStyle = isFever ? '#FFF176' : '#E0FBFF';
    ctx.lineWidth = 5;

    const dashLen = 50;
    const gapLen = 70;
    const totalCycle = dashLen + gapLen;

    for (let x = -this.roadOffset - totalCycle; x < VIRTUAL_WIDTH + totalCycle; x += totalCycle) {
      ctx.beginPath();
      ctx.moveTo(x, dividerY);
      ctx.lineTo(x + dashLen, dividerY);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    const sheenGrad = ctx.createLinearGradient(0, ROAD_TOP, 0, ROAD_BOTTOM);
    sheenGrad.addColorStop(0, 'rgba(0, 240, 255, 0.05)');
    sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    sheenGrad.addColorStop(1, 'rgba(255, 0, 128, 0.05)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, ROAD_TOP, VIRTUAL_WIDTH, ROAD_BOTTOM - ROAD_TOP);
    ctx.restore();
  }

  drawSpeedLines(ctx, isFever) {
    ctx.save();
    ctx.lineWidth = isFever ? 2.5 : 1.5;
    const lineColor = isFever ? '#FFE600' : '#00F0FF';
    for (const line of this.speedLines) {
      ctx.strokeStyle = lineColor;
      ctx.globalAlpha = isFever ? line.alpha * 1.8 : line.alpha;
      ctx.beginPath();
      ctx.moveTo(line.x, line.y);
      ctx.lineTo(line.x + line.length, line.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// --- 5. PARTICLE & SCREEN-SHAKE SYSTEM ---
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.speedStreaks = [];
    this.feverIntensity = 0;

    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeRotation = 0;
    this.screenShake = 0;
    this.shakeTrauma = 0;
    this.shakeType = 'NEAR_MISS';
    this.shakeTime = 0;
    this.recoilX = 0;

    this.flashAlpha = 0;
    this.flashColor = '#FFFFFF';
  }

  update(dt, isFever = false) {
    this.shakeTime += dt;
    if (isFever) {
      this.feverIntensity = Math.min(1, this.feverIntensity + dt * 4.5);
    } else {
      this.feverIntensity = Math.max(0, this.feverIntensity - dt * 2.8);
    }

    this.updateScreenShake(dt);

    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 4.5);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = (p.life / p.maxLife) * p.maxAlpha;
      if (p.vRot !== undefined && p.rotation !== undefined) {
        p.rotation += p.vRot * dt;
      }
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    this.updateSpeedStreaks(dt);
  }

  updateScreenShake(dt) {
    if (this.shakeTrauma > 0) {
      const decayRate = this.shakeType === 'NEAR_MISS' ? 3.4 : this.shakeType === 'CRASH' ? 1.9 : 2.6;
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * decayRate);
      const intensity = Math.pow(this.shakeTrauma, 2);

      if (this.shakeType === 'NEAR_MISS') {
        this.shakeOffsetX = Math.sin(this.shakeTime * 70) * 5.5 * intensity;
        this.shakeOffsetY = Math.cos(this.shakeTime * 60) * 4.5 * intensity;
        this.shakeRotation = Math.sin(this.shakeTime * 50) * 0.012 * intensity;
      } else if (this.shakeType === 'CRASH') {
        this.recoilX *= Math.pow(0.04, dt);
        this.shakeOffsetX = (Math.sin(this.shakeTime * 38) * 24 + (Math.random() - 0.5) * 14) * intensity + this.recoilX;
        this.shakeOffsetY = (Math.cos(this.shakeTime * 48) * 20 + (Math.random() - 0.5) * 12) * intensity;
        this.shakeRotation = (Math.sin(this.shakeTime * 30) * 0.048 + (Math.random() - 0.5) * 0.02) * intensity;
      } else {
        this.recoilX *= Math.pow(0.08, dt);
        this.shakeOffsetX = Math.sin(this.shakeTime * 52) * 14 * intensity + this.recoilX;
        this.shakeOffsetY = Math.cos(this.shakeTime * 58) * 12 * intensity;
        this.shakeRotation = Math.sin(this.shakeTime * 42) * 0.02 * intensity;
      }
      this.screenShake = Math.hypot(this.shakeOffsetX, this.shakeOffsetY);
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeRotation = 0;
      this.screenShake = 0;
      this.recoilX = 0;
    }
  }

  triggerNearMissShake() {
    this.shakeType = 'NEAR_MISS';
    this.shakeTrauma = Math.max(this.shakeTrauma, 0.45);
  }

  triggerCrashShake() {
    this.shakeType = 'CRASH';
    this.shakeTrauma = 1.0;
    this.recoilX = -26;
  }

  triggerSmashShake() {
    this.shakeType = 'SMASH';
    this.shakeTrauma = Math.max(this.shakeTrauma, 0.8);
    this.recoilX = 10;
  }

  triggerShake(intensity = 8) {
    if (intensity >= 12) {
      this.triggerCrashShake();
    } else {
      this.triggerNearMissShake();
    }
  }

  triggerFlash(color = '#FFFFFF', initialAlpha = 0.5) {
    this.flashColor = color;
    this.flashAlpha = initialAlpha;
  }

  emitNearMissSparks(x, y) {
    this.triggerFlash('#00F0FF', 0.45);
    this.triggerNearMissShake();
    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5);
      const speed = Math.random() * 350 + 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed - 150,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 3,
        color: Math.random() > 0.4 ? '#00F0FF' : '#FFE600',
        alpha: 1,
        maxAlpha: 1,
        life: Math.random() * 0.35 + 0.2,
        maxLife: 0.5,
        shape: 'spark',
      });
    }
  }

  emitCrashSmoke(x, y) {
    this.triggerFlash('#FF0033', 0.65);
    this.triggerCrashShake();
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 450 + 100;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: Math.random() > 0.5 ? '#FF3300' : '#FFE600',
        alpha: 1,
        maxAlpha: 1,
        life: Math.random() * 0.45 + 0.2,
        maxLife: 0.65,
        shape: 'spark',
      });
    }

    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 20,
        vx: -Math.random() * 150 - 50,
        vy: (Math.random() - 0.5) * 120 - 40,
        size: Math.random() * 16 + 12,
        color: '#342947',
        alpha: 0.8,
        maxAlpha: 0.8,
        life: Math.random() * 0.6 + 0.3,
        maxLife: 0.9,
        shape: 'circle',
      });
    }
  }

  emitSmashExplosion(x, y) {
    this.triggerFlash('#FFE600', 0.7);
    this.triggerSmashShake();
    const colors = ['#FF007F', '#00F0FF', '#FFE600', '#FFFFFF', '#9D00FF'];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 600 + 200;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 14 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        maxAlpha: 1,
        life: Math.random() * 0.5 + 0.35,
        maxLife: 0.85,
        shape: 'shard',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 15,
      });
    }
  }

  emitExhaustFlame(x, y, isFever) {
    const count = isFever ? 4 : 2;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x - Math.random() * 6,
        y: y + (Math.random() - 0.5) * 10,
        vx: -Math.random() * 400 - (isFever ? 600 : 300),
        vy: (Math.random() - 0.5) * 40,
        size: Math.random() * (isFever ? 12 : 7) + 4,
        color: isFever ? (Math.random() > 0.5 ? '#FFE600' : '#FF007F') : (Math.random() > 0.4 ? '#00F0FF' : '#4D82FF'),
        alpha: 0.9,
        maxAlpha: 0.9,
        life: Math.random() * 0.14 + 0.08,
        maxLife: 0.22,
        shape: 'circle',
      });
    }
  }

  updateSpeedStreaks(dt) {
    const targetCount = this.feverIntensity > 0.05 ? Math.floor(48 * this.feverIntensity) : 0;
    const colors = ['#00F0FF', '#FF007F', '#FFE600', '#FFFFFF', '#9D00FF', '#00FF99'];

    while (this.speedStreaks.length < targetCount) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.speedStreaks.push({
        x: Math.random() * 1200 + 400,
        y: Math.random() * 650,
        length: Math.random() * 260 + 140,
        speed: Math.random() * 1400 + 1800,
        width: Math.random() * 3.5 + 1.5,
        color,
        glowColor: color,
        alpha: Math.random() * 0.45 + 0.45,
      });
    }

    for (let i = this.speedStreaks.length - 1; i >= 0; i--) {
      const s = this.speedStreaks[i];
      s.x -= s.speed * dt;
      if (s.x + s.length < 0) {
        if (this.speedStreaks.length > targetCount) {
          this.speedStreaks.splice(i, 1);
        } else {
          s.x = 1200 + Math.random() * 250;
          s.y = Math.random() * 650;
          s.length = Math.random() * 260 + 140;
          s.speed = Math.random() * 1400 + 1800;
          s.width = Math.random() * 3.5 + 1.5;
          const color = colors[Math.floor(Math.random() * colors.length)];
          s.color = color;
          s.glowColor = color;
          s.alpha = Math.random() * 0.45 + 0.45;
        }
      }
    }
  }

  emitFeverBurst() {
    const colors = ['#00F0FF', '#FF007F', '#FFE600', '#FFFFFF', '#00FF99'];
    for (let i = 0; i < 35; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.speedStreaks.push({
        x: Math.random() * 1200,
        y: Math.random() * 650,
        length: Math.random() * 380 + 180,
        speed: Math.random() * 1800 + 2200,
        width: Math.random() * 4.5 + 2,
        color,
        glowColor: color,
        alpha: Math.random() * 0.4 + 0.6,
      });
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.save();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
        ctx.restore();
      } else if (p.shape === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.rotation !== undefined) ctx.rotate(p.rotation);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawSpeedBlur(ctx, width, height) {
    if (this.feverIntensity <= 0.01) return;
    ctx.save();

    for (const s of this.speedStreaks) {
      const alpha = Math.min(1, s.alpha * this.feverIntensity);
      if (alpha <= 0.01) continue;
      if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.length) || s.length <= 0) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.length, s.y);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.2, s.color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.shadowBlur = 14 * this.feverIntensity;
      ctx.shadowColor = s.glowColor;
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.length, s.y);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.width * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const edgeBlurH = 95;
    const intensity = this.feverIntensity;

    const topGrad = ctx.createLinearGradient(0, 0, 0, edgeBlurH);
    topGrad.addColorStop(0, `rgba(255, 0, 128, ${0.28 * intensity})`);
    topGrad.addColorStop(0.4, `rgba(0, 240, 255, ${0.15 * intensity})`);
    topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, edgeBlurH);

    const btmGrad = ctx.createLinearGradient(0, height, 0, height - edgeBlurH);
    btmGrad.addColorStop(0, `rgba(0, 240, 255, ${0.28 * intensity})`);
    btmGrad.addColorStop(0.4, `rgba(255, 0, 128, ${0.15 * intensity})`);
    btmGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = btmGrad;
    ctx.fillRect(0, height - edgeBlurH, width, edgeBlurH);

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#00F0FF';
    ctx.globalAlpha = 0.35 * intensity;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(width, 4);
    ctx.moveTo(0, height - 4);
    ctx.lineTo(width, height - 4);
    ctx.stroke();

    ctx.strokeStyle = '#FF007F';
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(width, 8);
    ctx.moveTo(0, height - 8);
    ctx.lineTo(width, height - 8);
    ctx.stroke();

    ctx.restore();
  }

  drawFlashOverlay(ctx, width, height) {
    if (this.flashAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.flashAlpha);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
}

// --- 6. FLOATING TEXTS ---
class FloatingTextManager {
  constructor() {
    this.items = [];
    this.nextId = 0;
  }

  add(text, x, y, color = '#FFE600', subText = null, strokeColor = '#000000') {
    this.items.push({
      id: this.nextId++,
      text,
      subText,
      x,
      y,
      color,
      strokeColor,
      scale: 0.4,
      life: 0.95,
      maxLife: 0.95,
      vy: -95,
    });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.vy * dt;
      item.vy *= 0.95;
      item.life -= dt;

      if (item.scale < 1.15) {
        item.scale = Math.min(1.15, item.scale + dt * 6.5);
      } else if (item.scale > 1.0) {
        item.scale = Math.max(1.0, item.scale - dt * 2.0);
      }
      if (item.life <= 0) this.items.splice(i, 1);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const item of this.items) {
      const alpha = Math.max(0, Math.min(1, item.life / (item.maxLife * 0.4)));
      ctx.globalAlpha = alpha;

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.scale(item.scale, item.scale);

      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowOffsetY = 6;
      ctx.shadowBlur = 8;
      ctx.font = '900 28px Jua, sans-serif';

      ctx.lineWidth = 6;
      ctx.strokeStyle = item.strokeColor;
      ctx.strokeText(item.text, 0, 0);

      ctx.fillStyle = item.color;
      ctx.fillText(item.text, 0, 0);

      if (item.subText) {
        ctx.font = 'bold 18px Jua, sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(item.subText, 0, 26);
        ctx.fillStyle = '#00F0FF';
        ctx.fillText(item.subText, 0, 26);
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

// --- 7. OBSTACLE ENTITY ---
class Obstacle {
  constructor(x, y, lane, type = null) {
    this.x = x;
    this.y = y;
    this.lane = lane;

    const types = ['POLICE', 'TRUCK', 'TAXI', 'BARRIER'];
    this.type = type || types[Math.floor(Math.random() * types.length)];
    this.isDestroyed = false;
    this.isCollided = false;
    this.nearMissTriggered = false;
    this.sirenTimer = 0;

    switch (this.type) {
      case 'POLICE':
        this.width = 110;
        this.height = 54;
        this.speed = -80;
        break;
      case 'TRUCK':
        this.width = 160;
        this.height = 68;
        this.speed = -140;
        break;
      case 'TAXI':
        this.width = 105;
        this.height = 52;
        this.speed = -100;
        break;
      case 'BARRIER':
        this.width = 75;
        this.height = 50;
        this.speed = 0;
        break;
    }
  }

  update(dt, roadSpeed) {
    const effectiveSpeed = roadSpeed + this.speed;
    this.x -= effectiveSpeed * dt;
    this.sirenTimer += dt * 10;
  }

  getPolygon() {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;

    if (this.type === 'BARRIER') {
      return [
        { x: cx - halfW + 6, y: cy - halfH },
        { x: cx + halfW - 6, y: cy - halfH },
        { x: cx + halfW, y: cy + halfH },
        { x: cx - halfW, y: cy + halfH },
      ];
    }
    if (this.type === 'TRUCK') {
      return [
        { x: cx - halfW, y: cy - halfH + 4 },
        { x: cx + halfW * 0.45, y: cy - halfH + 4 },
        { x: cx + halfW * 0.75, y: cy - halfH + 14 },
        { x: cx + halfW, y: cy - halfH + 18 },
        { x: cx + halfW, y: cy + halfH - 4 },
        { x: cx - halfW, y: cy + halfH - 4 },
      ];
    }
    return [
      { x: cx - halfW, y: cy + 4 },
      { x: cx - halfW + 16, y: cy - halfH + 12 },
      { x: cx - halfW + 36, y: cy - halfH + 4 },
      { x: cx + halfW * 0.35, y: cy - halfH + 4 },
      { x: cx + halfW * 0.7, y: cy - halfH + 14 },
      { x: cx + halfW, y: cy - halfH + 18 },
      { x: cx + halfW, y: cy + halfH - 8 },
      { x: cx - halfW + 10, y: cy + halfH - 8 },
    ];
  }

  getNearMissPolygon() {
    return expandPolygon(this.getPolygon(), NEAR_MISS_EXPANSION_X, NEAR_MISS_EXPANSION_Y);
  }

  draw(ctx) {
    if (this.isDestroyed) return;
    ctx.save();

    if (!this.nearMissTriggered && !this.isCollided && this.x < 1150 && this.x > 50) {
      const nearPoly = this.getNearMissPolygon();
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(nearPoly[0].x, nearPoly[0].y);
      for (let i = 1; i < nearPoly.length; i++) {
        ctx.lineTo(nearPoly[i].x, nearPoly[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowOffsetY = 16;
    ctx.shadowBlur = 12;

    switch (this.type) {
      case 'POLICE':
        this.drawPolice(ctx);
        break;
      case 'TRUCK':
        this.drawTruck(ctx);
        break;
      case 'TAXI':
        this.drawTaxi(ctx);
        break;
      case 'BARRIER':
        this.drawBarrier(ctx);
        break;
    }
    ctx.restore();
  }

  drawPolice(ctx) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;
    const poly = this.getPolygon();

    ctx.fillStyle = '#101018';
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#05030A';
    ctx.stroke();

    ctx.fillStyle = '#E8ECEF';
    ctx.fillRect(cx - 15, cy - halfH + 12, 36, halfH + 6);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#05030A';
    ctx.strokeRect(cx - 15, cy - halfH + 12, 36, halfH + 6);

    ctx.font = '900 10px Jua, sans-serif';
    ctx.fillStyle = '#0F1221';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', cx + 3, cy + 2);

    ctx.fillStyle = '#00F0FF';
    ctx.beginPath();
    ctx.moveTo(cx - halfW + 36, cy - halfH + 6);
    ctx.lineTo(cx + halfW * 0.25, cy - halfH + 6);
    ctx.lineTo(cx + halfW * 0.25, cy - 4);
    ctx.lineTo(cx - halfW + 28, cy - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const sirenFlash = Math.sin(this.sirenTimer) > 0;
    ctx.fillStyle = '#222230';
    ctx.fillRect(cx - 8, cy - halfH + 1, 16, 5);

    ctx.shadowBlur = sirenFlash ? 14 : 0;
    ctx.shadowColor = '#FF0033';
    ctx.fillStyle = sirenFlash ? '#FF0033' : '#660011';
    ctx.fillRect(cx - 8, cy - halfH - 3, 7, 5);

    ctx.shadowBlur = !sirenFlash ? 14 : 0;
    ctx.shadowColor = '#0099FF';
    ctx.fillStyle = !sirenFlash ? '#0099FF' : '#002266';
    ctx.fillRect(cx + 1, cy - halfH - 3, 7, 5);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFF275';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFF275';
    ctx.fillRect(cx - halfW, cy + 2, 4, 8);
    ctx.shadowBlur = 0;

    this.drawWheels(ctx, cx - halfW + 22, cx + halfW - 22, cy + halfH - 4);
  }

  drawTruck(ctx) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;

    ctx.fillStyle = '#1D1933';
    ctx.fillRect(cx - halfW, cy - halfH + 6, this.width * 0.65, this.height - 12);
    ctx.fillStyle = '#FF5E00';
    ctx.fillRect(cx + this.width * 0.15, cy - halfH + 10, this.width * 0.35, this.height - 16);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#05030A';
    ctx.strokeRect(cx - halfW, cy - halfH + 6, this.width * 0.65, this.height - 12);
    ctx.strokeRect(cx + this.width * 0.15, cy - halfH + 10, this.width * 0.35, this.height - 16);

    ctx.fillStyle = '#FFE600';
    for (let x = cx - halfW + 12; x < cx + this.width * 0.1; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, cy - halfH + 12);
      ctx.lineTo(x + 10, cy - halfH + 12);
      ctx.lineTo(x - 4, cy + halfH - 12);
      ctx.lineTo(x - 14, cy + halfH - 12);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#00F0FF';
    ctx.fillRect(cx + this.width * 0.35, cy - halfH + 14, 16, 18);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(cx + this.width * 0.35, cy - halfH + 14, 16, 18);

    this.drawWheels(ctx, cx - halfW + 24, cx + this.width * 0.38, cy + halfH - 4);
    this.drawWheels(ctx, cx - halfW + 55, cx + this.width * 0.38, cy + halfH - 4);
  }

  drawTaxi(ctx) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;
    const poly = this.getPolygon();

    ctx.fillStyle = '#FFB800';
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#08050E';
    ctx.stroke();

    ctx.fillStyle = '#000000';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(cx - 20 + i * 12, cy - 2, 6, 6);
      ctx.fillRect(cx - 14 + i * 12, cy + 4, 6, 6);
    }

    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFF8E1';
    ctx.fillRect(cx - 10, cy - halfH - 2, 20, 7);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(cx - 10, cy - halfH - 2, 20, 7);

    ctx.font = 'bold 7px Jua, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', cx, cy - halfH + 4);

    ctx.fillStyle = '#00F0FF';
    ctx.beginPath();
    ctx.moveTo(cx - halfW + 34, cy - halfH + 8);
    ctx.lineTo(cx + halfW * 0.3, cy - halfH + 8);
    ctx.lineTo(cx + halfW * 0.3, cy - 2);
    ctx.lineTo(cx - halfW + 26, cy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    this.drawWheels(ctx, cx - halfW + 20, cx + halfW - 20, cy + halfH - 4);
  }

  drawBarrier(ctx) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;

    ctx.fillStyle = '#E8E8E8';
    ctx.fillRect(cx - halfW, cy - halfH + 8, this.width, this.height - 16);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#090510';
    ctx.strokeRect(cx - halfW, cy - halfH + 8, this.width, this.height - 16);

    ctx.fillStyle = '#FF2A4D';
    for (let x = cx - halfW + 8; x < cx + halfW; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, cy - halfH + 8);
      ctx.lineTo(x + 8, cy - halfH + 8);
      ctx.lineTo(x, cy + halfH - 8);
      ctx.lineTo(x - 8, cy + halfH - 8);
      ctx.closePath();
      ctx.fill();
    }

    const blink = Math.sin(this.sirenTimer * 1.5) > 0;
    ctx.fillStyle = '#261F38';
    ctx.fillRect(cx - 6, cy - halfH + 2, 12, 6);
    ctx.shadowBlur = blink ? 16 : 0;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = blink ? '#FFF275' : '#8C7A00';
    ctx.beginPath();
    ctx.arc(cx, cy - halfH + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#261F38';
    ctx.beginPath();
    ctx.moveTo(cx - halfW + 10, cy + halfH - 8);
    ctx.lineTo(cx - halfW + 6, cy + halfH + 2);
    ctx.moveTo(cx + halfW - 10, cy + halfH - 8);
    ctx.lineTo(cx + halfW - 6, cy + halfH + 2);
    ctx.stroke();
  }

  drawWheels(ctx, frontX, rearX, wheelY) {
    ctx.save();
    ctx.fillStyle = '#080510';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#322B42';
    ctx.fillRect(frontX - 8, wheelY - 4, 16, 8);
    ctx.strokeRect(frontX - 8, wheelY - 4, 16, 8);
    ctx.fillRect(rearX - 8, wheelY - 4, 16, 8);
    ctx.strokeRect(rearX - 8, wheelY - 4, 16, 8);
    ctx.restore();
  }
}

// --- 8. PLAYER CAR ENTITY ---
class PlayerCar {
  constructor() {
    this.x = 220;
    this.y = LANE_Y[0];
    this.targetY = LANE_Y[0];
    this.currentLane = 0;
    this.width = 115;
    this.height = 52;
    this.tiltAngle = 0;
    this.targetTilt = 0;
    this.isStunned = false;
    this.stunTimer = 0;
    this.stunSpinAngle = 0;
    this.animTimer = 0;
    this.afterImages = [];
  }

  reset() {
    this.currentLane = 0;
    this.y = LANE_Y[0];
    this.targetY = LANE_Y[0];
    this.tiltAngle = 0;
    this.targetTilt = 0;
    this.isStunned = false;
    this.stunTimer = 0;
    this.stunSpinAngle = 0;
    this.afterImages = [];
  }

  switchLane(direction) {
    if (this.isStunned) return false;
    if (direction === 'UP' && this.currentLane > 0) {
      this.currentLane = 0;
      this.targetY = LANE_Y[0];
      this.targetTilt = -0.22;
      return true;
    } else if (direction === 'DOWN' && this.currentLane < 1) {
      this.currentLane = 1;
      this.targetY = LANE_Y[1];
      this.targetTilt = 0.22;
      return true;
    }
    return false;
  }

  triggerStun() {
    this.isStunned = true;
    this.stunTimer = STUN_DURATION;
    this.stunSpinAngle = (Math.random() > 0.5 ? 1 : -1) * 0.35;
  }

  update(dt, isFever) {
    this.animTimer += dt;
    if (this.isStunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.isStunned = false;
        this.stunSpinAngle = 0;
      } else {
        this.stunSpinAngle *= 0.92;
      }
    }

    const diffY = this.targetY - this.y;
    this.y += diffY * Math.min(1, dt * 14);

    if (Math.abs(diffY) < 4) this.targetTilt = 0;
    this.tiltAngle += (this.targetTilt - this.tiltAngle) * Math.min(1, dt * 12);

    if (isFever && !this.isStunned) {
      this.afterImages.push({
        x: this.x,
        y: this.y,
        angle: this.tiltAngle,
        alpha: 0.6,
        color: Math.random() > 0.5 ? '#FF007F' : '#00F0FF',
      });
    }

    for (let i = this.afterImages.length - 1; i >= 0; i--) {
      const img = this.afterImages[i];
      img.x -= dt * 450;
      img.alpha -= dt * 2.8;
      if (img.alpha <= 0) this.afterImages.splice(i, 1);
    }
  }

  getPolygon() {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const cx = this.x;
    const cy = this.y;
    const angle = this.isStunned ? this.stunSpinAngle : this.tiltAngle;

    const localPts = [
      { x: halfW, y: 2 },
      { x: halfW - 14, y: -halfH + 12 },
      { x: halfW - 36, y: -halfH + 4 },
      { x: -halfW * 0.35, y: -halfH + 4 },
      { x: -halfW * 0.7, y: -halfH + 14 },
      { x: -halfW, y: -halfH + 18 },
      { x: -halfW, y: halfH - 8 },
      { x: halfW - 12, y: halfH - 8 },
    ];

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return localPts.map((pt) => ({
      x: cx + pt.x * cos - pt.y * sin,
      y: cy + pt.x * sin + pt.y * cos,
    }));
  }

  draw(ctx, isFever) {
    ctx.save();
    for (const img of this.afterImages) {
      ctx.save();
      ctx.translate(img.x, img.y);
      ctx.rotate(img.angle);
      ctx.globalAlpha = img.alpha;
      ctx.fillStyle = img.color;
      ctx.fillRect(-this.width / 2, -this.height / 2 + 8, this.width, this.height - 16);
      ctx.restore();
    }

    if (!this.isStunned) this.drawHeadlights(ctx, isFever);

    ctx.translate(this.x, this.y);
    const angle = this.isStunned ? this.stunSpinAngle : this.tiltAngle;
    ctx.rotate(angle);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowOffsetY = 16;
    ctx.shadowBlur = 14;

    this.drawCarBody(ctx, isFever);
    if (isFever && !this.isStunned) this.drawFeverShield(ctx);

    ctx.restore();
  }

  drawHeadlights(ctx, isFever) {
    ctx.save();
    const beamStartX = this.x + this.width / 2;
    const beamStartY = this.y;
    const beamLength = isFever ? 320 : 220;

    const grad = ctx.createRadialGradient(
      beamStartX,
      beamStartY,
      10,
      beamStartX + beamLength * 0.7,
      beamStartY,
      beamLength
    );
    grad.addColorStop(0, isFever ? 'rgba(255, 0, 128, 0.45)' : 'rgba(0, 240, 255, 0.4)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamStartY - 10);
    ctx.lineTo(beamStartX + beamLength, beamStartY - 55);
    ctx.lineTo(beamStartX + beamLength, beamStartY + 55);
    ctx.lineTo(beamStartX, beamStartY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawCarBody(ctx, isFever) {
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    const basePts = [
      { x: halfW, y: 2 },
      { x: halfW - 14, y: -halfH + 12 },
      { x: halfW - 36, y: -halfH + 4 },
      { x: -halfW * 0.35, y: -halfH + 4 },
      { x: -halfW * 0.7, y: -halfH + 14 },
      { x: -halfW, y: -halfH + 18 },
      { x: -halfW, y: halfH - 8 },
      { x: halfW - 12, y: halfH - 8 },
    ];

    const bodyGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
    if (isFever) {
      bodyGrad.addColorStop(0, '#FF007F');
      bodyGrad.addColorStop(0.5, '#FFE600');
      bodyGrad.addColorStop(1, '#00F0FF');
    } else {
      bodyGrad.addColorStop(0, '#0E0922');
      bodyGrad.addColorStop(0.5, '#1E1747');
      bodyGrad.addColorStop(1, '#00C3FF');
    }

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(basePts[0].x, basePts[0].y);
    for (let i = 1; i < basePts.length; i++) ctx.lineTo(basePts[i].x, basePts[i].y);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#040209';
    ctx.stroke();

    ctx.fillStyle = isFever ? '#FFE600' : '#00F0FF';
    ctx.beginPath();
    ctx.moveTo(halfW - 38, -halfH + 6);
    ctx.lineTo(-halfW * 0.28, -halfH + 6);
    ctx.lineTo(-halfW * 0.28, -2);
    ctx.lineTo(halfW - 30, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFever ? '#FF007F' : '#00F0FF';
    ctx.fillRect(-halfW + 24, 0, this.width - 44, 4);

    ctx.fillStyle = '#06030F';
    ctx.fillRect(-halfW, -halfH + 8, 14, 5);
    ctx.strokeRect(-halfW, -halfH + 8, 14, 5);

    ctx.fillStyle = '#FFFFFF';
    ctx.shadowBlur = 12;
    ctx.shadowColor = isFever ? '#FF007F' : '#00F0FF';
    ctx.fillRect(halfW - 8, -2, 6, 8);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FF0033';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FF0033';
    ctx.fillRect(-halfW, 2, 4, 10);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#07050E';
    ctx.fillRect(-halfW + 18, halfH - 10, 20, 8);
    ctx.fillRect(halfW - 36, halfH - 10, 20, 8);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#372C54';
    ctx.strokeRect(-halfW + 18, halfH - 10, 20, 8);
    ctx.strokeRect(halfW - 36, halfH - 10, 20, 8);

    ctx.fillStyle = isFever ? '#FFE600' : '#00F0FF';
    ctx.fillRect(-halfW + 25, halfH - 8, 6, 4);
    ctx.fillRect(halfW - 29, halfH - 8, 6, 4);
  }

  drawFeverShield(ctx) {
    ctx.save();
    const pulse = Math.sin(this.animTimer * 12) * 4;
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#FFE600';
    ctx.strokeStyle = '#FFF176';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.width * 0.65 + pulse, this.height * 0.75 + pulse, 0, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      const arcAngle = this.animTimer * 10 + (i * Math.PI) / 2;
      const arcX = Math.cos(arcAngle) * (this.width * 0.65);
      const arcY = Math.sin(arcAngle) * (this.height * 0.75);
      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.arc(arcX, arcY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// --- 9. CENTRAL GAME ORCHESTRATOR ---
class Game {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');
    this.ctx = ctx;

    this.onStatsChange = callbacks.onStatsChange;
    this.onStateChange = callbacks.onStateChange;

    this.state = 'READY';
    this.lastTime = 0;
    this.animFrameId = null;

    this.background = new Background();
    this.player = new PlayerCar();
    this.obstacles = [];
    this.particles = new ParticleSystem();
    this.floatingTexts = new FloatingTextManager();

    this.score = 0;
    this.timeRemaining = TOTAL_GAME_TIME;
    this.nitro = 0;
    this.isFever = false;
    this.feverTimer = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.nearMissCount = 0;
    this.crashCount = 0;
    this.smashCount = 0;
    this.highScore = 0;

    this.spawnTimer = 0;
    this.lastSpawnedLane = 0;
    this.lastTickSecond = 6;

    const saved = localStorage.getItem('nitro_dash_highscore');
    if (saved) this.highScore = parseInt(saved, 10) || 0;

    this.setupListeners();
    this.lastTime = performance.now();
    this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
    this.render();
  }

  setupListeners() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    soundEngine.stopEngine();
  }

  handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.state === 'PLAYING') this.pause();
      else if (this.state === 'PAUSED') this.resume();
      else if (this.state === 'READY' || this.state === 'GAMEOVER') this.start();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.state === 'GAMEOVER' || this.state === 'PAUSED') {
        this.ready();
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      this.switchLane('UP');
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      this.switchLane('DOWN');
    }
  }

  switchLane(direction) {
    if (this.state !== 'PLAYING') return;
    const switched = this.player.switchLane(direction);
    if (switched) {
      soundEngine.playLaneSwitch();
      this.particles.emitExhaustFlame(this.player.x - 45, this.player.y, this.isFever);
    }
  }

  ready() {
    this.state = 'READY';
    soundEngine.stopEngine();

    this.timeRemaining = TOTAL_GAME_TIME;
    this.score = 0;
    this.nitro = 0;
    this.isFever = false;
    this.feverTimer = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.nearMissCount = 0;
    this.crashCount = 0;
    this.smashCount = 0;
    this.spawnTimer = 0;
    this.obstacles = [];

    this.player.reset();

    if (this.onStateChange) this.onStateChange(this.state);
    this.emitStats();
  }

  start() {
    this.state = 'PLAYING';
    this.timeRemaining = TOTAL_GAME_TIME;
    this.score = 0;
    this.nitro = 0;
    this.isFever = false;
    this.feverTimer = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.nearMissCount = 0;
    this.crashCount = 0;
    this.smashCount = 0;
    this.spawnTimer = 0.5;
    this.obstacles = [];
    this.lastTickSecond = 6;

    this.player.reset();
    soundEngine.startEngine();

    if (this.onStateChange) this.onStateChange(this.state);
    this.emitStats();

    this.lastTime = performance.now();
  }

  pause() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    soundEngine.stopEngine();
    if (this.onStateChange) this.onStateChange(this.state);
    this.emitStats();
  }

  resume() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    soundEngine.startEngine();
    if (this.onStateChange) this.onStateChange(this.state);
    this.emitStats();
    this.lastTime = performance.now();
  }

  restart() {
    this.start();
  }

  loop(timestamp) {
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    if (dt > 0.08) dt = 0.08;

    try {
      if (this.state === 'PLAYING') {
        this.update(dt);
      } else if (this.state === 'READY') {
        // Idle gentle parallax on ready/title screen
        this.background.update(dt, 90);
        this.player.update(dt, false);
      } else if (this.state === 'GAMEOVER') {
        // Subtle drift and settling particles on game over screen
        this.background.update(dt, 50);
        this.particles.update(dt, false);
      }
      this.render();
    } catch (err) {
      console.error('Game loop error:', err);
    }

    this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
  }

  update(dt) {
    this.timeRemaining -= dt;

    if (this.timeRemaining <= 5.0 && this.timeRemaining > 0) {
      const curSec = Math.ceil(this.timeRemaining);
      if (curSec < this.lastTickSecond) {
        soundEngine.playTick();
        this.lastTickSecond = curSec;
      }
    }

    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.gameOver();
      return;
    }

    if (this.isFever) {
      this.feverTimer -= dt;
      this.nitro = Math.max(0, (this.feverTimer / FEVER_DURATION) * 100);
      if (this.feverTimer <= 0) {
        this.isFever = false;
        this.feverTimer = 0;
        this.nitro = 0;
      }
    } else {
      if (this.nitro >= 100) this.activateFever();
    }

    let currentSpeed = NORMAL_ROAD_SPEED;
    if (this.isFever) {
      currentSpeed = FEVER_ROAD_SPEED;
    } else if (this.player.isStunned) {
      currentSpeed = 0;
    }

    soundEngine.updateEnginePitch(currentSpeed / NORMAL_ROAD_SPEED, this.isFever);

    this.background.update(dt, currentSpeed);
    this.player.update(dt, this.isFever);
    this.particles.update(dt, this.isFever);
    this.floatingTexts.update(dt);

    if (currentSpeed > 0 && Math.random() < 0.6) {
      this.particles.emitExhaustFlame(this.player.x - 48, this.player.y + 4, this.isFever);
    }

    this.updateSpawning(dt);
    this.updateObstacles(dt, currentSpeed);
    this.emitStats();
  }

  activateFever() {
    this.isFever = true;
    this.feverTimer = FEVER_DURATION;
    this.nitro = 100;
    try {
      soundEngine.playFeverStart();
    } catch (e) {
      console.warn('Audio playFeverStart error:', e);
    }
    this.particles.triggerFlash('#FFE600', 0.65);
    this.particles.triggerShake(12);
    this.particles.emitFeverBurst();
    this.floatingTexts.add('FEVER TIME!', this.player.x + 80, this.player.y - 45, '#FFE600', '무적 질주 + 속도 2배!', '#FF007F');
  }

  updateSpawning(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const elapsed = TOTAL_GAME_TIME - this.timeRemaining;
      let interval = elapsed < 10 ? 2.2 - (elapsed / 10) * 0.5 : 1.7 - ((elapsed - 10) / 30) * 0.95;
      this.spawnTimer = interval;
      this.spawnObstacle();
    }
  }

  spawnObstacle() {
    const chosenLane = Math.random() > 0.5 ? 0 : 1;
    const spawnX = VIRTUAL_WIDTH + 80;
    const otherLane = chosenLane === 0 ? 1 : 0;

    const tooCloseOpposite = this.obstacles.some(
      (ob) => ob.lane === otherLane && Math.abs(ob.x - spawnX) < MIN_OBSTACLE_SPACING_X
    );

    if (tooCloseOpposite) {
      const tooCloseSame = this.obstacles.some(
        (ob) => ob.lane === chosenLane && Math.abs(ob.x - spawnX) < MIN_OBSTACLE_SPACING_X * 0.7
      );
      if (tooCloseSame) {
        this.spawnTimer = 0.35;
        return;
      }
    }

    const types = ['POLICE', 'TRUCK', 'TAXI', 'BARRIER'];
    const type = types[Math.floor(Math.random() * types.length)];
    const obstacleY = LANE_Y[chosenLane];
    this.obstacles.push(new Obstacle(spawnX, obstacleY, chosenLane, type));
    this.lastSpawnedLane = chosenLane;
  }

  updateObstacles(dt, roadSpeed) {
    const playerPoly = this.player.getPolygon();

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const ob = this.obstacles[i];
      ob.update(dt, roadSpeed);

      if (ob.x < -200 || ob.isDestroyed) {
        this.obstacles.splice(i, 1);
        continue;
      }

      if (!this.player.isStunned && !ob.isCollided && !ob.isDestroyed) {
        const obPoly = ob.getPolygon();

        // Direct Hitbox Collision
        if (checkAABBOverlap(playerPoly, obPoly) && checkPolygonIntersection(playerPoly, obPoly)) {
          if (this.isFever) {
            ob.isDestroyed = true;
            this.score += SMASH_POINTS;
            this.smashCount++;
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            soundEngine.playSmash();
            this.particles.emitSmashExplosion(ob.x, ob.y);
            this.floatingTexts.add(
              `+${SMASH_POINTS.toLocaleString()} SMASH!`,
              ob.x,
              ob.y - 20,
              '#FFE600',
              this.combo > 1 ? `COMBO x${this.combo}!` : null,
              '#FF007F'
            );
          } else {
            ob.isCollided = true;
            if (ob.nearMissTriggered) {
              this.score = Math.max(0, this.score - NEAR_MISS_POINTS);
              this.nearMissCount = Math.max(0, this.nearMissCount - 1);
              this.nitro = Math.max(0, this.nitro - NEAR_MISS_NITRO_GAIN);
            }
            this.score = Math.max(0, this.score - CRASH_POINTS);
            this.nitro = Math.max(0, this.nitro - 25);
            this.crashCount++;
            this.combo = 0;

            soundEngine.playCrash();
            this.player.triggerStun();
            this.particles.emitCrashSmoke(this.player.x, this.player.y);
            this.floatingTexts.add(
              `-${CRASH_POINTS.toLocaleString()} CRASH!`,
              this.player.x,
              this.player.y - 45,
              '#FF2A4D',
              ob.nearMissTriggered ? '스침 무효 & 니트로 감소!' : '감점 & 니트로 감소!',
              '#000000'
            );
          }
          continue;
        }

        // Near-miss Detection
        if (!ob.nearMissTriggered && !this.isFever && !this.player.isStunned) {
          const nearPoly = ob.getNearMissPolygon();
          if (checkAABBOverlap(playerPoly, nearPoly) && checkPolygonIntersection(playerPoly, nearPoly)) {
            ob.nearMissTriggered = true;
            this.score += NEAR_MISS_POINTS;
            this.nearMissCount++;
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            this.nitro = Math.min(100, this.nitro + NEAR_MISS_NITRO_GAIN);

            soundEngine.playNearMiss();
            this.particles.emitNearMissSparks(this.player.x + 35, (this.player.y + ob.y) / 2);
            this.floatingTexts.add(
              `+${NEAR_MISS_POINTS.toLocaleString()} NEAR MISS!`,
              this.player.x + 60,
              this.player.y - 40,
              '#00F0FF',
              `NITRO +${NEAR_MISS_NITRO_GAIN}% ${this.combo > 1 ? `(x${this.combo} COMBO!)` : ''}`,
              '#081735'
            );
          }
        }
      }
    }
  }

  gameOver() {
    this.state = 'GAMEOVER';
    soundEngine.stopEngine();
    try {
      soundEngine.playGameOver();
    } catch (e) {
      console.warn('Audio playGameOver error:', e);
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('nitro_dash_highscore', this.highScore.toString());
    }

    if (this.onStateChange) this.onStateChange(this.state);
    this.emitStats();
  }

  emitStats() {
    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.score,
        timeRemaining: this.timeRemaining,
        totalTime: TOTAL_GAME_TIME,
        nitro: this.nitro,
        isFever: this.isFever,
        feverTimeLeft: this.feverTimer,
        combo: this.combo,
        maxCombo: this.maxCombo,
        nearMissCount: this.nearMissCount,
        crashCount: this.crashCount,
        smashCount: this.smashCount,
        highScore: this.highScore,
        currentSpeed: this.isFever ? FEVER_ROAD_SPEED : NORMAL_ROAD_SPEED,
      });
    }
  }

  render() {
    const ctx = this.ctx;
    const time = performance.now() / 1000;

    ctx.save();

    // Differentiated Screen Shake (Rotational roll + directional displacement)
    if (this.particles.shakeTrauma > 0.001) {
      const cx = VIRTUAL_WIDTH / 2;
      const cy = VIRTUAL_HEIGHT / 2;
      ctx.translate(cx, cy);
      ctx.rotate(this.particles.shakeRotation);
      ctx.translate(-cx + this.particles.shakeOffsetX, -cy + this.particles.shakeOffsetY);
    }

    this.background.draw(ctx, this.isFever, time);

    for (const ob of this.obstacles) {
      ob.draw(ctx);
    }

    this.player.draw(ctx, this.isFever);
    this.particles.draw(ctx);

    if (this.isFever || this.particles.feverIntensity > 0.01) {
      this.particles.drawSpeedBlur(ctx, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    }

    this.floatingTexts.draw(ctx);
    this.particles.drawFlashOverlay(ctx, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (this.state === 'PLAYING' || this.state === 'PAUSED') {
      this.drawInCanvasHUD(ctx);
    }

    ctx.restore();
  }

  drawInCanvasHUD(ctx) {
    ctx.save();
    const timeSec = Math.max(0, this.timeRemaining);
    const isUrgent = timeSec <= 5.0 && timeSec > 0;
    const timeColor = isUrgent ? '#FF2A4D' : '#00F0FF';

    const leftX = 30;
    const topY = 20;
    const cardH = 64;

    // Time Card
    ctx.fillStyle = 'rgba(10, 7, 24, 0.88)';
    ctx.fillRect(leftX, topY, 210, cardH);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = timeColor;
    ctx.strokeRect(leftX, topY, 210, cardH);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 12px Jua, sans-serif';
    ctx.fillStyle = '#9BA8C7';
    ctx.fillText('남은 시간 (TIME LEFT)', leftX + 16, topY + 8);

    ctx.font = '900 34px Jua, sans-serif';
    ctx.fillStyle = timeColor;
    ctx.shadowBlur = isUrgent ? 12 : 6;
    ctx.shadowColor = timeColor;
    ctx.fillText(`${timeSec.toFixed(1)}s`, leftX + 16, topY + 23);
    ctx.shadowBlur = 0;

    // Nitro Gauge Card
    const centerW = 420;
    const centerX = (VIRTUAL_WIDTH - centerW) / 2;

    ctx.fillStyle = 'rgba(10, 7, 24, 0.88)';
    ctx.fillRect(centerX, topY, centerW, cardH);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.isFever ? '#FFE600' : '#473674';
    ctx.strokeRect(centerX, topY, centerW, cardH);

    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Jua, sans-serif';
    ctx.fillStyle = this.isFever ? '#FFE600' : '#00F0FF';
    ctx.fillText(
      this.isFever
        ? `🔥 FEVER TIME! 무적 질주 중 (${this.feverTimer.toFixed(1)}s) 🔥`
        : `⚡ NITRO GAUGE (${Math.floor(this.nitro)}%) ⚡`,
      VIRTUAL_WIDTH / 2,
      topY + 8
    );

    const barW = centerW - 32;
    const barH = 20;
    const barX = centerX + 16;
    const barY = topY + 32;

    ctx.fillStyle = '#17122E';
    ctx.fillRect(barX, barY, barW, barH);

    const fillW = (barW * Math.min(100, this.nitro)) / 100;
    if (fillW > 0) {
      const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      if (this.isFever) {
        fillGrad.addColorStop(0, '#FF007F');
        fillGrad.addColorStop(0.5, '#FFE600');
        fillGrad.addColorStop(1, '#00F0FF');
      } else {
        fillGrad.addColorStop(0, '#0072FF');
        fillGrad.addColorStop(1, '#00F0FF');
      }
      ctx.fillStyle = fillGrad;
      ctx.fillRect(barX + 2, barY + 2, fillW - 4, barH - 4);
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = this.isFever ? '#FFE600' : '#00F0FF';
    ctx.strokeRect(barX, barY, barW, barH);

    // Score Card
    const rightW = 230;
    const rightX = VIRTUAL_WIDTH - rightW - 30;

    ctx.fillStyle = 'rgba(10, 7, 24, 0.88)';
    ctx.fillRect(rightX, topY, rightW, cardH);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFE600';
    ctx.strokeRect(rightX, topY, rightW, cardH);

    ctx.textAlign = 'right';
    ctx.font = 'bold 12px Jua, sans-serif';
    ctx.fillStyle = '#9BA8C7';
    ctx.fillText('현재 점수 (SCORE)', rightX + rightW - 16, topY + 8);

    ctx.font = '900 34px Jua, sans-serif';
    ctx.fillStyle = '#FFE600';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#FFE600';
    ctx.fillText(this.score.toLocaleString(), rightX + rightW - 16, topY + 23);
    ctx.shadowBlur = 0;

    if (this.combo > 1) {
      ctx.textAlign = 'right';
      ctx.font = '900 20px Jua, sans-serif';
      ctx.fillStyle = '#FF007F';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FF007F';
      ctx.fillText(`🔥 ${this.combo} COMBO!`, rightX + rightW - 16, topY + cardH + 26);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

// --- 10. APP INITIALIZER & DOM UI GLUE ---
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  // DOM Overlay Elements
  const overlayReady = document.getElementById('overlay-ready');
  const overlayPaused = document.getElementById('overlay-paused');
  const overlayGameOver = document.getElementById('overlay-gameover');
  const modalHelp = document.getElementById('modal-help');

  // Header Elements
  const headerHighScore = document.getElementById('header-highscore');
  const btnPauseHeader = document.getElementById('btn-pause-header');
  const btnMuteHeader = document.getElementById('btn-mute-header');
  const btnHelpHeader = document.getElementById('btn-help-header');
  const muteLabel = document.getElementById('mute-label');
  const soundIconContainer = document.getElementById('sound-icon-container');

  // Buttons in Modals
  const btnStart = document.getElementById('btn-start');
  const btnResume = document.getElementById('btn-resume');
  const btnRestartPaused = document.getElementById('btn-restart-paused');
  const btnRestartGameOver = document.getElementById('btn-restart-gameover');
  const btnHomeGameOver = document.getElementById('btn-home-gameover');
  const btnCloseHelp = document.getElementById('btn-close-help');

  // Mobile Touch Controls
  const mobileControls = document.getElementById('mobile-controls');
  const btnLaneUp = document.getElementById('btn-lane-up');
  const btnLaneDown = document.getElementById('btn-lane-down');

  // Game Over Results Display Elements
  const resultRank = document.getElementById('result-rank');
  const resultRankLabel = document.getElementById('result-rank-label');
  const resultScore = document.getElementById('result-score');
  const resultNewRecord = document.getElementById('result-new-record');
  const resultNearMiss = document.getElementById('result-nearmiss');
  const resultSmash = document.getElementById('result-smash');
  const resultCrash = document.getElementById('result-crash');
  const resultCombo = document.getElementById('result-combo');

  function getRankBadge(score) {
    if (score >= 45000) return { rank: 'SSS', label: '신급 드라이버', colorClass: 'from-amber-300 via-rose-400 to-cyan-400' };
    if (score >= 32000) return { rank: 'SS', label: '전설의 레이서', colorClass: 'from-yellow-400 to-amber-500' };
    if (score >= 22000) return { rank: 'S', label: '슈퍼 스피드스터', colorClass: 'from-cyan-400 to-blue-500' };
    if (score >= 14000) return { rank: 'A', label: '베테랑 라이더', colorClass: 'from-emerald-400 to-teal-500' };
    if (score >= 7000) return { rank: 'B', label: '스트리트 루키', colorClass: 'from-indigo-400 to-purple-500' };
    return { rank: 'C', label: '초보 운전자', colorClass: 'from-slate-400 to-gray-500' };
  }

  function renderLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  const game = new Game(canvas, {
    onStateChange: (state) => {
      // Manage Overlay Visibility
      if (overlayReady) overlayReady.classList.toggle('hidden', state !== 'READY');
      if (overlayPaused) overlayPaused.classList.toggle('hidden', state !== 'PAUSED');
      if (overlayGameOver) overlayGameOver.classList.toggle('hidden', state !== 'GAMEOVER');
      if (mobileControls) mobileControls.classList.toggle('hidden', state !== 'PLAYING');

      if (btnPauseHeader) {
        if (state === 'PLAYING') {
          btnPauseHeader.classList.remove('hidden');
          btnPauseHeader.innerHTML = '<i data-lucide="pause" class="w-3.5 h-3.5"></i><span class="hidden sm:inline">일시정지</span>';
        } else if (state === 'PAUSED') {
          btnPauseHeader.classList.remove('hidden');
          btnPauseHeader.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5 fill-white"></i><span>계속하기</span>';
        } else {
          btnPauseHeader.classList.add('hidden');
        }
        renderLucideIcons();
      }
    },
    onStatsChange: (stats) => {
      if (headerHighScore) {
        headerHighScore.textContent = stats.highScore.toLocaleString();
      }

      // Populate Game Over Screen
      if (game.state === 'GAMEOVER') {
        const rankInfo = getRankBadge(stats.score);
        if (resultRank) {
          resultRank.textContent = rankInfo.rank;
          resultRank.className = `text-5xl sm:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${rankInfo.colorClass} drop-shadow-[0_0_25px_rgba(255,230,0,0.6)] font-orbitron`;
        }
        if (resultRankLabel) resultRankLabel.textContent = rankInfo.label;
        if (resultScore) resultScore.textContent = stats.score.toLocaleString();
        if (resultNewRecord) {
          resultNewRecord.classList.toggle('hidden', !(stats.score >= stats.highScore && stats.score > 0));
        }
        if (resultNearMiss) resultNearMiss.textContent = `${stats.nearMissCount}회`;
        if (resultSmash) resultSmash.textContent = `${stats.smashCount}회`;
        if (resultCrash) resultCrash.textContent = `${stats.crashCount}회`;
        if (resultCombo) resultCombo.textContent = `${stats.maxCombo}연속`;
      }
    },
  });

  // Attach DOM Listeners
  if (btnStart) btnStart.addEventListener('click', () => game.start());
  if (btnResume) btnResume.addEventListener('click', () => game.resume());
  if (btnRestartPaused) btnRestartPaused.addEventListener('click', () => game.restart());
  if (btnRestartGameOver) btnRestartGameOver.addEventListener('click', () => game.restart());
  if (btnHomeGameOver) btnHomeGameOver.addEventListener('click', () => game.ready());

  if (btnPauseHeader) {
    btnPauseHeader.addEventListener('click', () => {
      if (game.state === 'PLAYING') game.pause();
      else if (game.state === 'PAUSED') game.resume();
    });
  }

  if (btnMuteHeader) {
    btnMuteHeader.addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      if (muteLabel) {
        muteLabel.textContent = isMuted ? '음소거' : '사운드';
        muteLabel.className = isMuted ? 'hidden sm:inline text-rose-400' : 'hidden sm:inline text-cyan-400';
      }
      if (soundIconContainer) {
        soundIconContainer.innerHTML = isMuted
          ? '<i data-lucide="volume-x" class="w-4 h-4 text-rose-400"></i>'
          : '<i data-lucide="volume-2" class="w-4 h-4 text-cyan-400"></i>';
        renderLucideIcons();
      }
    });
  }

  if (btnHelpHeader) btnHelpHeader.addEventListener('click', () => modalHelp.classList.remove('hidden'));
  if (btnCloseHelp) btnCloseHelp.addEventListener('click', () => modalHelp.classList.add('hidden'));

  // Mobile Touch & Click controls (Zero-latency instant response)
  const bindTouchAndClick = (element, action) => {
    if (!element) return;
    let lastTouchTime = 0;
    element.addEventListener('touchstart', (e) => {
      e.preventDefault();
      lastTouchTime = Date.now();
      action();
    }, { passive: false });

    element.addEventListener('click', (e) => {
      e.preventDefault();
      if (Date.now() - lastTouchTime < 400) return; // Prevent duplicate trigger from touch
      action();
    });
  };

  bindTouchAndClick(btnLaneUp, () => game.switchLane('UP'));
  bindTouchAndClick(btnLaneDown, () => game.switchLane('DOWN'));

  // Initial render
  if (headerHighScore) headerHighScore.textContent = game.highScore.toLocaleString();
  renderLucideIcons();
});
