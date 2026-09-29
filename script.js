// --- Encrypted Storage System (AES-GCM Web Crypto with Cipher Fallback) ---
const EncryptedDB = {
  STORAGE_KEY: "facehit_encrypted_leaderboard_v2",
  SECRET_PASS: "FaceHit-AES256-Encrypted-Key-2026",

  fallbackEncrypt(dataStr) {
    const key = this.SECRET_PASS;
    let result = "";
    for (let i = 0; i < dataStr.length; i++) {
      result += String.fromCharCode(dataStr.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return "FB64:" + btoa(result);
  },

  fallbackDecrypt(cipherStr) {
    if (!cipherStr.startsWith("FB64:")) return null;
    const rawCipher = atob(cipherStr.slice(5));
    const key = this.SECRET_PASS;
    let result = "";
    for (let i = 0; i < rawCipher.length; i++) {
      result += String.fromCharCode(rawCipher.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  },

  async getKey() {
    if (!window.crypto || !window.crypto.subtle) return null;
    try {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(this.SECRET_PASS),
        "PBKDF2",
        false,
        ["deriveKey"]
      );
      return await crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: enc.encode("facehit_salt_secure_2026"),
          iterations: 50000,
          hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    } catch (e) {
      console.warn("WebCrypto key derivation failed, fallback active:", e);
      return null;
    }
  },

  async encrypt(dataObj) {
    const jsonStr = JSON.stringify(dataObj);
    try {
      const key = await this.getKey();
      if (!key) return this.fallbackEncrypt(jsonStr);

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const encodedData = enc.encode(jsonStr);
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encodedData
      );

      const ivBase64 = btoa(String.fromCharCode(...iv));
      const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
      return JSON.stringify({ v: 1, iv: ivBase64, data: cipherBase64 });
    } catch (e) {
      return this.fallbackEncrypt(jsonStr);
    }
  },

  async decrypt(encryptedStr) {
    if (!encryptedStr) return null;
    if (encryptedStr.startsWith("FB64:")) {
      try {
        return JSON.parse(this.fallbackDecrypt(encryptedStr));
      } catch (e) { return null; }
    }
    try {
      const parsed = JSON.parse(encryptedStr);
      if (!parsed || !parsed.iv || !parsed.data) return null;

      const key = await this.getKey();
      if (!key) return null;

      const iv = new Uint8Array(atob(parsed.iv).split("").map(c => c.charCodeAt(0)));
      const cipherBytes = new Uint8Array(atob(parsed.data).split("").map(c => c.charCodeAt(0)));

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        cipherBytes
      );

      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decryptedBuffer));
    } catch (e) {
      console.warn("AES decryption failed, checking fallback:", e);
      return null;
    }
  },

  async getScores() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      const defaultRecords = [
        { name: "NoseNinja", score: 35, hits: 14, maxCombo: 4, date: "2026-09-01" },
        { name: "CyberWhacker", score: 22, hits: 10, maxCombo: 3, date: "2026-09-10" },
        { name: "MoleBuster", score: 15, hits: 7, maxCombo: 2, date: "2026-09-15" }
      ];
      await this.saveScores(defaultRecords);
      return defaultRecords;
    }
    const decrypted = await this.decrypt(raw);
    return decrypted || [];
  },

  async saveScores(records) {
    records.sort((a, b) => b.score - a.score);
    const topRecords = records.slice(0, 10);
    const cipherText = await this.encrypt(topRecords);
    if (cipherText) {
      localStorage.setItem(this.STORAGE_KEY, cipherText);
    }
    return topRecords;
  },

  async clearScores() {
    localStorage.removeItem(this.STORAGE_KEY);
    return await this.getScores();
  }
};

// --- Game State & Variables ---
let video;
let poseNet;
let poses = [];

let loading = true;
let gameState = 0; // 0: Start Screen, 1: Playing, 2: Submit Score, 3: Leaderboard
let lives = 3;
let score = 0;
let hits = 0;
let combo = 1;
let maxCombo = 1;
let records = [];

