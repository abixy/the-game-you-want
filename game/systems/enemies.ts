// ======================================================
// 🧬 SPAWN ENEMIES (pressure-aware)
// ======================================================
export function spawnEnemies({
  enemies,
  roadTopY,
  ROAD_MARGIN,
  burstFactorRef,
  bubs,
}) {
  const time = Date.now() * 0.001;

  // --------------------------------------------------
  // 🌊 Existing burst system (unchanged)
  // --------------------------------------------------
  const raw = (Math.sin(time) + 1) / 2;
  burstFactorRef.current = Math.pow(raw, 3);

  const baseChance = 0.001 + burstFactorRef.current * 0.25;

  // --------------------------------------------------
  // 🧠 POWER + PRESSURE
  // --------------------------------------------------
  const playerPower = 1 + bubs.current.length;
  const enemyPower = enemies.current.length;

  const pressure = playerPower > 0 ? enemyPower / playerPower : 999;

  // --------------------------------------------------
  // 🎯 TARGET PRESSURE (tune this!)
  // --------------------------------------------------
  const TARGET_PRESSURE = 1.8;

  // difference from target
  const diff = pressure - TARGET_PRESSURE;

  // --------------------------------------------------
  // 🎛️ SPAWN MODIFIER (soft adjustment)
  // --------------------------------------------------
  // Negative diff → spawn more
  // Positive diff → spawn less
  const modifier = 1 - diff * 0.5;

  // clamp to avoid extremes
  const spawnModifier = Math.max(0.3, Math.min(2.0, modifier)); // Controls how extreme things can get.

  const finalChance = baseChance * spawnModifier;

  // --------------------------------------------------
  // 🎲 SPAWN DECISION
  // --------------------------------------------------
  if (Math.random() < finalChance) {
    const u = ROAD_MARGIN + Math.random() * (1 - ROAD_MARGIN * 2);

    enemies.current.push({
      u,
      y: roadTopY,
      health: 3,
    });
  }
}

// ======================================================
// ⬇️ UPDATE ENEMIES (movement + feedback)
// ======================================================
// ======================================================
// ⬇️ UPDATE ENEMIES (movement + knockback + flash)
// ======================================================
export function updateEnemies({ enemies, roadTopY, height, ROAD_MARGIN }) {
  enemies.current.forEach((e) => {
    // --------------------------------------
    // Perspective-based forward speed
    // --------------------------------------
    const t = (e.y - roadTopY) / (height - roadTopY);
    const baseSpeed = 0.2 + Math.pow(t, 1.2) * 10;

    // --------------------------------------
    // 💥 APPLY KNOCKBACK (opposes forward motion)
    // --------------------------------------
    const knockback = e.knockback || 0;

    // Net movement = forward speed minus knockback
    e.y += baseSpeed - knockback;

    // --------------------------------------
    // Decay knockback over time
    // --------------------------------------
    if (e.knockback) {
      e.knockback *= 0.7;

      if (e.knockback < 0.3) {
        e.knockback = 0;
      }
    }

    // subtle horizontal wobble when hit
    if (e.knockback > 2) {
      e.u += (Math.random() - 0.5) * 0.02;
    }

    // --------------------------------------
    // ✨ FLASH DECAY
    // --------------------------------------
    if (e.flash) {
      e.flash *= 0.85;

      if (e.flash < 0.05) {
        e.flash = 0;
      }
    }

    // --------------------------------------
    // 🚧 CLAMP TO ROAD
    // --------------------------------------
    e.u = Math.max(ROAD_MARGIN, Math.min(1 - ROAD_MARGIN, e.u));
  });
}
