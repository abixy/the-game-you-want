import { MAX_RIPPLE_DELAY, RIPPLE_STEP } from "../config/gameConfig";
import { shuffle } from "../utils/math";

export function fireShots({ playerU, playerY, bubs, bullets, ROAD_MARGIN }) {
  const shooters = [
    { u: playerU, y: playerY },
    ...bubs.map((b) => ({ u: b.u, y: b.y })),
  ];

  const shuffled = shuffle([...shooters]);

  shuffled.forEach((shooter, i) => {
    const delay = Math.min(i * RIPPLE_STEP, MAX_RIPPLE_DELAY);

    setTimeout(() => {
      bullets.current.push({
        u: Math.max(ROAD_MARGIN, Math.min(1 - ROAD_MARGIN, shooter.u)),
        y: shooter.y,
      });
    }, delay);
  });
}
