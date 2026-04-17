import { Canvas, useFrame } from "@react-three/fiber/native";
import React, { useRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";

const ROAD_WIDTH = 10;
const PLAYER_Z = 5.5; // where the player starts on the screen

function Player({ positionRef }: any) {
  const mesh = useRef<any>();

  useFrame(() => {
    if (mesh.current) {
      mesh.current.position.x = positionRef.current;
    }
  });

  return (
    <mesh ref={mesh} position={[0, 0.1, PLAYER_Z]}>
      <coneGeometry args={[0.3, 0.8, 3]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

function Road() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -20]}>
      <planeGeometry args={[5.4, 200]} />
      <meshStandardMaterial color="#666" />
    </mesh>
  );
}

function Bullet({ position }: any) {
  const mesh = useRef<any>();

  useFrame(() => {
    if (mesh.current) {
      mesh.current.position.z -= 0.5;
    }
  });

  return (
    <mesh ref={mesh} position={position}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial color="yellow" />
    </mesh>
  );
}

export default function Index() {
  const [, setTick] = React.useState(0);
  const playerX = useRef(0);
  const bullets = useRef<any[]>([]);
  const isFiring = useRef(false);
  const lastShotTime = useRef(0);

  const FIRE_RATE = 3; // shots per second
  const BULLET_SPEED = 0.1;

  let lastX = 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        isFiring.current = true;
        lastX = 0;
      },

      onPanResponderMove: (_, gesture) => {
        const delta = gesture.dx - lastX;
        lastX = gesture.dx;

        playerX.current += delta * 0.015; // adjust player sensitivity here

        const SCREEN_BOUND = 2.0; // tweak this as to how far a player can move

        playerX.current = Math.max(
          -SCREEN_BOUND,
          Math.min(SCREEN_BOUND, playerX.current),
        );
      },

      onPanResponderRelease: () => {
        isFiring.current = false;
      },
    }),
  ).current;

  function GameLoop({
    playerX,
    bullets,
    isFiring,
    lastShotTime,
    setTick,
  }: any) {
    useFrame((state) => {
      const time = state.clock.getElapsedTime();

      if (isFiring.current) {
        if (time - lastShotTime.current > 1 / FIRE_RATE) {
          bullets.current.push({
            x: playerX.current,
            z: PLAYER_Z,
          });

          lastShotTime.current = time;
        }
      }

      bullets.current.forEach((b) => {
        b.z -= BULLET_SPEED;
      });

      bullets.current = bullets.current.filter((b) => b.z > -50);

      // 🔥 force render
      setTick((t) => t + 1);
    });

    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      {/* 3D Scene */}
      <Canvas
        style={{ flex: 1 }}
        pointerEvents="box-none"
        camera={{ position: [0, 6, 10], fov: 60 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[0, 10, 5]} />

        <group>
          <Road />
          <Player positionRef={playerX} />
        </group>

        <GameLoop
          playerX={playerX}
          bullets={bullets}
          isFiring={isFiring}
          lastShotTime={lastShotTime}
          setTick={setTick}
        />

        {bullets.current.map((b, i) => (
          <Bullet key={i} position={[b.x, 0.2, b.z]} />
        ))}
      </Canvas>

      {/* Touch Layer */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          zIndex: 1,
        }}
        {...panResponder.panHandlers}
      />
    </View>
  );
}
