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
  const y = roadTopY;

  // 🎲 Pick a random gate pair from pool
  const pool = GATE_POOLS[Math.floor(Math.random() * GATE_POOLS.length)];

  // 🧱 Create variable-width gate set (1–3 lanes)
  const laneCount = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3

  const gatesForRow = [];

  // --------------------------------------
  // RANDOM LANE SELECTION
  // --------------------------------------
  const availableLanes = [0, 1, 2];

  // shuffle lanes
  availableLanes.sort(() => Math.random() - 0.5);

  // pick N lanes
  const selected = availableLanes.slice(0, laneCount);

  selected.forEach((laneIndex, i) => {
    const laneU = (laneIndex + 0.5) / 3;

    const base = pool[i % pool.length];

    const magnitude = base.value || 10;

    gatesForRow.push({
      ...base,
      u: laneU,
      passed: false,

      // --------------------------------------
      // NEW: health/value system
      // --------------------------------------
      health: Math.abs(magnitude),
      maxHealth: Math.abs(magnitude),

      // starts negative (danger)
      value: -Math.abs(magnitude),
    });
  });

  gates.current.push({
    y,
    items: gatesForRow,
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
    // --------------------------------------
    // 🚗 Move gate row down the road
    // --------------------------------------
    const t = (g.y - roadTopY) / (height - roadTopY);

    // ⚡ Speed increases as gate approaches player
    // 🔧 Safe to tweak:
    // - exponent (2.5) → acceleration curve
    // - multiplier (7) → intensity
    const speed = (1 + Math.pow(t, 2.5) * 7) * 2;

    g.y += speed;

    // --------------------------------------
    // ✨ Per-gate updates (flash decay, etc.)
    // --------------------------------------
    if (!g.items) return;

    g.items.forEach((gate) => {
      // ----------------------------
      // Fade hit flash over time
      // ----------------------------
      if (gate.flash) {
        gate.flash *= 0.85;

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
