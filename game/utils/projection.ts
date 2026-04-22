// ======================================================
// 📐 PROJECTION SYSTEM
// Handles:
// - perspective-based lateral offset
// - camera height (road widening)
// - world → screen X projection
// ======================================================

export function createProjection({
  width,
  height,
  roadTopY,
  cameraScale,
  roadTopLeft,
  roadTopRight,
  roadBottomLeft,
  roadBottomRight,
}) {
  const centerX = width / 2;

  // ------------------------------------------------------
  // 🧠 Perspective offset (camera shift)
  // ------------------------------------------------------
  function getPerspectiveOffset(y: number, worldOffsetX: number) {
    const t = Math.max(0, Math.min(1, (y - roadTopY) / (height - roadTopY)));

    // 0.5 at top → 1.0 at bottom (tweakable)
    const factor = 0.1 + t * 1.3;

    return worldOffsetX * factor;
  }

  // ------------------------------------------------------
  // 🛣️ Scale road edges (camera height effect)
  // ------------------------------------------------------
  function getBaseEdges(y: number) {
    const t = Math.max(0, Math.min(1, (y - roadTopY) / (height - roadTopY)));

    const left = roadTopLeft + (roadBottomLeft - roadTopLeft) * t;
    const right = roadTopRight + (roadBottomRight - roadTopRight) * t;

    return { left, right };
  }

  function getScaledEdges(y: number) {
    const { left, right } = getBaseEdges(y);

    const t = Math.max(0, Math.min(1, (y - roadTopY) / (height - roadTopY)));
    const scale = 1 + t * (cameraScale - 1);

    const scaledLeft = centerX + (left - centerX) * scale;
    const scaledRight = centerX + (right - centerX) * scale;

    return { left: scaledLeft, right: scaledRight };
  }

  // ------------------------------------------------------
  // 🎯 MAIN: Project U → screen X
  // ------------------------------------------------------
  function projectX(u: number, y: number, worldOffsetX: number) {
    const { left, right } = getScaledEdges(y);

    const offset = getPerspectiveOffset(y, worldOffsetX);

    return left + u * (right - left) + offset;
  }

  // ------------------------------------------------------
  // 🔄 UNPROJECT: screen X → U
  // Converts screen-space X back into road-relative U (0–1)
  // Must match projectX exactly
  // ------------------------------------------------------
  function unprojectU(x: number, y: number, worldOffsetX: number) {
    const { left, right } = getScaledEdges(y);
    const offset = getPerspectiveOffset(y, worldOffsetX);

    return (x - left - offset) / (right - left);
  }

  // ------------------------------------------------------
  // 🛣️ Road path helper
  // ------------------------------------------------------
  function getRoadPath({
    roadBottomLeft,
    roadBottomRight,
    roadTopLeft,
    roadTopRight,
    worldOffsetX,
  }) {
    const topOffset = getPerspectiveOffset(roadTopY, worldOffsetX);
    const bottomOffset = getPerspectiveOffset(height, worldOffsetX);

    const bottomScale = cameraScale;

    const scaledBottomLeft = centerX + (roadBottomLeft - centerX) * bottomScale;

    const scaledBottomRight =
      centerX + (roadBottomRight - centerX) * bottomScale;

    return `M ${scaledBottomLeft + bottomOffset} ${height}
            L ${scaledBottomRight + bottomOffset} ${height}
            L ${roadTopRight + topOffset} ${roadTopY}
            L ${roadTopLeft + topOffset} ${roadTopY}
            Z`;
  }

  // ------------------------------------------------------
  // 🚧 CLAMP WORLD OFFSET
  // Prevents the road from sliding off-screen
  // ------------------------------------------------------
  function clampWorldOffset(worldOffsetX: number) {
    // --------------------------------------------------
    // Use the bottom of the road (widest point)
    // This ensures the visible play area never leaves screen
    // --------------------------------------------------
    const y = height;

    // --------------------------------------------------
    // Project the left and right edges of the road
    // using current world offset
    // --------------------------------------------------
    const leftEdge = projectX(0, y, worldOffsetX);
    const rightEdge = projectX(1, y, worldOffsetX);

    let clamped = worldOffsetX;

    // --------------------------------------------------
    // LEFT BOUNDARY
    // If left edge is inside the screen ( > 0 ),
    // it means we've shifted too far right
    // → push offset back left
    // --------------------------------------------------
    if (leftEdge > 0) {
      clamped -= leftEdge;
    }

    // --------------------------------------------------
    // RIGHT BOUNDARY
    // If right edge is inside the screen ( < width ),
    // it means we've shifted too far left
    // → push offset back right
    // --------------------------------------------------
    if (rightEdge < width) {
      clamped += width - rightEdge;
    }

    return clamped;
  }

  return {
    projectX,
    unprojectU,
    getRoadPath,
    getPerspectiveOffset,
    clampWorldOffset,
  };
}
