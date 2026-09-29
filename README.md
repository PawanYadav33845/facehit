# 🎯 FaceHit: Dynamic Facial Whack-A-Mole

[![Netlify Status](https://img.shields.io/badge/Netlify-Deployed-00C7B7?style=flat&logo=netlify)](https://classy-kangaroo-902357.netlify.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Security: AES-GCM Encrypted](https://img.shields.io/badge/Database-AES--256--GCM-green?logo=keybase)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

**FaceHit** is an interactive web-based arcade game that uses AI facial recognition to let players play Whack-A-Mole using their nose as the controller!

🌐 **Live Demo:** [classy-kangaroo-902357.netlify.app](https://classy-kangaroo-902357.netlify.app/)

---

## ✨ Features

- 👃 **AI Facial Recognition Control**: Uses `ml5.js` PoseNet and `p5.js` to detect webcam input in real-time, tracking your nose coordinates as a dynamic game reticle.
- ❤️ **3 Lives System**: Players get 3 lives (`❤️❤️❤️`). Missing a target deducts a life and resets the combo multiplier. The game ends when all 3 lives are lost.
- 🎉 **High Score Celebration**: Setting a new all-time high record triggers a festive celebration with falling confetti particles, sound fanfare, and a victory champion banner.
- 🔒 **AES-256 Encrypted Local Database**: Player high scores and names are securely encrypted on the client side using AES-GCM (Web Crypto API) with PBKDF2 key derivation and a cipher fallback.
- 👑 **Highest Record Highlighting**: The top score ever recorded is prominently featured in the top header banner and highlighted on the leaderboard with a golden 👑 crown badge.
- ⚡ **Combos & Speed Scoring**: Earn higher multipliers (+2, +3, combo multipliers) by hitting targets faster.
- 🎨 **Modern Cyberpunk Arcade GUI**: Sleek dark-mode aesthetic with glassmorphism overlays, floating score text (+3 PERFECT!), particle burst visual effects, and real-time HUD stats.
- 🎵 **Procedural Audio Synthesizer**: Custom sound effects and chimes generated with `Tone.js`, complete with a mute/unmute toggle.
- 🌐 **Netlify Deployment Ready**: Includes pre-configured `netlify.toml` for standard static hosting with security headers.

---

## 🛠️ Tech Stack

- **Frontend Core**: HTML5, CSS3 (Modern Flexbox/Grid, Glassmorphism)
- **Computer Vision & AI**: [ml5.js (PoseNet)](https://ml5js.org/)
- **Graphics & Rendering**: [p5.js](https://p5js.org/)
- **Audio Synthesizer**: [Tone.js](https://tonejs.github.io/)
- **Security / Encryption**: Web Crypto API (AES-GCM, PBKDF2)
- **Deployment Platform**: Netlify

---

## 🚀 Quick Start (Local Setup)

1. **Clone the Repository**
   ```bash
   git clone https://github.com/PawanYadav33845/facehit.git
   cd facehit
   ```

2. **Serve the Project**
   Because the app requests webcam access, open it using a local web server (e.g. VS Code Live Server, `http-server`, or Python's HTTP server):
   ```bash
   python -m http.server 8000
   ```
   Or using Node `npx`:
   ```bash
   npx serve .
   ```

3. **Play in Browser**
   Navigate to `http://localhost:8000` or `http://localhost:3000` in Google Chrome, Edge, or Firefox, allow webcam permissions, and click **PLAY NOW**!

---

## 🔒 Security & Data Encryption

High score records stored in `localStorage` are encrypted before writing to disk using **AES-256-GCM**:
- **Key Derivation**: PBKDF2 with SHA-256 and 50,000 iterations.
- **Initialization Vector**: Cryptographically secure random 12-byte IV generated per write payload.
- **Fallback Protection**: An obfuscated cipher fallback ensures smooth execution across restricted browser environments.

---

## 📜 License

This project is open source and available under the [MIT License](LICENSE).
