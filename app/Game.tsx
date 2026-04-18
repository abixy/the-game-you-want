import {
  Canvas,
  Circle,
  LinearGradient,
  Path,
  Rect,
  rrect,
  Text as SkiaText,
  useFont,
  vec,
} from "@shopify/react-native-skia";
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, PanResponder, Text, View } from "react-native";

const { width, height } = Dimensions.get("window");

export default function Game() {
  const [tick, setTick] = useState(0);

  // GAME CONFIG
  const [life, setLife] = useState(100);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);
  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  const font = useFont(require("../assets/fonts/Inter-Bold.ttf"), 24);

  // PLAYER
  const playerX = useRef(width / 2);
  const isFiring = useRef(false);
  const lastShot = useRef(0);
  const FIRE_RATE = 500; // ms

  // ROAD GEOMETRY
  const roadBottomLeft = width * -0.15; // was -0.05
  const roadBottomRight = width * 1.15; // was 1.05

  const roadTopLeft = width * 0.34; // was ~0.38
  const roadTopRight = width * 0.66; // was ~0.62

  const ROAD_MARGIN = 0.12; // 12% on each side (tweak this)

  const roadTopY = height * 0.2; // slightly further up
  // ROAD GEOMETRY

  function getRoadEdges(y) {
    const t = (y - roadTopY) / (height - roadTopY);

    const left = roadTopLeft + t * (roadBottomLeft - roadTopLeft);

    const right = roadTopRight + t * (roadBottomRight - roadTopRight);

    return { left, right };
  }

  const bullets = useRef<any[]>([]);

  // ENEMIES
  const enemies = useRef<any[]>([]);
  const burstFactor = useRef(0);

  // COLLIONS
  const HIT_U = 0.04; // horizontal tolerance
  const HIT_Y = 12; // vertical tolerance (pixels)

  // GATES
  const gates = useRef<any[]>([]);
  const MIN_GATE_TIME = 8000; // 8 seconds
  const MAX_GATE_TIME = 14000; // 14 seconds
  const nextGateTime = useRef(0);

  function getRandomGateDelay() {
    return MIN_GATE_TIME + Math.random() * (MAX_GATE_TIME - MIN_GATE_TIME);
  }

  function getGateLabel(gate) {
    if (gate.type === "add") return `+${gate.value}`;
    if (gate.type === "multiply") return `×${gate.value}`;
    if (gate.type === "divide") return `÷${gate.value}`;
    return "";
  }

  // collision
  const GATE_HIT_X_PX = 60; // horizontal tolerance
  const GATE_HIT_Y_PX = 40; // vertical tolerance
  // GATES

  // GATE Effects
  const [shotPower, setShotPower] = useState(1);

  function applyGate(gate) {
    if (gate.type === "add") {
      setShotPower((p) => p + gate.value);
    }

    if (gate.type === "multiply") {
      setShotPower((p) => p * gate.value);
    }

    if (gate.type === "divide") {
      setShotPower((p) => p / gate.value);
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

      if (isFiring.current && now - lastShot.current > FIRE_RATE) {
        const { left, right } = getRoadEdges(height * 0.82);
        const u = (playerX.current - left) / (right - left);

        bullets.current.push({
          u,
          y: height * 0.82,
          power: shotPower,
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

      // spawn gates
      if (now > nextGateTime.current) {
        const y = roadTopY + 100;

        gates.current.push({
          y,
          left: {
            u: 0.3,
            type: "add",
            value: 10,
            passed: false,
          },
          right: {
            u: 0.7,
            type: "multiply",
            value: 2,
            passed: false,
          },
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
            if (bullet.power >= enemy.power ?? 1) {
              scoreGain += enemy.power ?? 1;
            }
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
      const playerY = height * 0.85;

      gates.current.forEach((g) => {
        [g.left, g.right].forEach((gate) => {
          if (gate.passed) return;

          const { left, right } = getRoadEdges(g.y);
          const gateX = left + gate.u * (right - left);

          const dx = Math.abs(playerX.current - gateX);
          const dy = Math.abs(playerY - g.y);

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
          // SETUP GAME OVER box render
          const boxWidth = width * 0.7;
          const boxHeight = 140;

          const boxX = width / 2 - boxWidth / 2;
          const boxY = height / 2 - boxHeight / 2;

          const radius = 20;

          const roundedRect = rrect(
            { x: boxX, y: boxY, width: boxWidth, height: boxHeight },
            radius,
            radius,
          );

          // RESET GAME
          enemies.current = [];
          bullets.current = [];
          gates.current = [];

          setLife(100);
          setScore(0);
          setShotPower(1);
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

        playerX.current += delta * 1.4; // higher = more sensitivity

        // clamp to screen
        //playerX.current = Math.max(20, Math.min(width - 20, playerX.current));

        // clamp to road - not sure if I like this or not
        const { left, right } = getRoadEdges(height * 0.85);

        playerX.current = Math.max(
          left + 10,
          Math.min(right - 10, playerX.current),
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

      <View
        style={{
          position: "absolute",
          top: 60,
          right: 20,
          zIndex: 10,
        }}
      >
        <Text style={{ color: "black", fontSize: 20 }}>Power: {shotPower}</Text>
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
        <Circle cx={playerX.current} cy={height * 0.85} r={12} color="orange" />

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
            const fontSize = 20 * scale;
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
