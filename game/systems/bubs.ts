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
      vx: 0,
      vy: 0,

      type: Math.random() < 0.2 ? "sniper" : "normal", // 20% of sniper type
    });
  }
}

// ======================================================
// BUB SYSTEM — BOIDS-LITE SWARM
// ======================================================
export function updateBubs({
  bubs,
  playerX,
  playerY,
  getRoadEdges,
  ROAD_MARGIN,
}) {
  const cohesionStrength = 0.006;
  const separationStrength = 0.03;

  const maxSpeedU = 0.01; // horizontal (u space)
  const maxSpeedY = 2; // vertical (pixels)
  const separationDistance = 0.04; // in U space

  // ------------------------------------------------------
  // STEP 1: Compute center of swarm (cohesion target)
  // ------------------------------------------------------
  let centerU = 0;
  let centerY = 0;

  bubs.current.forEach((b) => {
    centerU += b.u;
    centerY += b.y;
  });

  if (bubs.current.length > 0) {
    centerU /= bubs.current.length;
    centerY /= bubs.current.length;
  }

  // ------------------------------------------------------
  // STEP 2: Convert player X → U space
  // ------------------------------------------------------
  const { left, right } = getRoadEdges(playerY);
  const playerU = (playerX - left) / (right - left);

  // ------------------------------------------------------
  // STEP 3: Apply forces to each bub
  // ------------------------------------------------------
  bubs.current.forEach((b, i) => {
    // ---------------------------
    // INIT VELOCITY (safe)
    // ---------------------------
    if (b.vx === undefined) b.vx = 0;
    if (b.vy === undefined) b.vy = 0;

    // ---------------------------
    // VARY BUB TYPE MOVEMENT SPEED for balance
    // ---------------------------
    if (b.type === "sniper") {
      b.vx *= 0;
    }

    // ---------------------------
    // SMALL VERTICAL NOISE
    // ---------------------------
    b.vy += (Math.random() - 0.5) * 0.2; // stronger so it's visible

    // ---------------------------
    // COHESION (toward group)
    // ---------------------------
    const cohesionU = (centerU - b.u) * cohesionStrength;
    const cohesionY = (centerY - b.y) * cohesionStrength;

    // ---------------------------
    // SEPARATION (avoid overlap)
    // ---------------------------
    let sepU = 0;
    let sepY = 0;

    bubs.current.forEach((other, j) => {
      if (i === j) return;

      const yScale = 1 / 100; // tweak this

      const du = b.u - other.u;
      const dy = (b.y - other.y) * yScale;

      const dist = Math.sqrt(du * du + dy * dy);

      if (dist < separationDistance && dist > 0) {
        sepU += du / dist;
        sepY += dy / dist;
      }
    });

    sepU *= separationStrength;
    sepY *= separationStrength;

    // ---------------------------
    // FOLLOW PLAYER (anchor)
    // ---------------------------
    const followU = (playerU - b.u) * 0.02; // strong horizontal follow
    const followY = (playerY - b.y) * 0.005; // weak vertical follow

    // ---------------------------
    // COMBINE FORCES → velocity
    // ---------------------------
    b.vx += cohesionU + sepU + followU;
    b.vy += cohesionY + sepY + followY;

    // ---------------------------
    // VERTICAL BAND CONSTRAINT
    // keeps bubs within a soft range around player
    // ---------------------------
    const dy = b.y - playerY;

    if (dy > 16) {
      b.vy -= (dy - 16) * 0.02;
    } else if (dy < -16) {
      b.vy -= (dy + 16) * 0.02;
    }

    // ---------------------------
    // LIMIT SPEED (separate axes)
    // ---------------------------
    b.vx = Math.max(-maxSpeedU, Math.min(maxSpeedU, b.vx));
    b.vy = Math.max(-maxSpeedY, Math.min(maxSpeedY, b.vy));

    // ---------------------------
    // APPLY MOVEMENT
    // ---------------------------
    b.u += b.vx;
    b.y += b.vy;

    // ---------------------------
    // CLAMP TO ROAD
    // ---------------------------
    b.u = Math.max(ROAD_MARGIN, Math.min(1 - ROAD_MARGIN, b.u));
  });
}
