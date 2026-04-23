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

  // ======================================================
  // 1.5 BULLET vs GATES (blocking)
  // ======================================================

  gates.current.forEach((g) => {
    g.items.forEach((gate) => {
      if (gate.passed) return;

      const gateX = projection.projectX(gate.u, g.y, worldOffsetX);

      for (let i = 0; i < bullets.current.length; i++) {
        const bullet = bullets.current[i];

        if (bullet.hit) continue;

        const bulletX = projection.projectX(bullet.u, bullet.y, worldOffsetX);

        const dx = Math.abs(bulletX - gateX);
        const dy = Math.abs(bullet.y - g.y);

        if (dx < 14 && dy < 14) {
          // --------------------------------------
          // 💥 BLOCK BULLET
          // --------------------------------------
          bullet.hit = true;

          // --------------------------------------
          // 🧠 MODIFY GATE
          // --------------------------------------
          const damage = bullet.damage || 1;

          gate.health -= damage;
          gate.value += damage;

          gate.value = Math.min(gate.value, gate.maxHealth);

          gate.flash = 1;

          break; // 👈 IMPORTANT: stop this bullet
        }
      }
    });
  });

  enemies.current = remainingEnemies;

  // remove bullets that hit something
  bullets.current = bullets.current.filter((b) => !b.hit);

  // ======================================================
  // 2. ENEMY vs PLAYER / BUBS
  // ======================================================

  const survivors = [];

  enemies.current.forEach((enemy) => {
    let hit = false;

    // Convert enemy u → screen x
    const enemyX = projection.projectX(enemy.u, enemy.y, worldOffsetX);

    // -------------------------
    // PLAYER COLLISION
    // -------------------------
    if (
      Math.abs(enemyX - PLAYER_X.current) < PLAYER_HIT_RADIUS &&
      Math.abs(enemy.y - PLAYER_Y) < PLAYER_HIT_RADIUS
    ) {
      lifeLoss++;
      hit = true;
    }

    // -------------------------
    // BUB COLLISIONS
    // -------------------------
    if (!hit) {
      for (let i = 0; i < bubs.current.length; i++) {
        const bub = bubs.current[i];

        const bubX = projection.projectX(bub.u, bub.y, worldOffsetX);

        if (
          Math.abs(enemyX - bubX) < BUB_HIT_RADIUS &&
          Math.abs(enemy.y - bub.y) < BUB_HIT_RADIUS
        ) {
          // Remove THIS bub only
          bubs.current.splice(i, 1);

          lifeLoss++;
          hit = true;
          break;
        }
      }
    }

    if (!hit) survivors.push(enemy);
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
