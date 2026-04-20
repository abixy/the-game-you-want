export function spawnBubs({ bubs, count, MAX_BUBS, PLAYER_Y }) {
  for (let i = 0; i < count; i++) {
    if (bubs.current.length >= MAX_BUBS) break;

    bubs.current.push({
      u: 0.5,
      y: PLAYER_Y,
      driftX: 0,
      driftY: 0,
      nextDriftTime: 0,
    });
  }
}

export function updateBubs({
  bubs,
  playerX,
  playerY,
  getRoadEdges,
  ROAD_MARGIN,
}) {
  const now = Date.now();

  bubs.current.forEach((bub) => {
    const { left, right } = getRoadEdges(playerY);
    const playerU = (playerX - left) / (right - left);

    const roadWidth = right - left;
    const driftURange = 60 / roadWidth; // ~±20px feel

    // 🎲 pick new drift target occasionally
    if (!bub.nextDriftTime || now > bub.nextDriftTime) {
      bub.driftX = (Math.random() - 0.5) * 2 * driftURange;
      bub.driftY = (Math.random() - 0.5) * 40; // ±20px

      bub.nextDriftTime = now + 300 + Math.random() * 700;
    }

    const targetU = playerU + bub.driftX;
    const targetY = playerY + bub.driftY;

    // 🪢 rubber band smoothing
    bub.u += (targetU - bub.u) * 0.05;
    bub.y += (targetY - bub.y) * 0.05;

    // ✨ subtle jitter (makes it feel alive)
    bub.u += (Math.random() - 0.5) * 0.01;

    // 🚧 clamp to road
    bub.u = Math.max(ROAD_MARGIN, Math.min(1 - ROAD_MARGIN, bub.u));
  });
}
