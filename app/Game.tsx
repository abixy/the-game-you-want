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

export default function Game() {
  const [tick, setTick] = useState(0);

  const font = useFont(require("../assets/fonts/Inter-Bold.ttf"), 24);

  // GAME CONFIG
  const [life, setLife] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);
  // GAME CONFIG

  // PLAYER (AND BUBS)
  const PLAYER_X = useRef(width / 2);
  const PLAYER_Y = height * 0.85;
  const isFiring = useRef(false);
  const lastShot = useRef(0);
  const bullets = useRef<any[]>([]);
  const [fireRate, setFireRate] = useState(500);
  const bubsRef = useRef<any[]>([]);
  const fireRateRef = useRef(500);
  const shotIdRef = useRef(0);
  const RIPPLE_STEP = 30;
  const MAX_RIPPLE_DELAY = 100;

  useEffect(() => {
    fireRateRef.current = fireRate;
  }, [fireRate]);

  function getBubOffsets(count) {
    const offsets = [];

    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const step = Math.floor(i / 2) + 1;

      offsets.push(side * step * 0.05);
    }

    return offsets;
  }

  // ROAD GEOMETRY
  const roadBottomLeft = width * -0.15; // was -0.05
  const roadBottomRight = width * 1.15; // was 1.05

  const roadTopLeft = width * 0.34; // was ~0.38
  const roadTopRight = width * 0.66; // was ~0.62

  const ROAD_MARGIN = 0.12; // 12% on each side (tweak this)

  const roadTopY = height * 0.2; // slightly further up

  function getRoadEdges(y) {
    const t = (y - roadTopY) / (height - roadTopY);

    const left = roadTopLeft + t * (roadBottomLeft - roadTopLeft);

    const right = roadTopRight + t * (roadBottomRight - roadTopRight);

    return { left, right };
  }
  // ROAD GEOMETRY

  // ENEMIES
  const enemies = useRef<any[]>([]);
  const burstFactor = useRef(0);

  // COLLISIONS (BULLETS)
  const HIT_U = 0.04; // horizontal tolerance
  const HIT_Y = 12; // vertical tolerance (pixels)

  // GATES
  const gates = useRef<any[]>([]);
  const MIN_GATE_TIME = 8000; // 8 seconds
  const MAX_GATE_TIME = 14000; // 14 seconds
  const nextGateTime = useRef(0);

  const GATE_POOLS = [
    // SAFE
    [
      { type: "bub", value: 1 },
      { type: "life", value: 10 },
    ],

    // BUB GROWTH
    [
      { type: "bub", value: 1 },
      { type: "bub", value: 2 },
    ],

    // RISK
    [
      { type: "bub", value: 2 },
      { type: "life", value: -15 },
    ],

    // UTILITY
    [
      { type: "fastFire", value: 1 },
      { type: "life", value: 15 },
    ],
  ];

  function getRandomGateDelay() {
    return MIN_GATE_TIME + Math.random() * (MAX_GATE_TIME - MIN_GATE_TIME);
  }

  function getGateLabel(gate) {
    if (gate.type === "bub") return `+${gate.value} bub`;
    if (gate.type === "life")
      return `${gate.value > 0 ? "+" : ""}${gate.value} ❤️`;
    if (gate.type === "fastFire") return "⚡";
    return "";
  }

  // COLLISION (GATES)
  const GATE_HIT_X_PX = 60; // horizontal tolerance
  const GATE_HIT_Y_PX = 40; // vertical tolerance
  // GATES

  // GATE Effects
  // SPAWN BUBS
  function applyGate(gate) {
    if (gate.type === "bub") {
      for (let i = 0; i < gate.value; i++) {
        bubsRef.current.push({
          u: 0.5,
          y: PLAYER_Y,

          driftX: 0,
          driftY: 0,
        });
      }
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
  }
  // GATE Effects

  const [score, setScore] = useState(0);

  //LOGGING DEBUG
  //console.log("gates:", gates.current.length);

  // 🎯 GAME LOOP
  useEffect(() => {
    // begin GATES
    nextGateTime.current = Date.now() + getRandomGateDelay();

    const interval = setInterval(() => {
      // GAME OVER FREEZE
      if (gameOverRef.current) return;

      // spawn bullets
      const now = Date.now();

      if (isFiring.current && now - lastShot.current > fireRateRef.current) {
        const { left, right } = getRoadEdges(height * 0.82);
        const playerU = (PLAYER_X.current - left) / (right - left);

        const offsets = [0, ...getBubOffsets(bubsRef.current)];

        const shotId = shotIdRef.current++;

        // player shot
        bullets.current.push({
          u: playerU,
          y: height * 0.82,
        });

        // bub shots
        bubsRef.current.forEach((bub) => {
          bullets.current.push({
            u: bub.u,
            y: height * 0.82,
          });
        });

        lastShot.current = now;
      }

      // move bullets
      bullets.current.forEach((b) => {
        const speed = 4 + (1 - b.y / height) * 2; // slight perspective feel
        b.y -= speed;
      });

      // spawn enemies
      const time = Date.now() * 0.001;

      // smooth wave between 0 and 1
      const raw = (Math.sin(time) + 1) / 2;

      // squash low values → longer quiet periods
      burstFactor.current = Math.pow(raw, 3);

      // spawn chance
      const chance =
        0.001 + // baseline (almost nothing)
        burstFactor.current * 0.25; // burst intensity - maybe ramp this up as player gets better  - YES DO THIS

      if (Math.random() < chance) {
        const y = roadTopY;

        const u = ROAD_MARGIN + Math.random() * (1 - ROAD_MARGIN * 2);

        enemies.current.push({ u, y });
      }

      // move enemies
      enemies.current.forEach((e) => {
        const t = (e.y - roadTopY) / (height - roadTopY); // 0 → 1
        const speed = 0.2 + Math.pow(t, 1.2) * 10;
        e.y += speed;

        // keep inside inner road
        e.u = Math.max(ROAD_MARGIN, Math.min(1 - ROAD_MARGIN, e.u));
      });

      // move Bubs
      bubsRef.current.forEach((bub, i) => {
        const { left, right } = getRoadEdges(PLAYER_Y);
        const playerU = (PLAYER_X.current - left) / (right - left);

        const roadWidth = right - left;
        const driftURange = 20 / roadWidth;

        // Occasionally pick a new drift target
        if (!bub.nextDriftTime || Date.now() > bub.nextDriftTime) {
          bub.driftX = (Math.random() - 0.5) * 2 * driftURange;
          bub.driftY = (Math.random() - 0.5) * 40; // ±20px

          bub.nextDriftTime = Date.now() + 300 + Math.random() * 700;
        }

        // Target position = player + drift
        const targetU = playerU + bub.driftX;
        const targetY = PLAYER_Y + bub.driftY;

        // Smooth follow (rubber band)
        bub.u += (targetU - bub.u) * 0.08;
        bub.y += (targetY - bub.y) * 0.08;

        // Clamp to road
        bub.u = Math.max(ROAD_MARGIN, Math.min(1 - ROAD_MARGIN, bub.u));
      });

      // spawn gates
      if (now > nextGateTime.current) {
        const y = roadTopY + 100;

        const pool = GATE_POOLS[Math.floor(Math.random() * GATE_POOLS.length)];

        gates.current.push({
          y,
          left: { ...pool[0], u: 0.3, passed: false },
          right: { ...pool[1], u: 0.7, passed: false },
        });

        // schedule next spawn
        nextGateTime.current = now + getRandomGateDelay();
      }

      // move gates
      gates.current.forEach((g) => {
        const t = (g.y - roadTopY) / (height - roadTopY);

        const speed = (1 + Math.pow(t, 2.5) * 7) * 2; // 👈 double enemy speed

        g.y += speed;
      });

      // COLLISIONS
      const newBullets = [];
      const newEnemies = [];

      let scoreGain = 0;

      enemies.current.forEach((enemy) => {
        let hit = false;

        bullets.current.forEach((bullet) => {
          const du = Math.abs(bullet.u - enemy.u);
          const dy = Math.abs(bullet.y - enemy.y);

          const scale = 0.3 + (enemy.y / height) * 1.5;
          const dynamicHitY = 8 + scale * 6;

          if (du < HIT_U && dy < dynamicHitY && !hit) {
            hit = true;
            scoreGain += 1;
          }
        });

        if (!hit) newEnemies.push(enemy);
      });

      bullets.current.forEach((bullet) => {
        const hit = enemies.current.some((enemy) => {
          const du = Math.abs(bullet.u - enemy.u);
          const dy = Math.abs(bullet.y - enemy.y);
          return du < HIT_U && dy < HIT_Y;
        });

        if (!hit) newBullets.push(bullet);
      });

      // apply updates
      enemies.current = newEnemies;
      bullets.current = newBullets;
      // COLLISIONS

      // GATE Effects
      gates.current.forEach((g) => {
        [g.left, g.right].forEach((gate) => {
          if (gate.passed) return;

          const { left, right } = getRoadEdges(g.y);
          const gateX = left + gate.u * (right - left);

          const dx = Math.abs(PLAYER_X.current - gateX);
          const dy = Math.abs(PLAYER_Y - g.y);

          if (dx < GATE_HIT_X_PX && dy < GATE_HIT_Y_PX) {
            applyGate(gate);
            gate.passed = true;
          }
        });
      });
      // GATE Effects

      // SCORE
      if (scoreGain > 0) {
        setScore((s) => s + scoreGain);
      }

      // CLEANUP
      bullets.current = bullets.current.filter((b) => b.y > roadTopY);
      gates.current = gates.current.filter((g) => g.y < height);

      // GAME OVER CHECK
      let lifeLoss = 0;

      const remainingEnemies = [];

      enemies.current.forEach((e) => {
        if (e.y >= height) {
          lifeLoss++;
        } else {
          remainingEnemies.push(e);
        }
      });

      enemies.current = remainingEnemies;

      if (lifeLoss > 0) {
        setLife((prev) => {
          const newLife = Math.max(0, prev - lifeLoss);

          if (newLife <= 0) {
            setGameOver(true);
          }

          return newLife;
        });
      }
      // GAME OVER CHECK

      // trigger redraw
      setTick((t) => t + 1);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, []);

  // 🎮 TOUCH
  let lastX = 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        if (gameOverRef.current) {
          // RESET GAME
          enemies.current = [];
          bullets.current = [];
          gates.current = [];

          setLife(100);
          setScore(0);
          setFireRate(500);
          setGameOver(false);

          return;
        }

        // normal gameplay
        isFiring.current = true;
        lastX = 0;
      },

      onPanResponderMove: (_, g) => {
        const delta = g.dx - lastX;
        lastX = g.dx;

        PLAYER_X.current += delta * 1.4; // higher = more sensitivity

        // clamp to screen
        //PLAYER_X.current = Math.max(20, Math.min(width - 20, PLAYER_X.current));

        // clamp to road - not sure if I like this or not
        const { left, right } = getRoadEdges(PLAYER_Y);

        PLAYER_X.current = Math.max(
          left + 10,
          Math.min(right - 10, PLAYER_X.current),
        );
      },

      onPanResponderRelease: () => {
        isFiring.current = false;
      },
    }),
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <View
        style={{
          position: "absolute",
          top: 60,
          left: 20,
          zIndex: 10,
        }}
      >
        <Text style={{ color: "black", fontSize: 20 }}>Score: {score}</Text>
      </View>

      <Canvas style={{ flex: 1 }}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={["#87CEEB", "#B0E0E6", "#E6F7FF"]}
          />
          <>
            {/* Cloud 1 */}
            <Circle cx={width * 0.2} cy={height * 0.15} r={20} color="white" />
            <Circle cx={width * 0.25} cy={height * 0.15} r={25} color="white" />
            <Circle cx={width * 0.3} cy={height * 0.15} r={20} color="white" />

            {/* Cloud 2 */}
            <Circle cx={width * 0.7} cy={height * 0.1} r={18} color="white" />
            <Circle cx={width * 0.75} cy={height * 0.1} r={22} color="white" />
          </>
        </Rect>

        {/* ROAD (trapezoid) */}
        <Path
          path={`M ${roadBottomLeft} ${height}
                L ${roadBottomRight} ${height}
                L ${roadTopRight} ${roadTopY}
                L ${roadTopLeft} ${roadTopY}
                Z`}
          color="#222"
        />

        {font && (
          <SkiaText
            x={width / 2 - font.getTextWidth(`LIFE: ${life}`) / 2}
            y={roadTopY - 20}
            text={`LIFE: ${life}`}
            font={font}
            color="black"
          />
        )}

        {/* Player */}
        <Circle cx={PLAYER_X.current} cy={PLAYER_Y} r={12} color="orange" />

        {/* Bubs */}
        {bubsRef.current.map((b, i) => {
          const { left, right } = getRoadEdges(b.y);
          const x = left + b.u * (right - left);

          return <Circle key={i} cx={x} cy={b.y} r={8} color="#00ffcc" />;
        })}

        {/* Bullets */}
        {bullets.current.map((b, i) => {
          const { left, right } = getRoadEdges(b.y);
          const x = left + b.u * (right - left);
          const t = (b.y - roadTopY) / (height - roadTopY); // 0 (top) → 1 (bottom)
          const scale = 0.4 + t * 0.6;

          return (
            <Circle key={i} cx={x} cy={b.y} r={4 * scale} color="yellow" />
          );
        })}

        {/* Enemies with perspective */}
        {enemies.current.map((e, i) => {
          const { left, right } = getRoadEdges(e.y);
          const x = left + e.u * (right - left);
          const scale = 0.3 + (e.y / height) * 1.5;

          return <Circle key={i} cx={x} cy={e.y} r={8 * scale} color="red" />;
        })}

        {/* Gates */}
        {gates.current.map((g, i) => {
          const renderGate = (gate, key) => {
            const { left, right } = getRoadEdges(g.y);

            const x = left + gate.u * (right - left);

            const opacity = gate.passed ? 0.3 : 1;

            if (!font) return null;

            const label = getGateLabel(gate);

            // perspective scale
            const baseWidth = 80;
            const baseHeight = 60;

            const t = (g.y - roadTopY) / (height - roadTopY); // 0 → 1
            const scale = 0.4 + t * 1.2; // tweakable

            const widthPx = baseWidth * scale;
            const heightPx = baseHeight * scale;

            // font centering
            const textWidth = font.getTextWidth(label);

            return (
              <Rect
                key={key}
                x={x - widthPx / 2}
                y={g.y - heightPx}
                width={widthPx}
                height={heightPx}
                opacity={opacity}
              >
                <LinearGradient
                  start={vec(0, g.y)}
                  end={vec(0, g.y - heightPx)}
                  colors={
                    gate.passed
                      ? ["rgba(150,150,150,0.4)", "rgba(150,150,150,0.0)"]
                      : ["rgba(0,255,0,0.5)", "rgba(0,255,0,0.0)"]
                  }
                />

                <SkiaText
                  x={x - textWidth / 2}
                  y={g.y - heightPx / 2}
                  text={label}
                  font={font}
                  color={gate.passed ? "rgba(200,200,200,0.6)" : "white"}
                />
              </Rect>
            );
          };

          return (
            <React.Fragment key={i}>
              {renderGate(g.left, "l" + i)}
              {renderGate(g.right, "r" + i)}
            </React.Fragment>
          );
        })}

        <Rect x={0} y={roadTopY - 10} width={width} height={height}>
          <LinearGradient
            start={vec(0, roadTopY)}
            end={vec(0, height)}
            colors={[
              "rgba(255,255,255,0.4)", // clear near top
              "rgba(255,255,255,0.0)", // fog near player
            ]}
          />
        </Rect>

        {gameOver && font && (
          <>
            {/* Background Box */}
            <Rect
              x={width / 2 - (width * 0.7) / 2}
              y={height / 2 - 70}
              width={width * 0.7}
              height={140}
              r={20}
              color="rgba(0,0,0,0.6)"
            />

            {/* GAME OVER */}
            <SkiaText
              x={width / 2 - font.getTextWidth("GAME OVER") / 2}
              y={height / 2 - 10}
              text="GAME OVER"
              font={font}
              color="red"
            />

            {/* Restart */}
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
