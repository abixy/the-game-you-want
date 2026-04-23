import {
  Canvas,
  Circle,
  LinearGradient,
  Path,
  Rect,
  Text as SkiaText,
  useFont,
  vec,
} from "@shopify/react-native-skia";
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, PanResponder, Text, View } from "react-native";

const { width, height } = Dimensions.get("window");

// ======================================================
// CONFIG + SYSTEM IMPORTS
// ======================================================
import {
  BULLET_SPEED_SCALE,
  GATE_HIT_X_PX,
  GATE_HIT_Y_PX,
  MAX_BUBS,
} from "../game/config/gameConfig";

import { spawnBubs, updateBubs } from "../game/systems/bubs";
import { handleCollisions } from "../game/systems/collisions";
import { spawnEnemies, updateEnemies } from "../game/systems/enemies";
import {
  cleanupGates,
  handleGateEffects,
  spawnGates,
  updateGates,
} from "../game/systems/gates";
import { fireShots } from "../game/systems/shooting";
import { createProjection } from "../game/utils/projection";

// ======================================================
// MAIN COMPONENT
// ======================================================
export default function Game() {
  const [tick, setTick] = useState(0);
  const font = useFont(require("../assets/fonts/Inter-Bold.ttf"), 24);

  // ======================================================
  // GAME STATE
  // ======================================================
  const [life, setLife] = useState(100);
  const [score, setScore] = useState(0);
  const playerPower = useRef(0);
  const [gameOver, setGameOver] = useState(false);

  const gameOverRef = useRef(false);
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  // ======================================================
  // ROAD GEOMETRY (PURE)
  // ======================================================
  const roadBottomLeft = width * -0.15;
  const roadBottomRight = width * 1.15;
  const roadTopLeft = width * 0.34;
  const roadTopRight = width * 0.66;
  const ROAD_MARGIN = 0.12;
  const roadTopY = height * 0.2;

  // ======================================================
  // PROJECTION for ROAD counter-swiping
  // ======================================================
  const worldOffsetX = useRef(0);

  const projection = createProjection({
    width,
    height,
    roadTopY,
    cameraScale: 1.25,
    roadTopLeft,
    roadTopRight,
    roadBottomLeft,
    roadBottomRight,
  });

  // ======================================================
  // PLAYER + SHOOTING STATE
  // ======================================================
  const PLAYER_X = useRef(width / 2);
  const PLAYER_Y = height * 0.85;

  const isFiring = useRef(false);
  const lastShot = useRef(0);

  const bullets = useRef<any[]>([]);
  const [fireRate, setFireRate] = useState(500);
  const fireRateRef = useRef(500);

  useEffect(() => {
    fireRateRef.current = fireRate;
  }, [fireRate]);

  // ======================================================
  // BUB SYSTEM STATE
  // ======================================================
  const bubsRef = useRef<any[]>([]);

  // ======================================================
  // ENEMY SYSTEM STATE
  // ======================================================
  const enemies = useRef<any[]>([]);
  const burstFactor = useRef(0);

  // ======================================================
  // GATE SYSTEM STATE
  // ======================================================
  const gates = useRef<any[]>([]);
  const nextGateTime = useRef(0);

  const MIN_GATE_TIME = 8000;
  const MAX_GATE_TIME = 14000;

  function getRandomGateDelay() {
    return MIN_GATE_TIME + Math.random() * (MAX_GATE_TIME - MIN_GATE_TIME);
  }

  const GATE_POOLS = [
    [
      { type: "bub", value: 5 },
      { type: "life", value: 10 },
    ],
    [
      { type: "life", value: 30 },
      { type: "bub", value: 5 },
    ],
    [
      { type: "bub", value: 5 },
      { type: "life", value: 15 },
    ],
    [
      { type: "bub", value: 5 },
      { type: "life", value: 15 },
    ],
  ];

  // ======================================================
  // PURE HELPERS (NO SIDE EFFECTS)
  // ======================================================
  function getGateLabel(gate) {
    if (gate.type === "bub") {
      if (gate.value > 0) {
        spawnBubs({
          bubs: bubsRef,
          count: Math.floor(gate.value),
          MAX_BUBS,
          PLAYER_Y,
        });
      } else {
        bubsRef.current.splice(0, Math.abs(Math.floor(gate.value)));
      }
    }
    if (gate.type === "life")
      return `${gate.value > 0 ? "+" : ""}${gate.value} HP`;
    if (gate.type === "fastFire") return "Fast Fire";
    return "";
  }

  // ======================================================
  // GATE EFFECTS (SIDE EFFECTS)
  // ======================================================
  function applyGate(gate) {
    if (gate.type === "bub") {
      spawnBubs({
        bubs: bubsRef,
        count: gate.value,
        MAX_BUBS,
        PLAYER_Y,
      });
    }

    if (gate.type === "life") {
      setLife((l) => Math.max(0, Math.min(100, l + gate.value)));
    }

    if (gate.type === "fastFire") {
      setFireRate((r) => Math.max(100, r * 0.6));
    }

    if (gate.type === "slowFire") {
      setFireRate((r) => Math.min(1000, r * 1.5));
    }

    // --------------------------------------
    // 🧠 Track player power gain
    // --------------------------------------
    playerPower.current += gate.power || 0;
  }

  // ======================================================
  // MAIN GAME LOOP
  // ======================================================
  useEffect(() => {
    nextGateTime.current = Date.now() + getRandomGateDelay();
    let lastTime = Date.now();

    const interval = setInterval(() => {
      if (gameOverRef.current) return;

      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // ----------------------------
      // SHOOTING
      // ----------------------------
      if (isFiring.current && now - lastShot.current > fireRateRef.current) {
        // --------------------------------------------------
        // 🎯 Convert PLAYER_X → U using projection
        // --------------------------------------------------
        const playerU = projection.unprojectU(
          PLAYER_X.current,
          height * 0.82,
          worldOffsetX.current,
        );
        const safeU = Math.max(0, Math.min(1, playerU));

        fireShots({
          playerU: safeU,
          playerY: height * 0.82,
          bubs: bubsRef.current,
          bullets,
          ROAD_MARGIN,
        });

        lastShot.current = now;
      }

      // ----------------------------
      // BULLET MOVEMENT + CLEANUP
      // ----------------------------
      bullets.current = bullets.current.filter((b) => {
        // 🟡 WAIT until it's time to spawn
        if (now < b.spawnTime) {
          return true; // keep bullet, but don't move it yet
        }

        // 🟢 MOVE
        b.y -= b.speed * dt * BULLET_SPEED_SCALE;

        // 🟢 RANGE CHECK
        const traveled = b.yStart - b.y;
        const maxDistance = (height - roadTopY) * b.range;

        return traveled < maxDistance && b.y > roadTopY;
      });

      // ----------------------------
      // ENEMIES
      // ----------------------------
      spawnEnemies({
        enemies,
        roadTopY,
        ROAD_MARGIN,
        burstFactorRef: burstFactor,
        bubs: bubsRef,
      });

      updateEnemies({
        enemies,
        roadTopY,
        height,
        ROAD_MARGIN,
      });

      // ----------------------------
      // BUBS
      // ----------------------------
      updateBubs({
        bubs: bubsRef,
        playerX: PLAYER_X.current,
        playerY: PLAYER_Y,
        projection,
        worldOffsetX: worldOffsetX.current,
        height,
      });

      // ----------------------------
      // GATES
      // ----------------------------
      spawnGates({
        gates,
        now,
        nextGateTimeRef: nextGateTime,
        getRandomGateDelay,
        roadTopY,
        GATE_POOLS,
      });

      updateGates({ gates, roadTopY, height });

      handleGateEffects({
        gates,
        PLAYER_X,
        PLAYER_Y,
        GATE_HIT_X_PX,
        GATE_HIT_Y_PX,
        applyGate,
        projection,
        worldOffsetX: worldOffsetX.current,
      });

      cleanupGates({ gates, height });

      // ----------------------------
      // COLLISIONS
      // ----------------------------
      handleCollisions({
        enemies,
        bullets,
        bubs: bubsRef,
        gates,
        PLAYER_X,
        PLAYER_Y,
        height,
        setLife,
        setGameOver,
        setScore,
        projection,
        worldOffsetX: worldOffsetX.current,
      });

      // --------------------------------------------------
      // 🎯 AUTO-CENTER WORLD (better feel)
      // --------------------------------------------------
      if (!isFiring.current) {
        const RETURN_SPEED = 0.05;

        worldOffsetX.current += (0 - worldOffsetX.current) * RETURN_SPEED;
      }

      // ----------------------------
      // RENDER TICK
      // ----------------------------
      setTick((t) => t + 1);
    }, 16);

    return () => clearInterval(interval);
  }, []);

  // ======================================================
  // INPUT (TOUCH CONTROLS)
  // ======================================================
  let lastX = 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        if (gameOverRef.current) {
          enemies.current = [];
          bullets.current = [];
          gates.current = [];
          bubsRef.current = [];
          lastShot.current = 0;
          nextGateTime.current = Date.now() + getRandomGateDelay();

          setLife(100);
          setScore(0);
          setFireRate(500);
          setGameOver(false);
          return;
        }

        isFiring.current = true;
        lastX = 0;
      },

      onPanResponderMove: (_, g) => {
        const delta = g.dx - lastX;
        lastX = g.dx;

        // existing player movement (keep it for now)
        PLAYER_X.current += delta * 1.4;

        // --------------------------------------------------
        // 🎯 PLAYER CLAMP (projection-aware)
        // Clamp player to visible road edges
        // --------------------------------------------------
        const leftEdge = projection.projectX(0, PLAYER_Y, worldOffsetX.current);
        const rightEdge = projection.projectX(
          1,
          PLAYER_Y,
          worldOffsetX.current,
        );

        const PLAYER_MARGIN = 12; // visual padding

        PLAYER_X.current = Math.max(
          leftEdge + PLAYER_MARGIN,
          Math.min(rightEdge - PLAYER_MARGIN, PLAYER_X.current),
        );

        // --------------------------------------------------
        // 🌍 WORLD SHIFT (camera movement)
        // Move world opposite of finger drag
        // --------------------------------------------------
        worldOffsetX.current -= delta * 0.6;

        // --------------------------------------------------
        // 🧍 PLAYER ANCHORING
        // Pull player slightly with the world
        // Prevents "sliding on glass" feeling
        // --------------------------------------------------
        const PLAYER_WORLD_COUPLING = 0.25; // tweak 0.1–0.4

        PLAYER_X.current += delta * 0.6 * PLAYER_WORLD_COUPLING;

        // --------------------------------------------------
        // 🚧 CLAMP WORLD OFFSET
        // Prevent road from sliding off-screen
        // --------------------------------------------------
        worldOffsetX.current = projection.clampWorldOffset(
          worldOffsetX.current,
        );
      },

      onPanResponderRelease: () => {
        isFiring.current = false;
      },
    }),
  ).current;

  // ======================================================
  // RENDER
  // ======================================================
  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <View style={{ position: "absolute", top: 60, left: 20, zIndex: 10 }}>
        <Text style={{ color: "black", fontSize: 20 }}>Score: {score}</Text>
      </View>

      <Canvas style={{ flex: 1 }}>
        {/* Background */}
        <Rect x={0} y={0} width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, height)}
              colors={["#87CEEB", "#B0E0E6", "#E6F7FF"]}
            />

            {/* Clouds */}
            <>
              <Circle
                cx={width * 0.2}
                cy={height * 0.15}
                r={20}
                color="white"
              />
              <Circle
                cx={width * 0.25}
                cy={height * 0.15}
                r={25}
                color="white"
              />
              <Circle
                cx={width * 0.3}
                cy={height * 0.15}
                r={20}
                color="white"
              />

              <Circle cx={width * 0.7} cy={height * 0.1} r={18} color="white" />
              <Circle
                cx={width * 0.75}
                cy={height * 0.1}
                r={22}
                color="white"
              />
            </>
          </Rect>
        </Rect>

        {/* Road */}
        <Path
          path={projection.getRoadPath({
            roadBottomLeft,
            roadBottomRight,
            roadTopLeft,
            roadTopRight,
            worldOffsetX: worldOffsetX.current,
          })}
          color="#222"
        />

        {/* Life */}
        {font && (
          <SkiaText
            x={width / 2 - font.getTextWidth(`LIFE: ${life}`) / 2}
            y={roadTopY - 20}
            text={`LIFE: ${life}`}
            font={font}
            color="black"
          />
        )}
        {bubsRef.current.map((b, i) => {
          const x = projection.projectX(b.u, b.y, worldOffsetX.current);

          const time = tick * 16;
          const isSniper = b.type === "sniper";
          const pulse = isSniper
            ? 1 + Math.sin(time * 0.005 + i) * 0.1
            : 1 + Math.sin(time * 0.005 + i) * 0.2;

          if (isSniper) {
            const size = 12 * pulse;

            const path = `
              M ${x} ${b.y - size} 
              L ${x - size} ${b.y + size} 
              L ${x + size} ${b.y + size} 
              Z
            `;

            return (
              <Path
                key={i}
                path={path}
                color="#66ff99" // 👈 light green
              />
            );
          }

          // Default (normal bub)
          return (
            <Circle key={i} cx={x} cy={b.y} r={8 * pulse} color="#00ffcc" />
          );
        })}

        {/* Player */}
        <Circle cx={PLAYER_X.current} cy={PLAYER_Y} r={12} color="orange" />

        {/* Bullets */}
        {bullets.current.map((b, i) => {
          if (Date.now() < b.spawnTime) return null;

          const x = projection.projectX(b.u, b.y, worldOffsetX.current);

          const t = (b.y - roadTopY) / (height - roadTopY);
          const scale = 0.4 + t * 0.6;

          const BULLET_COLORS = {
            normal: "yellow",
            sniper: "#66ff99",
            scatter: "#ffcc66",
          };

          const color = BULLET_COLORS[b.type] || BULLET_COLORS.normal;

          return (
            <Circle
              key={i}
              cx={x}
              cy={b.y}
              r={b.type === "sniper" ? 3 * scale : 4 * scale}
              opacity={b.type === "sniper" ? 1 : 0.9}
              color={color}
            />
          );
        })}

        {/* Enemies */}
        {enemies.current.map((e, i) => {
          const x = projection.projectX(e.u, e.y, worldOffsetX.current);

          const flash = e.flash || 0;

          const getFlashColor = (base, flash) => {
            if (flash <= 0) return base;

            return `rgba(255,255,255,${flash})`;
          };

          const color = flash > 0 ? getFlashColor("red", flash) : "red";

          const scale = 0.3 + (e.y / height) * 1.5;

          return <Circle key={i} cx={x} cy={e.y} r={8 * scale} color={color} />;
        })}

        {/* Gates */}
        {gates.current.map((g, i) => {
          const renderGate = (gate, key) => {
            const x = projection.projectX(gate.u, g.y, worldOffsetX.current);

            if (!font) return null;

            const label =
              gate.value > 0
                ? `+${Math.floor(gate.value)} bub`
                : `${Math.floor(gate.value)} bub`;

            const scale = 0.4 + ((g.y - roadTopY) / (height - roadTopY)) * 1.2;

            // --------------------------------------------------
            // 🎯 LANE WIDTH (3 equal segments)
            // --------------------------------------------------
            const laneWidthU = 1 / 3;

            const leftU = gate.u - laneWidthU / 2;
            const rightU = gate.u + laneWidthU / 2;

            // project both edges
            const leftX = projection.projectX(leftU, g.y, worldOffsetX.current);
            const rightX = projection.projectX(
              rightU,
              g.y,
              worldOffsetX.current,
            );

            const widthPx = rightX - leftX;
            const heightPx = 60 * scale;

            const textWidth = font.getTextWidth(label);

            const isPositive = gate.value >= 0;

            const colors = isPositive
              ? ["rgba(0,255,0,0.6)", "rgba(0,255,0,0.0)"]
              : ["rgba(255,0,0,0.6)", "rgba(255,0,0,0.0)"];

            // --------------------------------------------------
            // ✨ FLASH VISUAL (from collisions system)
            // --------------------------------------------------
            const flash = gate.flash || 0;
            const overlayColor = `rgba(255,255,255,${flash})`;

            return (
              <Rect
                key={key}
                x={leftX}
                y={g.y - heightPx}
                width={widthPx}
                height={heightPx}
                opacity={gate.passed ? 0.3 : 1}
              >
                <LinearGradient
                  start={vec(0, g.y)}
                  end={vec(0, g.y - heightPx)}
                  colors={colors}
                />
                <SkiaText
                  x={x - textWidth / 2}
                  y={g.y - heightPx / 2}
                  text={label}
                  font={font}
                  color="white"
                />
                {/* --------------------------------------
                    ✨ Flash overlay (hit feedback)
                -------------------------------------- */}
                {flash > 0 && (
                  <Rect
                    x={leftX}
                    y={g.y - heightPx}
                    width={widthPx}
                    height={heightPx}
                    color={overlayColor}
                  />
                )}
              </Rect>
            );
          };

          return (
            <React.Fragment key={i}>
              {g.items.map((gate, idx) => renderGate(gate, idx))}
            </React.Fragment>
          );
        })}

        {/* Fog Overlay */}
        <Rect x={0} y={roadTopY - 10} width={width} height={height}>
          <LinearGradient
            start={vec(0, roadTopY)}
            end={vec(0, height)}
            colors={["rgba(255,255,255,0.4)", "rgba(255,255,255,0.0)"]}
          />
        </Rect>

        {gameOver && font && (
          <>
            <Rect
              x={width / 2 - (width * 0.7) / 2}
              y={height / 2 - 70}
              width={width * 0.7}
              height={140}
              r={20}
              color="rgba(0,0,0,0.6)"
            />

            <SkiaText
              x={width / 2 - font.getTextWidth("GAME OVER") / 2}
              y={height / 2 - 10}
              text="GAME OVER"
              font={font}
              color="red"
            />

            <SkiaText
              x={width / 2 - font.getTextWidth("Tap to restart") / 2}
              y={height / 2 + 30}
              text="Tap to restart"
              font={font}
              color="white"
            />
          </>
        )}
      </Canvas>
    </View>
  );
}
