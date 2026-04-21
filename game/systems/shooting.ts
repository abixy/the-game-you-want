import { MAX_RIPPLE_DELAY, RIPPLE_STEP } from "../config/gameConfig";
import { shuffle } from "../utils/math";

export function fireShots({ playerU, playerY, bubs, bullets, ROAD_MARGIN }) {
  const shooters = [
    {
      type: "player",
      u: playerU,
      y: playerY,
    },
    ...bubs.map((b) => ({
      type: "bub",
      ref: b, // 👈 IMPORTANT
      u: b.u,
      y: b.y,
    })),
  ];

  const shuffled = shuffle([...shooters]);

  shuffled.forEach((shooter, i) => {
    const delay = Math.min(i * RIPPLE_STEP, MAX_RIPPLE_DELAY);

    setTimeout(() => {
      bullets.current.push({
        u: Math.max(ROAD_MARGIN, Math.min(1 - ROAD_MARGIN, shooter.u)),
        y: shooter.y,
      });

      // ======================================================
      // 🔥 FIRING NUDGE (ONLY FOR BUBS)
      // ======================================================
      if (shooter.type === "bub" && shooter.ref) {
        const bub = shooter.ref;

        // upward kick (toward enemies)
        bub.vy -= 0.1; // currently not doing anything really because other movement masks the nudge.  No big deal.

        // slight sideways randomness
        bub.vx += (Math.random() - 0.5) * 0.01;
      }
    }, delay);
  });
}
