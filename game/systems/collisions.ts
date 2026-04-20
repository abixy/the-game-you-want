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
  getRoadEdges,
  PLAYER_X,
  PLAYER_Y,
  height,
  setLife,
  setGameOver,
  setScore,
}) {
  // ------------------------------------------------------
  // TUNABLE CONSTANTS (collision feel)
  // ------------------------------------------------------
  const HIT_U = 0.04; // horizontal hit tolerance (normalized)
  const HIT_Y = 12; // vertical hit tolerance (pixels)

  const PLAYER_HIT_RADIUS = 14;
  const BUB_HIT_RADIUS = 10;

  // ------------------------------------------------------
  // FRAME ACCUMULATORS
  // ------------------------------------------------------
  let scoreGain = 0;
  let lifeLoss = 0;

  // ======================================================
  // 1. BULLET vs ENEMY
  // ======================================================

  const remainingEnemies = [];
  const remainingBullets = [];

  enemies.current.forEach((enemy) => {
    let hit = false;

    bullets.current.forEach((bullet) => {
      const du = Math.abs(bullet.u - enemy.u);
      const dy = Math.abs(bullet.y - enemy.y);

      // NOTE: single-hit per enemy (prevents multi-bullet stacking)
      if (du < HIT_U && dy < HIT_Y && !hit) {
        hit = true;
        scoreGain++;
      }
    });

    if (!hit) remainingEnemies.push(enemy);
  });

  // ------------------------------------------------------
  // Remove bullets that hit something
  // ------------------------------------------------------
  bullets.current.forEach((bullet) => {
    const hit = enemies.current.some((enemy) => {
      const du = Math.abs(bullet.u - enemy.u);
      const dy = Math.abs(bullet.y - enemy.y);
      return du < HIT_U && dy < HIT_Y;
    });

    if (!hit) remainingBullets.push(bullet);
  });

  // Apply filtered lists
  enemies.current = remainingEnemies;
  bullets.current = remainingBullets;

  // ======================================================
  // 2. ENEMY vs PLAYER / BUBS
  // ======================================================

  const survivors = [];

  enemies.current.forEach((enemy) => {
    let hit = false;

    // Convert enemy u → screen x
    const { left, right } = getRoadEdges(enemy.y);
    const enemyX = left + enemy.u * (right - left);

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

        const { left, right } = getRoadEdges(bub.y);
        const bubX = left + bub.u * (right - left);

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
