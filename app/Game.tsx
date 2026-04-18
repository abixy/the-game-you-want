import { Canvas, Circle } from "@shopify/react-native-skia";
import React, { useEffect, useRef, useState } from "react";
import { Dimensions, PanResponder, View } from "react-native";

const { width, height } = Dimensions.get("window");

export default function Game() {
  const playerX = useRef(width / 2);
  const [tick, setTick] = useState(0);

  const bullets = useRef<any[]>([]);
  const enemies = useRef<any[]>([]);

  const isFiring = useRef(false);

  // 🎯 GAME LOOP
  useEffect(() => {
    const interval = setInterval(() => {
      // spawn bullets
      if (isFiring.current) {
        bullets.current.push({
          x: playerX.current,
          y: height * 0.8,
        });
      }

      // spawn enemies
      if (Math.random() < 0.05) {
        enemies.current.push({
          x: Math.random() * width,
          y: 0,
        });
      }

      // move bullets
      bullets.current.forEach((b) => (b.y -= 6));

      // move enemies
      enemies.current.forEach((e) => (e.y += 2));

      // cleanup
      bullets.current = bullets.current.filter((b) => b.y > 0);
      enemies.current = enemies.current.filter((e) => e.y < height);

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
        isFiring.current = true;
        lastX = 0;
      },

      onPanResponderMove: (_, g) => {
        const delta = g.dx - lastX;
        lastX = g.dx;

        playerX.current += delta * 1.4; // higher = more sensitivity

        // clamp to screen
        playerX.current = Math.max(20, Math.min(width - 20, playerX.current));
      },

      onPanResponderRelease: () => {
        isFiring.current = false;
      },
    }),
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <Canvas style={{ flex: 1 }}>
        {/* Player */}
        <Circle cx={playerX.current} cy={height * 0.85} r={12} color="blue" />

        {/* Bullets */}
        {bullets.current.map((b, i) => (
          <Circle key={i} cx={b.x} cy={b.y} r={4} color="green" />
        ))}

        {/* Enemies */}
        {enemies.current.map((e, i) => (
          <Circle key={i} cx={e.x} cy={e.y} r={10} color="red" />
        ))}
      </Canvas>
    </View>
  );
}
