import { Canvas, useFrame } from "@react-three/fiber/native";
import React, { useRef } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";

const ROAD_WIDTH = 10;
const PLAYER_Z = 5.5; // where the player starts on the screen
const FAR_Z = -60; // defines the front and end of the road for bullets and enemies
const NEAR_Z = 20; // defines the front and end of the road for bullets and enemies

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
      <planeGeometry args={[5.4, 100]} />
      <meshStandardMaterial color="#666" />
    </mesh>
  );
}

function Bullet({ data }: any) {
  const mesh = useRef<any>();

  useFrame(() => {
    if (mesh.current) {
      mesh.current.position.x = data.x;
      mesh.current.position.z = data.z;
    }
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial color="yellow" />
    </mesh>
  );
}

function Enemy({ data }: any) {
  const mesh = useRef<any>();

  useFrame(() => {
    if (mesh.current) {
      mesh.current.position.x = data.x;
      mesh.current.position.z = data.z;

      // scale based on distance
      const scale = 0.5 + (10 - data.z) * 0.01;
      mesh.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <mesh ref={mesh} position={[data.x, 0.2, data.z]}>
      <sphereGeometry args={[0.3, 12, 12]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
}

export default function Index() {
  const [, setTick] = React.useState(0);

  const playerX = useRef(0);
  const isFiring = useRef(false);
  const lastShotTime = useRef(0);

  const FIRE_RATE = 3; // shots per second
  const BULLET_SPEED = 0.1;

  const lastSpawnTime = useRef(0);

  const [bullets, setBullets] = React.useState<any[]>([]);
  const [enemies, setEnemies] = React.useState<any[]>([]);

  const enemiesRef = useRef(enemies);
  const bulletsRef = useRef(bullets);

  const ENEMY_SPEED = 0.08;
  const SPAWN_RATE = 1.2;

  const [score, setScore] = React.useState(0);

  let lastX = 0;

  React.useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);

  React.useEffect(() => {
    bulletsRef.current = bullets;
  }, [bullets]);

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
    bulletsRef,
    enemiesRef,
    isFiring,
    lastShotTime,
    lastSpawnTime,
  }: any) {
    useFrame((state) => {
      const time = state.clock.getElapsedTime();

      // 🔥 SPAWN ENEMIES
      if (time - lastSpawnTime.current > SPAWN_RATE) {
        setEnemies((prev) => [
          ...prev,
          { x: (Math.random() - 0.5) * 4, z: -60, power: 1 },
        ]);

        lastSpawnTime.current = time;
      }

      // 🔥 MOVE ENEMIES
      enemiesRef.current.forEach((e) => {
        e.z += ENEMY_SPEED;
      });

      // 🔥 CLEANUP
      setEnemies((prev) => prev.filter((e) => e.z < NEAR_Z));

      if (isFiring.current) {
        if (time - lastShotTime.current > 1 / FIRE_RATE) {
          setBullets((prev) => [...prev, { x: playerX.current, z: PLAYER_Z }]);

          lastShotTime.current = time;
        }
      }

      bulletsRef.current.forEach((b) => {
        b.z -= BULLET_SPEED;
      });

      setBullets((prev) => prev.filter((b) => b.z > FAR_Z)); // last number is how far bullets travel
    });

    // COLLISIONS (simple + safe)
    const newBullets = [];
    const newEnemies = [];

    let scoreGain = 0;

    enemies.forEach((enemy) => {
      let hit = false;

      bullets.forEach((bullet) => {
        const dx = bullet.x - enemy.x;
        const dz = bullet.z - enemy.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.4 && !hit) {
          hit = true;
          scoreGain += enemy.power;
        }
      });

      if (!hit) newEnemies.push(enemy);
    });

    bullets.forEach((bullet) => {
      const hitEnemy = enemies.some((enemy) => {
        const dx = bullet.x - enemy.x;
        const dz = bullet.z - enemy.z;
        return Math.sqrt(dx * dx + dz * dz) < 0.4;
      });

      if (!hitEnemy) newBullets.push(bullet);
    });

    // apply results
    setBullets(newBullets);
    setEnemies(newEnemies);

    if (scoreGain > 0) {
      setScore((s) => s + scoreGain);
    }

    setTick((t) => t + 1);

    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          position: "absolute",
          top: 40,
          left: 20,
          zIndex: 2,
        }}
      >
        <Text style={{ color: "black", fontSize: 24 }}>Score: {score}</Text>
      </View>

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
          bulletsRef={bulletsRef}
          enemiesRef={enemiesRef}
          isFiring={isFiring}
          lastShotTime={lastShotTime}
          lastSpawnTime={lastSpawnTime}
        />

        {bullets.map((b, i) => (
          <Bullet key={i} data={b} />
        ))}

        {enemies.map((e, i) => (
          <Enemy key={i} data={e} />
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