let target = { x: 0, y: 0 };
let nose = { x: -1000, y: -1000 };
let rawNose = { x: -1000, y: -1000 };

let minRadius = 16;
let targetRadius = 60;
let radiusDecayRate = 0.96;

let minLimit = 1200;
let timeLimit = 5000;
let timeLimitDecayRate = 0.96;
let lastTimestamp;
let ratio = 1;

// Audio System
let synth;
let hitSynth;
let audioMuted = false;

// Visual FX
let floatingTexts = [];
let particles = [];
let confettiParticles = [];

// DOM Elements
const playBtn = document.getElementById("play-btn");
const startOverlay = document.getElementById("start-overlay");
const submitOverlay = document.getElementById("submit-overlay");
const leadersOverlay = document.getElementById("leaders-overlay");
const celebrationBanner = document.getElementById("celebration-banner");

const submitButton = document.getElementById("submit-button");
const nopeButton = document.getElementById("nope-button");
const playAgainButton = document.getElementById("play-again-button");
const clearScoresButton = document.getElementById("clear-scores-button");
const audioToggleBtn = document.getElementById("audio-toggle-btn");

const livesDisplay = document.getElementById("lives-display");
const scoreDisplay = document.getElementById("score-display");
const comboDisplay = document.getElementById("combo-display");
const hitsDisplay = document.getElementById("hits-display");
const submitScoreVal = document.getElementById("submit-score");

const topRecordName = document.getElementById("top-record-name");
const topRecordScore = document.getElementById("top-record-score");

// Initialize Audio Context & Listeners
if (typeof StartAudioContext === "function") {
  StartAudioContext(Tone.context, "#play-btn").then(() => {
    console.log("Tone AudioContext started.");
  });
}

// Event Listeners
playBtn.addEventListener("click", startGame);
submitButton.addEventListener("click", submitScore);
playAgainButton.addEventListener("click", startGame);
nopeButton.addEventListener("click", showLeaderboard);
clearScoresButton.addEventListener("click", clearLeaderboard);

audioToggleBtn.addEventListener("click", () => {
  audioMuted = !audioMuted;
  Tone.Master.mute = audioMuted;
  audioToggleBtn.textContent = audioMuted ? "🔇" : "🔊";
});

// --- p5.js Functions ---
function setup() {
  const canvas = createCanvas(640, 480);
  canvas.parent("p5-canvas");
  target = { x: width * 0.5, y: height * 0.5 };

  // Init Audio Synths
  try {
    synth = new Tone.PolySynth(3, Tone.Synth).toMaster();
    hitSynth = new Tone.MembraneSynth().toMaster();
  } catch (e) {
    console.warn("Tone audio initialization warning:", e);
  }

  // PoseNet & Webcam Setup
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  poseNet = ml5.poseNet(video, () => {
    loading = false;
    document.getElementById("loading-spinner").style.display = "none";
    document.getElementById("status-text").textContent = "AI Ready! Click Play to Start.";
    playBtn.disabled = false;
    playBtn.textContent = "PLAY NOW 🚀";
  });

  poseNet.on("pose", results => {
    poses = results;
  });

  // Load Encrypted High Scores
  loadEncryptedScores();
}

async function loadEncryptedScores() {
  records = await EncryptedDB.getScores();
  updateLeaderboardUI();
  updateTopRecordBanner();
}

function updateTopRecordBanner() {
  if (records && records.length > 0) {
    topRecordName.textContent = records[0].name;
    topRecordScore.textContent = `${records[0].score} pts`;
  } else {
    topRecordName.textContent = "None";
    topRecordScore.textContent = "0 pts";
  }
}

