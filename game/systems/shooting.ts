import { MAX_RIPPLE_DELAY, RIPPLE_STEP } from "../config/gameConfig";
import { shuffle } from "../utils/math";

// ======================================================
// 🔫 BULLET CONFIG MAP
// ======================================================
const BULLET_TYPES = {
  normal: {
    range: 0.6,
    speed: 1.2,
    pattern: "single",
  },

  sniper: {
    range: 1.0,
    speed: 2.5,
    pattern: "single",
  },

  scatter: {
    range: 0.4,
    speed: 0.9,
    pattern: "spread",
    spread: 0.03,
    count: 3,
  },
};

// ======================================================
// MAIN SHOOT FUNCTION
// ======================================================
export function fireShots({ playerU, playerY, bubs, bullets, ROAD_MARGIN }) {
  // --------------------------------------------------
  // STEP 1: Build shooter list
  // --------------------------------------------------
  const shooters = [
    {
      type: "normal", // 👈 player uses normal bullets
      u: playerU,
      y: playerY,
    },

    ...bubs.map((b) => ({
      type: b.type || "normal",
      u: b.u,
      y: b.y,
    })),
  ];

  // --------------------------------------------------
  // STEP 2: Shuffle for ripple feel
  // --------------------------------------------------
  const shuffled = shuffle([...shooters]);

  // --------------------------------------------------
  // STEP 3: Fire with ripple delay
  // --------------------------------------------------
  shuffled.forEach((shooter, i) => {
    const delay = Math.min(i * RIPPLE_STEP, MAX_RIPPLE_DELAY);

    const clampU = (u) => Math.max(ROAD_MARGIN, Math.min(1 - ROAD_MARGIN, u));

    const config = BULLET_TYPES[shooter.type] || BULLET_TYPES.normal;

    const spawnTime = Date.now() + delay;

    // --------------------------------------------------
    // 🟢 PATTERN: SINGLE
    // --------------------------------------------------
    if (config.pattern === "single") {
      bullets.current.push({
        spawnTime,
        u: clampU(shooter.u),
        y: shooter.y,
        yStart: shooter.y,
        range: config.range,
        speed: config.speed,
        type: shooter.type,
      });
    }

    // --------------------------------------------------
    // 🟢 PATTERN: SPREAD
    // --------------------------------------------------
    if (config.pattern === "spread") {
      const center = shooter.u;
      const spread = config.spread || 0.03;

      // symmetrical offsets (e.g. [-1, 0, 1] for 3 shots)
      const half = Math.floor(config.count / 2);

      for (let o = -half; o <= half; o++) {
        bullets.current.push({
          spawnTime,
          u: clampU(center + o * spread),
          y: shooter.y,
          yStart: shooter.y,
          range: config.range,
          speed: config.speed,
          type: shooter.type,
        });
      }
    }
  });
}
