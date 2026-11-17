'use client';


import { useState } from 'react';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';


  const barThickness = 0.35;
  const barLength = 8;
  const barBevelRadius = 0.05;
  const boardColor = "#4f46e5";

  const offset = barLength / 3; // Splits the grid proportions evenly

  const cellPositions: [number, number][] = [
    [-offset,  offset], [0,  offset], [offset,  offset], // Top row
    [-offset,       0], [0,       0], [offset,       0], // Middle row
    [-offset, -offset], [0, -offset], [offset, -offset], // Bottom row
  ];


// Simple 3D 'X' shape component
function XShape() {
  const length = barLength/5;
  const thickness = barThickness;
  const depth = barThickness;
  const radius = 0.1; // Matches your board's bevel softness
  const color = "#ef4444";

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      {/* First diagonal bar */}
      <RoundedBox args={[length, thickness, depth]} radius={radius} smoothness={4}>
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
      </RoundedBox>
      
      {/* Second diagonal bar */}
      <RoundedBox args={[length, thickness, depth]} radius={radius} smoothness={4} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
      </RoundedBox>
    </group>
  );
}

// Simple 3D 'O' shape component
function OShape() {
  return (
    <mesh>
      <torusGeometry args={[barLength/12, barThickness/2, 16, 32]} />
      <meshStandardMaterial color="#3b82f6" roughness={0.3} />
    </mesh>
  );
}

function TicTacToeBoard() {
  // Board state: 9 slots initialized to null, tracking 'X' or 'O'
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);

  // Handle clicking a specific cell index (0 to 8)
  const handleCellClick = (index: number) => {
    if (board[index] !== null) return; // Cell already taken

    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    setIsXNext(!isXNext);
  };


  return (
    <group>
      {/* --- THE # GRID BARS --- */}
        {/* Vertical Bar 1 (Left) */}
    <RoundedBox args={[barThickness, barLength, 0.3]} radius={barBevelRadius} smoothness={4} position={[-barLength / 6, 0, 0]}>
      <meshStandardMaterial color={boardColor} roughness={0.2} metalness={0.5} />
    </RoundedBox>

    {/* Vertical Bar 2 (Right) */}
    <RoundedBox args={[barThickness, barLength, 0.3]} radius={barBevelRadius} smoothness={4} position={[barLength / 6, 0, 0]}>
      <meshStandardMaterial color={boardColor} roughness={0.2} metalness={0.5} />
    </RoundedBox>

    {/* Horizontal Bar 1 (Top) */}
    <RoundedBox args={[barLength, barThickness, 0.3]} radius={barBevelRadius} smoothness={4} position={[0, barLength / 6, 0]}>
      <meshStandardMaterial color={boardColor} roughness={0.2} metalness={0.5} />
    </RoundedBox>

    {/* Horizontal Bar 2 (Bottom) */}
    <RoundedBox args={[barLength, barThickness, 0.3]} radius={barBevelRadius} smoothness={4} position={[0, -barLength / 6, 0]}>
      <meshStandardMaterial color={boardColor} roughness={0.2} metalness={0.5} />
    </RoundedBox>

      {/* --- CLICKABLE SLOTS & GAME PIECES --- */}
      {cellPositions.map((pos, index) => (
        <group key={index} position={[pos[0], pos[1], 0]}>
          {/* Invisible or semi-transparent clickable slot */}
          <mesh 
            onClick={(e) => {
              e.stopPropagation(); // Prevents click bubbling
              handleCellClick(index);
            }}
          >
            <boxGeometry args={[barLength/6, barLength/6, 0.4]} />
            <meshBasicMaterial transparent opacity={0} /> {/* Set opacity to 0.2 if you want to see the hitboxes while testing */}
          </mesh>

          {/* Render X or O if the slot is claimed */}
          {board[index] === 'X' && <XShape />}
          {board[index] === 'O' && <OShape />}
        </group>
      ))}
    </group>
  );
}

export default function GameScene() {
  return (
    <div className="h-screen w-full bg-gray-950">
      <Canvas camera={{ position: [0, 0, 8] }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        
        <TicTacToeBoard />

        <OrbitControls />
      </Canvas>
    </div>
  );
}

/*

import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

function TicTacToeBoard() {
  const barThickness = 0.45;
  const barLength = 8;
  const color = "#4f46e5";

  return (
    <group>
      {/* Vertical Bar 1 (Left) }
      <mesh position={[-barLength/6, 0, 0]}>
        <boxGeometry args={[barThickness, barLength, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.5} />
      </mesh>

      {/* Vertical Bar 2 (Right) }
      <mesh position={[barLength/6, 0, 0]}>
        <boxGeometry args={[barThickness, barLength, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.5} />
      </mesh>

      {/* Horizontal Bar 1 (Top) }
      <mesh position={[0, barLength/6, 0]}>
        <boxGeometry args={[barLength, barThickness, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.5} />
      </mesh>

      {/* Horizontal Bar 2 (Bottom) }
      <mesh position={[0, -barLength/6, 0]}>
        <boxGeometry args={[barLength, barThickness, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.5} />
      </mesh>
    </group>
  );
}

export default function BeveledBoard() {
  return (
    <div className="h-screen w-full bg-gray-950">
      <Canvas camera={{ position: [0, 0, 8] }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        
        <TicTacToeBoard />

        <OrbitControls />
      </Canvas>
    </div>
  );
}
/*

/*
import { Text3D, OrbitControls, Center } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

export default function BeveledBoard() {
  return (
    <div className="h-screen w-full bg-gray-950">
      <Canvas camera={{ position: [0, 0, 8] }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        
        <Center>
          <Text3D
            font="https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/fonts/droid/droid_sans_mono_regular.typeface.json"
            size={3}
            height={0.6}
            curveSegments={12}
            bevelEnabled={true}
            bevelThickness={0.15}
            bevelSize={0.05}
            bevelSegments={5}
          >
            #
            <meshStandardMaterial color="#4f46e5" roughness={0.2} metalness={0.5} />
          </Text3D>
        </Center>

        <OrbitControls />
      </Canvas>
    </div>
  );
}
  */

/*


import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function Cube() {
  return (
    <mesh>
      {/* Box geometry defines the shape (width, height, depth) }
      <boxGeometry args={[1, 1, 1]} />
      
      {/* Standard material gives it color and reacts to light }
      <meshStandardMaterial color="royalBlue" />
    </mesh>
  );
}

export default function RotatingCube() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        {/* Render your cube }
        <Cube />

        <OrbitControls />
      </Canvas>
    </div>
  );
}
*/