function startGame() {
  if (loading) return;

  hideAllOverlays();
  gameState = 1;
  lives = 3;
  score = 0;
  hits = 0;
  combo = 1;
  maxCombo = 1;
  targetRadius = 60;
  timeLimit = 5000;
  confettiParticles = [];
  
  updateHUD();
  resetTarget();
  resetTiming();

  // Audio start tone
  if (!audioMuted && synth) {
    try {
      synth.triggerAttackRelease(["C4", "E4", "G4"], "8n");
    } catch (e) {}
  }
}

function hideAllOverlays() {
  startOverlay.classList.remove("active");
  startOverlay.classList.add("hidden");
  submitOverlay.classList.remove("active");
  submitOverlay.classList.add("hidden");
  leadersOverlay.classList.remove("active");
  leadersOverlay.classList.add("hidden");
  celebrationBanner.classList.add("hidden");
}

function draw() {
  // Mirrored video feed for canvas game view
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);

  // Subtle dark video overlay for high contrast target visibility
  fill(15, 17, 26, 160);
  rect(-1, -1, width + 2, height + 2);

  if (gameState === 1) {
    updateNosePosition();
    drawTarget();
    drawNoseReticle();
    checkHit();
  }
  pop();

  // Un-flipped Canvas HUD & FX Layer
  if (gameState === 1) {
    drawTimingBar();
  }

  // Update and draw floating score text, particles, and celebration confetti
  updateAndDrawFX();
}

function updateNosePosition() {
  if (poses.length > 0 && poses[0].pose && poses[0].pose.keypoints) {
    const noseKeypoint = poses[0].pose.keypoints[0];
    if (noseKeypoint && noseKeypoint.score > 0.2) {
      rawNose = noseKeypoint.position;
      // Lerp for smooth tracking
      if (nose.x === -1000) {
        nose.x = rawNose.x;
        nose.y = rawNose.y;
      } else {
        nose.x = lerp(nose.x, rawNose.x, 0.4);
        nose.y = lerp(nose.y, rawNose.y, 0.4);
      }
    }
  }
}

function drawNoseReticle() {
  if (nose.x < 0) return;

  push();
  translate(nose.x, nose.y);
  
  // Outer glowing ring
  noFill();
  stroke(0, 242, 254, 200);
  strokeWeight(2);
  ellipse(0, 0, 24, 24);

  // Inner crosshair nose point
  fill(255, 8, 68);
  noStroke();
  ellipse(0, 0, 10, 10);
  pop();
}

function drawTarget() {
  push();
  translate(target.x, target.y);

  const pulse = 1 + 0.08 * Math.sin(frameCount * 0.15);
  const currentR = targetRadius * pulse;

  // Outer ring
  stroke(255, 215, 0);
  strokeWeight(4);
  noFill();
  ellipse(0, 0, currentR * 2, currentR * 2);

  // Inner bullseye target
  fill(255, 8, 68, 180);
  noStroke();
  ellipse(0, 0, currentR * 0.8, currentR * 0.8);

  fill(255, 255, 255);
  ellipse(0, 0, currentR * 0.3, currentR * 0.3);
  pop();
}

function checkHit() {
  if (nose.x < 0) return;

  const d = dist(target.x, target.y, nose.x, nose.y);
  if (d < targetRadius * 0.7) {
    // Target Hit!
    hits++;
    let points = 1;
    let fxText = "+1 HIT!";

    if (ratio > 0.6) {
      points = 3;
      combo++;
      fxText = `+3 PERFECT! 🔥 (Combo ${combo}x)`;
    } else if (ratio > 0.3) {
      points = 2;
      combo++;
      fxText = `+2 GREAT! ⚡`;
    } else {
      points = 1;
      combo = 1; // Reset combo on slow hit
    }

    if (combo > maxCombo) maxCombo = combo;
    score += points * combo;

    // Trigger Audio Synth Hit FX
    if (!audioMuted && synth) {
      try {
        if (points === 3) {
          synth.triggerAttackRelease(["C5", "E5", "G5"], "16n");
        } else if (points === 2) {
          synth.triggerAttackRelease(["E4", "G4"], "16n");
        } else {
          hitSynth.triggerAttackRelease("C3", "16n");
        }
      } catch (e) {}
    }

    // Canvas Mirrored -> Floating text screen position is (width - target.x, target.y)
    const screenX = width - target.x;
    const screenY = target.y;

    addFloatingText(fxText, screenX, screenY, points === 3 ? "#ffd700" : "#00f2fe");
    addParticleBurst(screenX, screenY);

    updateHUD();
    resetTarget();
    resetTiming();
  }
}

