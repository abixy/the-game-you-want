// ======================================================
// 🚪 GATE SYSTEM
// Handles:
// - spawning (timed, randomized)
// - movement (perspective-based)
// - player interaction (apply effects)
// - cleanup (remove off-screen gates)
// ======================================================

// ======================================================
// ⚖️ GATE POWER MAPPING
// Converts gate effects → abstract "power" value
// This will later drive difficulty balancing
// ======================================================
export function getGatePower(gate) {
  if (gate.type === "bub") {
    // each bub ≈ small sustained DPS increase
    return gate.value * 2;
  }

  if (gate.type === "life") {
    // life = survivability (lower weight than offense)
    return gate.value * 0.5;
  }

  if (gate.type === "fastFire") {
    return 15;
  }

  if (gate.type === "slowFire") {
    return -10;
  }

  return 0;
}

// ======================================================
// 🧠 PROCEDURAL GATE GENERATION
// ======================================================
function generateGate({ lifeNeed, offenseNeed }) {
  // --------------------------------------
  // Decide gate TYPE
  // --------------------------------------
  let type;

  // --------------------------------------
  // 🎯 Weighted type selection
  // --------------------------------------
  const lifeWeight = lifeNeed * 1.2;
  const bubWeight = offenseNeed * 1.0;

  const total = lifeWeight + bubWeight + 0.01;

  const roll = Math.random() * total;

  if (roll < lifeWeight) {
    type = "life";
  } else {
    type = "bub";
  }

  // --------------------------------------
  // Decide magnitude (difficulty-aware later)
  // --------------------------------------
  let magnitude;

  if (type === "life") {
    // bigger help when low
    magnitude = 5 + Math.floor(Math.pow(lifeNeed, 0.8) * 20);
  }

  if (type === "bub") {
    magnitude = 3 + Math.floor(Math.pow(offenseNeed, 0.8) * 8);
  }

  // --------------------------------------
  // Add randomness (important!)
  // --------------------------------------
  magnitude += Math.floor(Math.random() * 4) - 2; // ±2 variance

  magnitude = Math.max(3, magnitude); // clamp minimum

  console.log("GEN GATE →", {
    lifeNeed,
    offenseNeed,
    chosenType: type,
  });

  return {
    type,
    baseValue: magnitude,
  };
}

// ======================================================
// 🧬 SPAWN GATES
// ======================================================
export function spawnGates({
  gates,
  now,
  lastGateSpawn,
  roadTopY,
  life,
  bubs,
}) {
  const y = roadTopY;

  // ======================================================
  // 🧠 NEED-BASED SPAWN CONTROL (FIXED)
  // ======================================================

  const MIN_COOLDOWN = 10000;

  // cooldown gate
  if (now - lastGateSpawn.current < MIN_COOLDOWN) return;

  // needs
  const lifeNeed = 1 - life / 100;
  const offenseNeed = Math.max(0, 1 - bubs.current.length / 20);

  // blend needs
  const needScore = lifeNeed * 0.7 + offenseNeed * 0.5;

  // --------------------------------------
  // 🎯 PER-FRAME SPAWN CHANCE
  // --------------------------------------
  // this is the missing ingredient
  const BASE_RATE = 0.01; // ← tune this (VERY important)

  // dt-normalized spawn chance
  const spawnChance = BASE_RATE * needScore;

  // roll EVERY FRAME
  if (Math.random() > spawnChance) return;

  // ✅ spawn allowed
  lastGateSpawn.current = now;

  // --------------------------------------
  // 🎲 Decide how many lanes (1–3)
  // --------------------------------------
  const laneCount = Math.floor(Math.random() * 3) + 1;

  const availableLanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  const selected = availableLanes.slice(0, laneCount);

  const items = selected.map((laneIndex) => {
    const { type, baseValue } = generateGate({ lifeNeed, offenseNeed });

    return {
      type,
      u: (laneIndex + 0.5) / 3,
      passed: false,

      health: baseValue,
      maxHealth: baseValue,

      // always start negative
      value: -baseValue,
    };
  });

  gates.current.push({ y, items });
}

// ======================================================
// ⬇️ UPDATE GATES (MOVEMENT)
// Moves gates down the road using perspective scaling
// ======================================================
export function updateGates({ gates, roadTopY, height, dt }) {
  gates.current.forEach((g) => {
    // --------------------------------------
    // 🚗 Move gate row down the road
    // --------------------------------------
    const t = (g.y - roadTopY) / (height - roadTopY);

    // ⚡ Speed increases as gate approaches player
    // 🔧 Safe to tweak:
    // - exponent (2.5) → acceleration curve
    // - multiplier (7) → intensity
    const speed = (1 + Math.pow(t, 2.5) * 7) * 180;

    g.y += speed * dt;

    // --------------------------------------
    // ✨ Per-gate updates (flash decay, etc.)
    // --------------------------------------
    if (!g.items) return;

    g.items.forEach((gate) => {
      // ----------------------------
      // Fade hit flash over time
      // ----------------------------
      if (gate.flash) {
        gate.flash *= Math.pow(0.85, dt * 60);

        if (gate.flash < 0.05) {
          gate.flash = 0;
        }
      }
    });
  });
}

// ======================================================
// 🎯 HANDLE GATE EFFECTS (projection-aware)
// ======================================================
export function handleGateEffects({
  gates,
  PLAYER_X,
  PLAYER_Y,
  GATE_HIT_X_PX,
  GATE_HIT_Y_PX,
  applyGate,
  projection,
  worldOffsetX,
}) {
  gates.current.forEach((g) => {
    g.items.forEach((gate) => {
      if (gate.passed) return;

      const gateX = projection.projectX(gate.u, g.y, worldOffsetX);

      const dx = Math.abs(PLAYER_X.current - gateX);
      const dy = Math.abs(PLAYER_Y - g.y);

      if (dx < GATE_HIT_X_PX && dy < GATE_HIT_Y_PX) {
        applyGate(gate);
        gate.passed = true;
      }
    });
  });
}

// ======================================================
// 🧹 CLEANUP GATES
// Removes gates that have moved off-screen
// ======================================================
export function cleanupGates({ gates, height }) {
  gates.current = gates.current.filter((g) => g.y < height);
}
