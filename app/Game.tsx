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
    /* Tuning guide. 0.1 → current
    0.08 → slightly smaller
    0.05 → small / precise
    0.03 → tiny (hard to see)
    */
    <mesh ref={mesh}>
      <sphereGeometry args={[0.05, 8, 8]} />
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
      <sphereGeometry args={[0.25, 12, 12]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
}

function Gate({ data, side }) {
  const mesh = useRef();

  useFrame(() => {
    if (mesh.current) {
      mesh.current.position.x = side === "left" ? data.left.x : data.right.x;
      mesh.current.position.z = data.z;
    }
  });

  return (
    <mesh ref={mesh}>
      <boxGeometry args={[1, 1, 0.2]} />
      <meshStandardMaterial color="blue" />
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

  // Gate data
  const gates = useRef([]);
  const lastGateSpawn = useRef(0);
  const GATE_SPEED = 0.08;
  const GATE_SPAWN_RATE = 4;

  const [score, setScore] = React.useState(0);
  const [shotPower, setShotPower] = React.useState(1);

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

      // Spawn Gates
      if (time - lastGateSpawn.current > GATE_SPAWN_RATE) {
        gates.current.push({
          z: -110,
          left: {
            x: -1.5,
            type: "add",
            value: 10,
          },
          right: {
            x: 1.5,
            type: "multiply",
            value: 2,
          },
        });

        lastGateSpawn.current = time;
      }

      // 🔥 MOVE ENEMIES
      enemiesRef.current.forEach((e) => {
        e.z += ENEMY_SPEED;
      });

      // Move Gates
      gates.current.forEach((g) => {
        g.z += GATE_SPEED;
      });

      // 🔥 CLEANUP
      setEnemies((prev) => prev.filter((e) => e.z < NEAR_Z));

      if (isFiring.current) {
        if (time - lastShotTime.current > 1 / FIRE_RATE) {
          setBullets((prev) => [
            ...prev,
            { x: playerX.current, z: PLAYER_Z, power: shotPower },
          ]);

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
      let enemyHit = false;

      bullets.forEach((bullet) => {
        const dx = bullet.x - enemy.x;
        const dz = bullet.z - enemy.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.24 && !enemyHit) {
          enemyHit = true;

          if (bullet.power >= enemy.power) {
            scoreGain += enemy.power;
          }
        }
      });

      if (!enemyHit) {
        newEnemies.push(enemy);
      }
    });

    bullets.forEach((bullet) => {
      const hit = enemies.some((enemy) => {
        const dx = bullet.x - enemy.x;
        const dz = bullet.z - enemy.z;
        return Math.sqrt(dx * dx + dz * dz) < 0.24;
      });

      if (!hit) {
        newBullets.push(bullet);
      }
    });

    setEnemies(newEnemies);
    setBullets(newBullets);

    // Gate Collision
    gates.current.forEach((g) => {
      if (Math.abs(g.z - PLAYER_Z) < 0.5) {
        if (playerX.current < 0) {
          applyGate(g.left);
        } else {
          applyGate(g.right);
        }

        g.passed = true;
      }
    });

    gates.current = gates.current.filter((g) => !g.passed);

    // Apply Gate Effect
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

        {gates.current.map((g, i) => (
          <React.Fragment key={i}>
            <Gate data={g} side="left" />
            <Gate data={g} side="right" />
          </React.Fragment>
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