function resetTarget() {
  targetRadius = Math.max(minRadius, targetRadius * radiusDecayRate);
  const oldX = target.x;
  const oldY = target.y;

  let attempts = 0;
  while (attempts < 30) {
    const newX = map(Math.random(), 0, 1, 0.12 * width, 0.88 * width);
    const newY = map(Math.random(), 0, 1, 0.12 * height, 0.88 * height);
    if (dist(oldX, oldY, newX, newY) > width * 0.25) {
      target.x = newX;
      target.y = newY;
      break;
    }
    attempts++;
  }
}

function drawTimingBar() {
  push();
  const barWidth = 16;
  const barMarginRight = 20;
  const barMarginTop = 30;
  const barHeight = height - barMarginTop * 2;

  const timeElapsed = millis() - lastTimestamp;
  if (timeElapsed >= timeLimit) {
    missTarget();
    pop();
    return;
  }

  ratio = Math.max(0, 1 - timeElapsed / timeLimit);
  const currentHeight = barHeight * ratio;

  const x = width - barMarginRight - barWidth;
  const y = barMarginTop;

  // Background Bar Track
  fill(0, 0, 0, 150);
  stroke(255, 255, 255, 50);
  strokeWeight(2);
  rect(x, y, barWidth, barHeight, 8);

  // Dynamic Fill Color based on time ratio
  if (ratio > 0.6) {
    fill(0, 230, 118);
  } else if (ratio > 0.3) {
    fill(255, 215, 0);
  } else {
    fill(255, 8, 68);
  }
  noStroke();
  rect(x, y + (barHeight - currentHeight), barWidth, currentHeight, 8);
  pop();
}

function missTarget() {
  lives--;
  combo = 1;
  const screenX = width - target.x;
  const screenY = target.y;

  addFloatingText("MISSED! -1 ❤️", screenX, screenY, "#ff0844");

  if (!audioMuted && synth) {
    try {
      synth.triggerAttackRelease(["F2", "C2"], "8n");
    } catch (e) {}
  }

  updateHUD();

  if (lives <= 0) {
    gameOver();
  } else {
    resetTarget();
    resetTiming();
  }
}

function resetTiming() {
  lastTimestamp = millis();
  timeLimit = Math.max(minLimit, timeLimit * timeLimitDecayRate);
}

function updateHUD() {
  scoreDisplay.textContent = score;
  comboDisplay.textContent = `${combo}x`;
  hitsDisplay.textContent = hits;

  // Render Hearts for 3 Lives System
  let heartsStr = "";
  for (let i = 0; i < 3; i++) {
    heartsStr += i < lives ? "❤️" : "🖤";
  }
  livesDisplay.textContent = heartsStr;
}

function gameOver() {
  gameState = 2;
  submitScoreVal.textContent = score;

  const topScore = records.length > 0 ? records[0].score : 0;
  if (score > topScore && score > 0) {
    triggerCelebration();
  } else {
    celebrationBanner.classList.add("hidden");
    if (!audioMuted && synth) {
      try {
        synth.triggerAttackRelease(["C3", "G2"], "4n");
      } catch (e) {}
    }
  }

  submitOverlay.classList.remove("hidden");
  submitOverlay.classList.add("active");
}

