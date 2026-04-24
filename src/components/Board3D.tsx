import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, RoundedBox, Float } from '@react-three/drei';
import * as THREE from 'three';

const COLORS = {
  red: '#ff4b4b',
  green: '#4ade80',
  yellow: '#fbbf24',
  blue: '#3b82f6',
  white: '#f8fafc',
  board: '#e2e8f0',
};

function HomeBase({ position, color, rotation }: any) {
  return (
    <group position={position} rotation={rotation}>
      {/* Base Area */}
      <RoundedBox args={[4, 0.2, 4]} radius={0.1} position={[0, 0.1, 0]}>
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
      </RoundedBox>
      {/* White inner square */}
      <RoundedBox args={[2.5, 0.22, 2.5]} radius={0.05} position={[0, 0.1, 0]}>
        <meshStandardMaterial color={COLORS.white} roughness={0.1} />
      </RoundedBox>
      {/* 4 inner pawn slots */}
      <mesh position={[-0.6, 0.23, -0.6]}><cylinderGeometry args={[0.3, 0.3, 0.05, 32]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0.6, 0.23, -0.6]}><cylinderGeometry args={[0.3, 0.3, 0.05, 32]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[-0.6, 0.23, 0.6]}><cylinderGeometry args={[0.3, 0.3, 0.05, 32]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0.6, 0.23, 0.6]}><cylinderGeometry args={[0.3, 0.3, 0.05, 32]} /><meshStandardMaterial color={color} /></mesh>
    </group>
  );
}

function PathTiles() {
  return (
    <group position={[0, 0.1, 0]}>
      {/* A simplified cross to represent paths */}
      <RoundedBox args={[12, 0.15, 3]} radius={0.05}>
        <meshStandardMaterial color={COLORS.white} />
      </RoundedBox>
      <RoundedBox args={[3, 0.15, 12]} radius={0.05}>
        <meshStandardMaterial color={COLORS.white} />
      </RoundedBox>
    </group>
  );
}

function Pawn({ position, color }: any) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 0.6, 32]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.1} />
      </mesh>
    </group>
  );
}

function AnimatedDice() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.2;
      meshRef.current.rotation.y += 0.01;
    }
  });

  return (
    <Float floatIntensity={2} rotationIntensity={1}>
      <mesh ref={meshRef} position={[0, 2, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.2} />
        {/* Simple dots using tiny spheres for a cool 3D effect */}
        <mesh position={[0, 0, 0.51]}><circleGeometry args={[0.1, 32]} /><meshBasicMaterial color="#000" /></mesh>
      </mesh>
    </Float>
  );
}

export function Board3D() {
  return (
    <Canvas camera={{ position: [0, 8, 10], fov: 45 }} shadows>
      <color attach="background" args={['#0a0a0a']} />
      
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 15, 10]} 
        intensity={1} 
        castShadow 
        shadow-mapSize={[1024, 1024]}
      />
      <spotLight position={[-10, 10, -10]} intensity={0.5} angle={0.3} penumbra={1} />

      <group position={[0, -0.5, 0]}>
        {/* Main Board Base */}
        <RoundedBox args={[13, 0.1, 13]} radius={0.2} receiveShadow>
          <meshStandardMaterial color={COLORS.board} roughness={0.8} />
        </RoundedBox>

        {/* 4 Bases */}
        <HomeBase position={[-4.5, 0, -4.5]} color={COLORS.red} />
        <HomeBase position={[4.5, 0, -4.5]} color={COLORS.green} />
        <HomeBase position={[-4.5, 0, 4.5]} color={COLORS.blue} />
        <HomeBase position={[4.5, 0, 4.5]} color={COLORS.yellow} />

        <PathTiles />

        {/* Example Pawns */}
        <Pawn position={[-4.5, 0.2, -4.5]} color={COLORS.red} />
        <Pawn position={[-5.1, 0.2, -3.9]} color={COLORS.red} />
        <Pawn position={[4.5, 0.2, -4.5]} color={COLORS.green} />
        <Pawn position={[-4.5, 0.2, 4.5]} color={COLORS.blue} />
        
        {/* Center */}
        <RoundedBox args={[3, 0.16, 3]} radius={0.01} position={[0, 0.1, 0]}>
          <meshStandardMaterial color="#000" />
        </RoundedBox>
      </group>

      <AnimatedDice />

      <ContactShadows position={[0, -0.49, 0]} opacity={0.4} scale={20} blur={2} far={4.5} />
      
      <OrbitControls 
        makeDefault 
        minPolarAngle={Math.PI / 4} 
        maxPolarAngle={Math.PI / 2.5} 
        minDistance={8} 
        maxDistance={20} 
        enablePan={false}
      />
      
      {/* Studio lighting environment */}
      <Environment preset="city" />
    </Canvas>
  );
}
