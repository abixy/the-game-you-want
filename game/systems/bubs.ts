// ======================================================
// SPAWN BUBS
// Creates new bubs at player position
// ======================================================
export function spawnBubs({ bubs, count, MAX_BUBS, PLAYER_Y }) {
  for (let i = 0; i < count; i++) {
    if (bubs.current.length >= MAX_BUBS) break;

    bubs.current.push({
      u: 0.5,
      y: PLAYER_Y,
      type: Math.random() < 0.2 ? "sniper" : "normal",
    });
  }
}

// ======================================================
// BUB SYSTEM — FORMATION + LIGHT WIGGLE
// ======================================================
export function updateBubs({
  bubs,
  playerX,
  playerY,
  height,
  projection,
  worldOffsetX,
}) {
  // --------------------------------------------------
  // 🎯 Convert player screen X → U (projection-aware)
  // --------------------------------------------------
  const playerU = projection.unprojectU(playerX, playerY, worldOffsetX);

  const safePlayerU = Math.max(0, Math.min(1, playerU));

  const count = bubs.current.length;

  // --------------------------------------------------
  // 🧱 Formation sizing
  // --------------------------------------------------
  const COLS = Math.min(8, Math.ceil(Math.sqrt(count)));
  const SPACING_U = 0.06;
  const SPACING_Y = 18;

  const time = Date.now() * 0.002;

  bubs.current.forEach((b, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    // --------------------------------------------------
    // 🎯 Formation positioning (centered behind player)
    // --------------------------------------------------
    const formationWidth = (COLS - 1) * SPACING_U;
    const offsetU = col * SPACING_U - formationWidth / 2;

    const targetU = safePlayerU + offsetU;
    const targetY = playerY + 20 + row * SPACING_Y;

    // --------------------------------------------------
    // 🧠 Smooth follow (snipers lag slightly more)
    // --------------------------------------------------
    const follow = b.type === "sniper" ? 0.06 : 0.12;

    b.u += (targetU - b.u) * follow;
    b.y += (targetY - b.y) * follow;

    // --------------------------------------------------
    // 🌊 Tiny local wiggle (very subtle, non-sinusoidal)
    // --------------------------------------------------
    if (!b.wiggle) {
      b.wiggle = {
        u: 0,
        y: 0,
        targetU: 0,
        targetY: 0,
        timer: 0,
      };
    }

    b.wiggle.timer -= 1;

    if (b.wiggle.timer <= 0) {
      b.wiggle.timer = 20 + Math.random() * 40;

      b.wiggle.targetU = (Math.random() - 0.5) * 0.01;
      b.wiggle.targetY = (Math.random() - 0.5) * 2;
    }

    b.wiggle.u += (b.wiggle.targetU - b.wiggle.u) * 0.1;
    b.wiggle.y += (b.wiggle.targetY - b.wiggle.y) * 0.1;

    b.u += b.wiggle.u;
    b.y += b.wiggle.y;

    // --------------------------------------------------
    // 🎯 Clamp to road (projection-aware)
    // --------------------------------------------------
    const leftEdge = projection.projectX(0, b.y, worldOffsetX);
    const rightEdge = projection.projectX(1, b.y, worldOffsetX);

    const x = projection.projectX(b.u, b.y, worldOffsetX);

    const BUB_MARGIN = 12;

    const clampedX = Math.max(
      leftEdge + BUB_MARGIN,
      Math.min(rightEdge - BUB_MARGIN, x),
    );

    // convert back to U using projection helper
    b.u = projection.unprojectU(clampedX, b.y, worldOffsetX);

    // --------------------------------------------------
    // Keep on screen vertically
    // --------------------------------------------------
    b.y = Math.min(height - 20, b.y);
  });
}