function triggerCelebration() {
  celebrationBanner.classList.remove("hidden");

  // Play Fanfare Audio Effect
  if (!audioMuted && synth) {
    try {
      synth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "4n");
    } catch (e) {}
  }

  // Spawn Festive Confetti Particles
  confettiParticles = [];
  const colors = ["#ffd700", "#00f2fe", "#ff0844", "#00e676", "#ab47bc", "#ff9800"];
  for (let i = 0; i < 140; i++) {
    confettiParticles.push({
      x: Math.random() * width,
      y: Math.random() * -100,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * TWO_PI,
      vRot: (Math.random() - 0.5) * 0.2
    });
  }
}

// --- FX & Particles System ---
function addFloatingText(text, x, y, colorStr) {
  floatingTexts.push({
    text: text,
    x: x,
    y: y,
    alpha: 255,
    color: colorStr,
    life: 45
  });
}

function addParticleBurst(x, y) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * TWO_PI;
    const speed = Math.random() * 4 + 2;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 255,
      size: Math.random() * 6 + 3,
      color: Math.random() > 0.5 ? "#00f2fe" : "#ffd700"
    });
  }
}

function updateAndDrawFX() {
  push();
  // Floating Text
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let ft = floatingTexts[i];
    ft.y -= 1.2;
    ft.alpha -= 5;
    fill(ft.color);
    textSize(16);
    textAlign(CENTER);
    textStyle(BOLD);
    text(ft.text, ft.x, ft.y);

    if (ft.alpha <= 0) {
      floatingTexts.splice(i, 1);
    }
  }

  // Hit Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 8;
    fill(p.color);
    noStroke();
    ellipse(p.x, p.y, p.size, p.size);

    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }

  // Confetti Particles (Celebration Effect)
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    let cp = confettiParticles[i];
    cp.x += cp.vx;
    cp.y += cp.vy;
    cp.rotation += cp.vRot;

    push();
    translate(cp.x, cp.y);
    rotate(cp.rotation);
    fill(cp.color);
    noStroke();
    rect(-cp.size * 0.5, -cp.size * 0.5, cp.size, cp.size * 1.6);
    pop();

    if (cp.y > height + 20) {
      cp.y = -20;
      cp.x = Math.random() * width;
    }
  }
  pop();
}

// --- High Score Submission & Leaderboard ---
async function submitScore() {
  const nameInput = document.getElementById("name");
  let name = nameInput.value.trim();
  if (!name) name = "Player 1";

  submitButton.textContent = "Encrypting & Saving...";
  submitButton.disabled = true;

  const newEntry = {
    id: Date.now(),
    name: name,
    score: score,
    hits: hits,
    maxCombo: maxCombo,
    date: new Date().toISOString().split("T")[0]
  };

  records.push(newEntry);
  records = await EncryptedDB.saveScores(records);

  submitButton.textContent = "Save Encrypted Score";
  submitButton.disabled = false;
  nameInput.value = "";

  updateLeaderboardUI();
  updateTopRecordBanner();
  showLeaderboard();
}

function showLeaderboard() {
  hideAllOverlays();
  leadersOverlay.classList.remove("hidden");
  leadersOverlay.classList.add("active");
  gameState = 3;
}

function updateLeaderboardUI() {
  const ol = document.getElementById("leaders-ol");
  ol.innerHTML = "";

  if (!records || records.length === 0) {
    ol.innerHTML = `<li style="color: var(--text-muted); text-align: center;">No records set yet!</li>`;
    return;
  }

  records.forEach((rec, idx) => {
    const li = document.createElement("li");
    li.className = `leader-item ${idx === 0 ? "top-rank" : ""}`;

    const rankBadge = idx === 0 ? "👑" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

    li.innerHTML = `
      <div class="leader-info">
        <span class="rank-badge">${rankBadge}</span>
        <span class="leader-name">${escapeHTML(rec.name)}</span>
      </div>
      <span class="leader-score-val">${rec.score} pts</span>
    `;
    ol.appendChild(li);
  });
}

async function clearLeaderboard() {
  if (confirm("Are you sure you want to reset all encrypted scores?")) {
    records = await EncryptedDB.clearScores();
    updateLeaderboardUI();
    updateTopRecordBanner();
  }
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}