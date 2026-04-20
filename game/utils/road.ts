export function createRoad(config) {
  const {
    roadTopY,
    height,
    roadTopLeft,
    roadTopRight,
    roadBottomLeft,
    roadBottomRight,
  } = config;

  return function getRoadEdges(y) {
    const t = (y - roadTopY) / (height - roadTopY);

    const left = roadTopLeft + t * (roadBottomLeft - roadTopLeft);
    const right = roadTopRight + t * (roadBottomRight - roadTopRight);

    return { left, right };
  };
}
