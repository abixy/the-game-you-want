// ======================================================
// 🧬 SPAWN ENEMIES (pressure-aware)
// ======================================================
export function spawnEnemies({
  enemies,
  roadTopY,
  ROAD_MARGIN,
  burstFactorRef,
  bubs,
  playerPower,
  dt,
}) {
  const time = Date.now() * 0.001;

  // --------------------------------------------------
  // 🌊 Existing burst system (unchanged)
  // --------------------------------------------------
  const raw = (Math.sin(time) + 1) / 2;
  burstFactorRef.current = Math.pow(raw, 3);

  const baseChance = 0.001 + burstFactorRef.current * 0.35;

  // --------------------------------------------------
  // 🧠 PLAYER POWER (multi-source)
  // --------------------------------------------------

  // base survivability
  const basePower = 1;

  // bubs = sustained DPS
  const bubPower = bubs.current.length;

  // gate power = long-term scaling (dampened)
  const gatePower = (playerPower.current || 0) * 0.05;

  // final player power
  const totalPlayerPower = basePower + bubPower + gatePower;

  // --------------------------------------------------
  // 🧠 ENEMY POWER
  // --------------------------------------------------
  const enemyPower = enemies.current.length;

  // avoid divide-by-zero
  const pressure = totalPlayerPower > 0 ? enemyPower / totalPlayerPower : 999;

  // --------------------------------------------------
  // 🎯 TARGET PRESSURE (tune this!)
  // --------------------------------------------------
  const TARGET_PRESSURE = 1.5 + (playerPower.current || 0) * 0.002;

  // difference from target
  const diff = pressure - TARGET_PRESSURE;

  // --------------------------------------
  // Smooth logistic-style adjustment
  // --------------------------------------
  const strength = 0.6; // tuning knob
  const modifier = 1 / (1 + diff * strength);

  // clamp to avoid extremes
  const spawnModifier = Math.max(0.3, Math.min(2.0, modifier)); // Controls how extreme things can get.

  const finalChance = baseChance * spawnModifier;

  // --------------------------------------------------
  // 🎲 SPAWN DECISION
  // --------------------------------------------------
  if (Math.random() < finalChance * dt * 60) {
    const u = ROAD_MARGIN + Math.random() * (1 - ROAD_MARGIN * 2);

    enemies.current.push({
      u,
      y: roadTopY,
      health: 3,
    });
  }
}

// ======================================================
// ⬇️ UPDATE ENEMIES (movement + knockback + flash)
// ======================================================
export function updateEnemies({ enemies, roadTopY, height, ROAD_MARGIN, dt }) {
  enemies.current.forEach((e) => {
    // --------------------------------------
    // Perspective-based forward speed
    // --------------------------------------
    const t = (e.y - roadTopY) / (height - roadTopY);
    const baseSpeed = 60 + Math.pow(t, 1.2) * 600;

    // --------------------------------------
    // 💥 APPLY KNOCKBACK (opposes forward motion)
    // --------------------------------------
    const knockback = e.knockback || 0;

    // Net movement = forward speed minus knockback
    e.y += baseSpeed * dt - knockback * dt * 60;

    // --------------------------------------
    // Decay knockback over time
    // --------------------------------------
    if (e.knockback) {
      e.knockback *= Math.pow(0.7, dt * 60);

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
