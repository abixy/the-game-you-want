// ======================================================
// 🚪 GATE SYSTEM
// Handles:
// - spawning (timed, randomized)
// - movement (perspective-based)
// - player interaction (apply effects)
// - cleanup (remove off-screen gates)
// ======================================================

// ======================================================
// 🧬 SPAWN GATES
// Creates a pair of gates (left + right) at intervals
// ======================================================
export function spawnGates({
  gates,
  now,
  nextGateTimeRef,
  getRandomGateDelay,
  roadTopY,
  GATE_POOLS,
}) {
  // ⏱️ Not time yet → do nothing
  if (now < nextGateTimeRef.current) return;

  // 📍 Spawn slightly below top of road (feels better visually)
  const y = roadTopY + 200;

  // 🎲 Pick a random gate pair from pool
  const pool = GATE_POOLS[Math.floor(Math.random() * GATE_POOLS.length)];

  // 🧱 Create gate pair (left + right)
  gates.current.push({
    y,

    // 🚪 Left gate
    left: {
      ...pool[0],
      u: 0.3, // horizontal position (0–1 across road)
      passed: false,
    },

    // 🚪 Right gate
    right: {
      ...pool[1],
      u: 0.7,
      passed: false,
    },
  });

  // 🔁 Schedule next spawn
  nextGateTimeRef.current = now + getRandomGateDelay();

  // 🐛 DEBUG (optional)
  // console.log("Spawned gate pair");
}

// ======================================================
// ⬇️ UPDATE GATES (MOVEMENT)
// Moves gates down the road using perspective scaling
// ======================================================
export function updateGates({ gates, roadTopY, height }) {
  gates.current.forEach((g) => {
    // 🧭 Perspective factor (0 = top, 1 = bottom)
    const t = (g.y - roadTopY) / (height - roadTopY);

    // ⚡ Speed increases as gate approaches player
    // 🔧 Safe to tweak:
    // - exponent (2.5) → acceleration curve
    // - multiplier (7) → intensity
    const speed = (1 + Math.pow(t, 2.5) * 7) * 2;

    // ⬇️ Apply movement
    g.y += speed;
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
    [g.left, g.right].forEach((gate) => {
      // 🚫 Skip if already used
      if (gate.passed) return;

      // --------------------------------------------------
      // 🎯 Project gate position into screen space
      // --------------------------------------------------
      const gateX = projection.projectX(gate.u, g.y, worldOffsetX);

      // --------------------------------------------------
      // 📏 Distance from player (screen space)
      // --------------------------------------------------
      const dx = Math.abs(PLAYER_X.current - gateX);
      const dy = Math.abs(PLAYER_Y - g.y);

      // --------------------------------------------------
      // 🎯 Collision check
      // --------------------------------------------------
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
