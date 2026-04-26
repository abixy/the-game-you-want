// ======================================================
// COLLISION SYSTEM
// Responsible for:
// - Bullet ↔ Enemy hits (score)
// - Enemy ↔ Player/Bubs (life loss)
// - Enemy escapes (life loss)
// - Applying score + life updates
// ======================================================

export function handleCollisions({
  enemies,
  bullets,
  bubs,
  gates,
  PLAYER_X,
  PLAYER_Y,
  height,
  setLife,
  setGameOver,
  setScore,
  projection,
  worldOffsetX,
}) {
  // ------------------------------------------------------
  // TUNABLE CONSTANTS (collision feel)
  // ------------------------------------------------------
  const HIT_X = 12;
  const HIT_Y = 12; // vertical hit tolerance (pixels)

  const PLAYER_HIT_RADIUS = 14;
  const BUB_HIT_RADIUS = 10;

  // ------------------------------------------------------
  // FRAME ACCUMULATORS
  // ------------------------------------------------------
  let scoreGain = 0;
  let lifeLoss = 0;

  // ======================================================
  // 1. BULLET vs ENEMY (health-based)
  // ======================================================

  const remainingEnemies = [];

  // reset bullet hit flags
  bullets.current.forEach((b) => {
    b.hit = false;
  });

  enemies.current.forEach((enemy) => {
    const enemyX = projection.projectX(enemy.u, enemy.y, worldOffsetX);

    let alive = true;

    for (let i = 0; i < bullets.current.length; i++) {
      const bullet = bullets.current[i];

      if (bullet.hit) continue;

      const bulletX = projection.projectX(bullet.u, bullet.y, worldOffsetX);

      const dx = Math.abs(bulletX - enemyX);
      const dy = Math.abs(bullet.y - enemy.y);

      if (dx < HIT_X && dy < HIT_Y) {
        bullet.hit = true;

        // --------------------------------------
        // 💥 APPLY DAMAGE
        // --------------------------------------
        // ensure health exists (defensive)
        if (enemy.health == null) {
          enemy.health = 5;
        }

        const damage = bullet.damage || 1;
        enemy.health -= damage;

        // --------------------------------------
        // ✨ VISUAL FEEDBACK (flash)
        // --------------------------------------
        enemy.flash = 1;

        // --------------------------------------
        // 💥 KNOCKBACK (adds upward push)
        // --------------------------------------
        // accumulate knockback so rapid hits stack
        // scale knockback by bullet type
        const kb = bullet.type === "sniper" ? 8 : 4;

        // Soft knockback cap to prevent juggling
        const MAX_KB = 20;

        enemy.knockback = Math.min(MAX_KB, (enemy.knockback || 0) + kb);

        // --------------------------------------
        // ☠️ CHECK DEATH
        // --------------------------------------
        if (enemy.health <= 0) {
          alive = false;
          scoreGain++;
          break; // enemy is dead, stop checking bullets
        }
        /// DEBUGGING
        //console.log("hit", enemy.health);
      }
    }

    if (alive) {
      remainingEnemies.push(enemy);
    }
  });

  // ------------------------------------------------------
  // BULLET vs GATE (FULL WIDTH)
  // ------------------------------------------------------
  gates.current.forEach((g) => {
    g.items.forEach((gate) => {
      if (gate.passed) return;

      // --------------------------------------
      // Project bullet position
      // --------------------------------------
      for (let i = 0; i < bullets.current.length; i++) {
        const bullet = bullets.current[i];
        if (bullet.hit) continue;

        const bulletX = projection.projectX(bullet.u, bullet.y, worldOffsetX);

        // --------------------------------------
        // Compute FULL lane width in screen space
        // --------------------------------------
        const laneWidthU = 1 / 3;

        const leftU = gate.u - laneWidthU / 2;
        const rightU = gate.u + laneWidthU / 2;

        const leftX = projection.projectX(leftU, g.y, worldOffsetX);
        const rightX = projection.projectX(rightU, g.y, worldOffsetX);

        // --------------------------------------
        // Hit test
        // --------------------------------------
        const withinX = bulletX >= leftX && bulletX <= rightX;
        const dy = Math.abs(bullet.y - g.y);

        if (withinX && dy < HIT_Y) {
          // --------------------------------------
          // APPLY DAMAGE
          // --------------------------------------
          const damage = bullet.damage || 1;

          // --------------------------------------
          // 🧠 Integer-safe health system
          // Prevents float drift bugs
          // --------------------------------------
          gate.health = Math.round(gate.health - damage);

          // --------------------------------------
          // Clamp health to symmetric bounds
          // --------------------------------------
          const MAX = gate.maxHealth;

          gate.health = Math.max(-MAX, Math.min(MAX, gate.health));

          // --------------------------------------
          // DIRECT VALUE SYSTEM (clean + stable)
          // --------------------------------------
          gate.value = -gate.health;

          gate.flash = 1;

          bullet.hit = true;
        }
      }
    });
  });

  enemies.current = remainingEnemies;

  // remove bullets that hit something
  bullets.current = bullets.current.filter((b) => !b.hit);

  // ======================================================
  // 2. ENEMY vs PLAYER / BUBS (NO LIFE DAMAGE)
  // Bubs absorb enemies. Player collision does NOT reduce life.
  // ======================================================

  const survivors = [];

  enemies.current.forEach((enemy) => {
    let destroyed = false;

    const enemyX = projection.projectX(enemy.u, enemy.y, worldOffsetX);

    // -------------------------
    // BUB COLLISIONS (absorb hit)
    // -------------------------
    for (let i = 0; i < bubs.current.length; i++) {
      const bub = bubs.current[i];

      const bubX = projection.projectX(bub.u, bub.y, worldOffsetX);

      if (
        Math.abs(enemyX - bubX) < BUB_HIT_RADIUS &&
        Math.abs(enemy.y - bub.y) < BUB_HIT_RADIUS
      ) {
        // Remove THIS bub
        bubs.current.splice(i, 1);

        // Enemy is destroyed by bub
        destroyed = true;
        break;
      }
    }

    // -------------------------
    // PLAYER COLLISION (no damage)
    // Optional: you could add feedback here later
    // -------------------------
    if (!destroyed) {
      const hitPlayer =
        Math.abs(enemyX - PLAYER_X.current) < PLAYER_HIT_RADIUS &&
        Math.abs(enemy.y - PLAYER_Y) < PLAYER_HIT_RADIUS;

      if (hitPlayer) {
        // Enemy is removed, but no life loss
        destroyed = true;
      }
    }

    if (!destroyed) {
      survivors.push(enemy);
    }
  });

  enemies.current = survivors;

  // ======================================================
  // 3. ENEMY ESCAPES (bottom of screen)
  // ======================================================

  const stillAlive = [];

  enemies.current.forEach((e) => {
    if (e.y >= height) {
      // Enemy escaped → damage player
      lifeLoss++;
    } else {
      stillAlive.push(e);
    }
  });

  enemies.current = stillAlive;

  // ======================================================
  // 4. APPLY RESULTS
  // ======================================================

  // Score update (batched)
  if (scoreGain > 0) {
    setScore((s) => s + scoreGain);
  }

  // ------------------------------------------------------
  // LIFE UPDATE + GAME OVER CHECK
  // ------------------------------------------------------
  if (lifeLoss > 0) {
    setLife((prev) => {
      const newLife = Math.max(0, prev - lifeLoss);

      if (newLife <= 0) {
        setGameOver(true);
      }

      return newLife;
    });
  }
}
