export function spawnEnemies({
  enemies,
  roadTopY,
  ROAD_MARGIN,
  burstFactorRef,
}) {
  const time = Date.now() * 0.001;

  const raw = (Math.sin(time) + 1) / 2;
  burstFactorRef.current = Math.pow(raw, 3);

  const chance = 0.001 + burstFactorRef.current * 0.25;

  if (Math.random() < chance) {
    const u = ROAD_MARGIN + Math.random() * (1 - ROAD_MARGIN * 2);
    enemies.current.push({ u, y: roadTopY });
  }
}

export function updateEnemies({ enemies, roadTopY, height, ROAD_MARGIN }) {
  enemies.current.forEach((e) => {
    const t = (e.y - roadTopY) / (height - roadTopY);
    const speed = 0.2 + Math.pow(t, 1.2) * 10;

    e.y += speed;
    e.u = Math.max(ROAD_MARGIN, Math.min(1 - ROAD_MARGIN, e.u));
  });
}
