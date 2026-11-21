'use client';

import { useState, useRef, useMemo } from 'react';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ==========================================
// AUDIO SYNTHESIZER (Web Audio API)
// ==========================================
class SoundFX {
  private static ctx: AudioContext | null = null;

  private static getContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  static playClick(isX: boolean) {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isX ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isX ? 440 : 330, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isX ? 220 : 165, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  static playSubWin() {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08);

      gain.gain.setValueAtTime(0.15, ctx.currentTime + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + index * 0.08);
      osc.stop(ctx.currentTime + index * 0.08 + 0.25);
    });
  }

  static playMacroWin() {
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.12);

      gain.gain.setValueAtTime(0.25, ctx.currentTime + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + index * 0.12);
      osc.stop(ctx.currentTime + index * 0.12 + 0.4);
    });
  }
}

// ==========================================
// CONFIGURATION & DESIGN CONSTANTS
// ==========================================
const BOARD_SIZE = 12;
const BOARD_DEPTH = 0.4;
const BEVEL_RADIUS = 0.05;
const BOARD_COLOR = "#4f46e5";
const SUB_BOARD_COLOR = "#6366f1";

const MACRO_SLOT_SIZE = BOARD_SIZE / 3;
const MICRO_BOARD_SIZE = MACRO_SLOT_SIZE * 0.85;
const MICRO_SLOT_SIZE = MICRO_BOARD_SIZE / 3;

function getGridOffsets(size: number): [number, number][] {
  const offset = size / 3;
  return [
    [-offset,  offset], [0,  offset], [offset,  offset],
    [-offset,       0], [0,       0], [offset,       0],
    [-offset, -offset], [0, -offset], [offset, -offset],
  ];
}

const macroOffsets = getGridOffsets(BOARD_SIZE);
const microOffsets = getGridOffsets(MICRO_BOARD_SIZE);

// ==========================================
// PARTICLE EXPLOSION EFFECT COMPONENT
// ==========================================
interface ParticleExplosionProps {
  position: [number, number, number];
  color: string;
  count?: number;
  onComplete?: () => void;
}

function ParticleExplosion({ position, color, count = 60, onComplete }: ParticleExplosionProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const speed = 3 + Math.random() * 5;

      vel[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
      vel[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
      vel[i * 3 + 2] = speed * Math.cos(phi);
    }
    return [pos, vel];
  }, [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    timeRef.current += delta;
    
    const geom = pointsRef.current.geometry;
    const posAttr = geom.attributes.position;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      arr[i * 3] += velocities[i * 3] * delta;
      arr[i * 3 + 1] += (velocities[i * 3 + 1] * delta) - (4 * delta);
      arr[i * 3 + 2] += velocities[i * 3 + 2] * delta;
    }
    posAttr.needsUpdate = true;

    if (timeRef.current > 1.2 && onComplete) {
      onComplete();
    }
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.25} 
        color={color} 
        transparent 
        opacity={0.9} 
        blending={THREE.AdditiveBlending} 
      />
    </points>
  );
}

// ==========================================
// GAME PIECES
// ==========================================
function XShape({ size }: { size: number }) {
  const length = size * 0.6;
  const thickness = size * 0.12;
  const depth = thickness * 0.8;
  const radius = thickness * 0.25;

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <RoundedBox args={[length, thickness, depth]} radius={radius} smoothness={4}>
        <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.4} />
      </RoundedBox>
      <RoundedBox args={[length, thickness, depth]} radius={radius} smoothness={4} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.4} />
      </RoundedBox>
    </group>
  );
}

function OShape({ size }: { size: number }) {
  const radiusOuter = size * 0.3;
  const radiusTube = size * 0.06;

  return (
    <mesh>
      <torusGeometry args={[radiusOuter, radiusTube, 16, 32]} />
      <meshStandardMaterial color="#3b82f6" roughness={0.3} />
    </mesh>
  );
}

// ==========================================
// GRID RENDERER COMPONENT
// ==========================================
interface GridLinesProps {
  size: number;
  thickness: number;
  color: string;
  depth?: number;
}

function GridLines({ size, thickness, color, depth = 0.3 }: GridLinesProps) {
  const third = size / 3;

  return (
    <group>
      <RoundedBox args={[thickness, size, depth]} radius={BEVEL_RADIUS} smoothness={4} position={[-third / 2, 0, 0]}>
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.5} />
      </RoundedBox>
      <RoundedBox args={[thickness, size, depth]} radius={BEVEL_RADIUS} smoothness={4} position={[third / 2, 0, 0]}>
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.5} />
      </RoundedBox>
      <RoundedBox args={[size, thickness, depth]} radius={BEVEL_RADIUS} smoothness={4} position={[0, third / 2, 0]}>
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.5} />
      </RoundedBox>
      <RoundedBox args={[size, thickness, depth]} radius={BEVEL_RADIUS} smoothness={4} position={[0, -third / 2, 0]}>
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.5} />
      </RoundedBox>
    </group>
  );
}

// ==========================================
// GLOWING WINNING LINE COMPONENT
// ==========================================
interface WinningLineProps {
  winningCombo: [number, number, number];
  winner: string;
}

function WinningLine({ winningCombo, winner }: WinningLineProps) {
  const [a, , c] = winningCombo;
  const posA = macroOffsets[a];
  const posC = macroOffsets[c];

  let posX = (posA[0] + posC[0]) / 2;
  let posY = (posA[1] + posC[1]) / 2;
  let rotationZ = 0;
  let length = BOARD_SIZE * 0.95;
  const thickness = BOARD_SIZE * 0.035;
  const depth = BOARD_DEPTH * 1.2;

  if (a === 0 && c === 2) { rotationZ = 0; } 
  else if (a === 3 && c === 5) { rotationZ = 0; } 
  else if (a === 6 && c === 8) { rotationZ = 0; }
  else if (a === 0 && c === 6) { rotationZ = Math.PI / 2; } 
  else if (a === 1 && c === 7) { rotationZ = Math.PI / 2; } 
  else if (a === 2 && c === 8) { rotationZ = Math.PI / 2; }
  else if (a === 0 && c === 8) { rotationZ = -Math.PI / 4; length = BOARD_SIZE * 1.35; } 
  else if (a === 2 && c === 6) { rotationZ = Math.PI / 4; length = BOARD_SIZE * 1.35; }

  const color = winner === 'X' ? '#ef4444' : '#3b82f6';

  return (
    <group position={[posX, posY, 0.1]}>
      <RoundedBox args={[length, thickness, depth]} rotation={[0, 0, rotationZ]} radius={BEVEL_RADIUS} smoothness={4}>
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={0.8} 
          roughness={0.1} 
          metalness={0.8} 
        />
      </RoundedBox>
    </group>
  );
}

// ==========================================
// SUB-BOARD COMPONENT
// ==========================================
interface SubBoardProps {
  boardState: (string | null)[];
  onCellClick: (localIndex: number) => void;
  isActive: boolean;
  wonBy: string | null;
}

function SubBoard({ boardState, onCellClick, isActive, wonBy }: SubBoardProps) {
  const barThickness = MICRO_BOARD_SIZE * 0.035;

  return (
    <group>
      <GridLines 
        size={MICRO_BOARD_SIZE} 
        thickness={barThickness} 
        color={isActive ? SUB_BOARD_COLOR : "#334155"} 
        depth={0.2} 
      />

      {wonBy === 'X' && <XShape size={MICRO_BOARD_SIZE * 0.7} />}
      {wonBy === 'O' && <OShape size={MICRO_BOARD_SIZE * 0.7} />}

      {!wonBy && microOffsets.map((pos, localIndex) => (
        <group key={localIndex} position={[pos[0], pos[1], 0]}>
          <mesh 
            onClick={(e) => {
              e.stopPropagation();
              onCellClick(localIndex);
            }}
          >
            <boxGeometry args={[MICRO_SLOT_SIZE * 0.85, MICRO_SLOT_SIZE * 0.85, 0.3]} />
            <meshBasicMaterial transparent opacity={0.0} />
          </mesh>

          {boardState[localIndex] === 'X' && <XShape size={MICRO_SLOT_SIZE * 0.7} />}
          {boardState[localIndex] === 'O' && <OShape size={MICRO_SLOT_SIZE * 0.7} />}
        </group>
      ))}
    </group>
  );
}

// ==========================================
// FLUID PIVOT RIG (Smooth Target Shifting Only)
// ==========================================
interface CameraRigProps {
  activeSubBoard: number | null;
  macroBoard: (string | null)[];
  gameWon: boolean;
  controlsRef: React.RefObject<any>;
}

function CameraRig({ activeSubBoard, macroBoard, gameWon, controlsRef }: CameraRigProps) {
  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    const targetPos = new THREE.Vector3(0, 0, 0);

    // Only focus on a sub-board if the game is NOT won and a restriction exists
    if (!gameWon && activeSubBoard !== null && macroBoard[activeSubBoard] === null) {
      const [x, y] = macroOffsets[activeSubBoard];
      targetPos.set(x, y, 0);
    }

    // Smoothly interpolate pivot target back to center (0,0,0) or active sub-board
    controlsRef.current.target.lerp(targetPos, delta * 4);
    controlsRef.current.update();
  });

  return null;
}

// ==========================================
// ULTIMATE TIC TAC TOE MAIN BOARD
// ==========================================
interface UltimateBoardProps {
  onGameWin: (winner: string) => void;
  onTurnChange: (isX: boolean) => void;
  onStatusChange: (status: string) => void;
  activeSubBoard: number | null;
  setActiveSubBoard: (val: number | null) => void;
  macroBoard: (string | null)[];
  setMacroBoard: React.Dispatch<React.SetStateAction<(string | null)[]>>;
  controlsRef: React.RefObject<any>;
}

function UltimateTicTacToeBoard({ 
  onGameWin, 
  onTurnChange, 
  onStatusChange, 
  activeSubBoard, 
  setActiveSubBoard, 
  macroBoard, 
  setMacroBoard,
  controlsRef 
}: UltimateBoardProps) {
  const [subBoards, setSubBoards] = useState<(string | null)[][]>(
    Array(9).fill(null).map(() => Array(9).fill(null))
  );
  
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [gameWinnerData, setGameWinnerData] = useState<{ winner: string; combo: [number, number, number] } | null>(null);
  const [explosions, setExplosions] = useState<{ id: number; position: [number, number, number]; color: string }[]>([]);

  const triggerExplosion = (pos: [number, number, number], color: string) => {
    const id = Date.now() + Math.random();
    setExplosions(prev => [...prev, { id, position: pos, color }]);
  };

  const getWinningDetails = (board: (string | null)[]) => {
    const lines: [number, number, number][] = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const combo of lines) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a] as string, combo };
      }
    }
    return null;
  };

  const handleCellClick = (macroIndex: number, localIndex: number) => {
    if (gameWinnerData) return;
    if (activeSubBoard !== null && activeSubBoard !== macroIndex && macroBoard[activeSubBoard] === null) {
      return;
    }
    if (macroBoard[macroIndex] !== null) return;
    if (subBoards[macroIndex][localIndex] !== null) return;

    const currentPlayer = isXNext ? 'X' : 'O';
    SoundFX.playClick(isXNext);

    const newSubBoards = subBoards.map((sb, sIdx) => {
      if (sIdx !== macroIndex) return sb;
      const newSb = [...sb];
      newSb[localIndex] = currentPlayer;
      return newSb;
    });

    const newMacroBoard = [...macroBoard];
    const localWinResult = getWinningDetails(newSubBoards[macroIndex]);
    
    if (localWinResult && !newMacroBoard[macroIndex]) {
      newMacroBoard[macroIndex] = localWinResult.winner;
      SoundFX.playSubWin();
      const [mx, my] = macroOffsets[macroIndex];
      triggerExplosion([mx, my, 0.2], localWinResult.winner === 'X' ? '#ef4444' : '#3b82f6');
    }

    const overallWinResult = getWinningDetails(newMacroBoard);
    if (overallWinResult) {
      setGameWinnerData(overallWinResult);
      onGameWin(overallWinResult.winner);
      onStatusChange(`Player ${overallWinResult.winner} Wins the Ultimate Game! 🎉`);
      SoundFX.playMacroWin();
      triggerExplosion([0, 0, 0.5], overallWinResult.winner === 'X' ? '#ef4444' : '#3b82f6');
    }

    const nextIsX = !isXNext;
    setSubBoards(newSubBoards);
    setMacroBoard(newMacroBoard);
    setIsXNext(nextIsX);
    onTurnChange(nextIsX);

    const nextTargetBoard = localIndex;
    if (newMacroBoard[nextTargetBoard] !== null || newSubBoards[nextTargetBoard].every(cell => cell !== null)) {
      setActiveSubBoard(null);
      if (!overallWinResult) onStatusChange("Play in any available sub-board");
    } else {
      setActiveSubBoard(nextTargetBoard);
      if (!overallWinResult) onStatusChange(`Must play in Sub-Board #${nextTargetBoard + 1}`);
    }
  };

  const macroBarThickness = BOARD_SIZE * 0.025;

  return (
    <group>
      <CameraRig 
        activeSubBoard={activeSubBoard} 
        macroBoard={macroBoard} 
        gameWon={gameWinnerData !== null} 
        controlsRef={controlsRef} 
      />

      <GridLines 
        size={BOARD_SIZE} 
        thickness={macroBarThickness} 
        color={BOARD_COLOR} 
        depth={BOARD_DEPTH} 
      />

      {macroOffsets.map((pos, macroIndex) => {
        const isSubBoardActive = 
          !gameWinnerData && (
            activeSubBoard === null || 
            activeSubBoard === macroIndex || 
            macroBoard[activeSubBoard] !== null
          );

        return (
          <group key={macroIndex} position={[pos[0], pos[1], 0]}>
            <SubBoard 
              boardState={subBoards[macroIndex]}
              onCellClick={(localIndex) => handleCellClick(macroIndex, localIndex)}
              isActive={isSubBoardActive && macroBoard[macroIndex] === null}
              wonBy={macroBoard[macroIndex]}
            />
          </group>
        );
      })}

      {gameWinnerData && (
        <WinningLine winningCombo={gameWinnerData.combo} winner={gameWinnerData.winner} />
      )}

      {explosions.map(exp => (
        <ParticleExplosion 
          key={exp.id} 
          position={exp.position} 
          color={exp.color} 
          onComplete={() => {
            setExplosions(prev => prev.filter(e => e.id !== exp.id));
          }}
        />
      ))}
    </group>
  );
}

// ==========================================
// SCENE CONTAINER WITH TAILWIND HUD OVERLAY
// ==========================================
export default function GameScene() {
  const [xScore, setXScore] = useState(0);
  const [oScore, setOScore] = useState(0);
  const [isXTurn, setIsXTurn] = useState(true);
  const [gameStatus, setGameStatus] = useState("Player X's Turn - Play anywhere");
  const [boardKey, setBoardKey] = useState(0);
  
  const [activeSubBoard, setActiveSubBoard] = useState<number | null>(null);
  const [macroBoard, setMacroBoard] = useState<(string | null)[]>(Array(9).fill(null));
  
  const controlsRef = useRef<any>(null);

  const handleGameWin = (winner: string) => {
    if (winner === 'X') setXScore(prev => prev + 1);
    if (winner === 'O') setOScore(prev => prev + 1);
  };

  const handleResetBoard = () => {
    setBoardKey(prev => prev + 1);
    setIsXTurn(true);
    setActiveSubBoard(null);
    setMacroBoard(Array(9).fill(null));
    setGameStatus("Player X's Turn - Play anywhere");
  };

  const handleResetScores = () => {
    setXScore(0);
    setOScore(0);
    handleResetBoard();
  };

  return (
    <div className="relative h-screen w-full bg-gray-950 overflow-hidden">
      {/* --- FLOATING HTML HUD OVERLAY --- */}
      <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-center p-4 pointer-events-none">
        <h1 className="text-2xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 drop-shadow">
          ULTIMATE 3D TIC TAC TOE
        </h1>

        <div className="mt-3 flex items-center gap-6 bg-gray-900/80 backdrop-blur-md border border-gray-800 px-6 py-2.5 rounded-2xl shadow-xl pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-gray-300 text-sm font-medium">Player X:</span>
            <span className="text-white font-bold text-lg">{xScore}</span>
          </div>

          <div className="h-4 w-[1px] bg-gray-700"></div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-gray-300 text-sm font-medium">Player O:</span>
            <span className="text-white font-bold text-lg">{oScore}</span>
          </div>
        </div>

        <div className="mt-2 px-4 py-1 rounded-full bg-gray-800/60 border border-gray-700/50 backdrop-blur-sm text-xs font-medium text-gray-300 tracking-wide shadow">
          {gameStatus}
        </div>
      </div>

      {/* --- FLOATING CONTROL BUTTONS --- */}
      <div className="absolute bottom-6 right-6 z-10 flex gap-3 pointer-events-auto">
        <button 
          onClick={handleResetBoard}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg transition-all duration-200 active:scale-95"
        >
          New Board
        </button>
        <button 
          onClick={handleResetScores}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold text-sm rounded-xl border border-gray-700 shadow-lg transition-all duration-200 active:scale-95"
        >
          Reset Scores
        </button>
      </div>

      {/* --- 3D CANVAS SCENE --- */}
      <Canvas camera={{ position: [0, 0, BOARD_SIZE * 1.5] }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        
        <UltimateTicTacToeBoard 
          key={boardKey}
          onGameWin={handleGameWin}
          onTurnChange={(isX) => setIsXTurn(isX)}
          onStatusChange={setGameStatus}
          activeSubBoard={activeSubBoard}
          setActiveSubBoard={setActiveSubBoard}
          macroBoard={macroBoard}
          setMacroBoard={setMacroBoard}
          controlsRef={controlsRef}
        />

        <OrbitControls ref={controlsRef} enableRotate={true} />
      </Canvas>
    </div>
  );
}

/* 'use client';


import { useState } from 'react';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';

// Main factor that controls proportions
  const barLength = 8;

  const barThickness = 0.35;
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
      {/* First diagonal bar END_COMMENT_HERE}
      <RoundedBox args={[length, thickness, depth]} radius={radius} smoothness={4}>
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
      </RoundedBox>
      
      {/* Second diagonal bar END_COMMENT_HERE}
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
      {/* --- THE # GRID BARS --- END_COMMENT_HERE}
        {/* Vertical Bar 1 (Left) END_COMMENT_HERE}
    <RoundedBox args={[barThickness, barLength, 0.3]} radius={barBevelRadius} smoothness={4} position={[-barLength / 6, 0, 0]}>
      <meshStandardMaterial color={boardColor} roughness={0.2} metalness={0.5} />
    </RoundedBox>

    {/* Vertical Bar 2 (Right) END_COMMENT_HERE}
    <RoundedBox args={[barThickness, barLength, 0.3]} radius={barBevelRadius} smoothness={4} position={[barLength / 6, 0, 0]}>
      <meshStandardMaterial color={boardColor} roughness={0.2} metalness={0.5} />
    </RoundedBox>

    {/* Horizontal Bar 1 (Top) END_COMMENT_HERE}
    <RoundedBox args={[barLength, barThickness, 0.3]} radius={barBevelRadius} smoothness={4} position={[0, barLength / 6, 0]}>
      <meshStandardMaterial color={boardColor} roughness={0.2} metalness={0.5} />
    </RoundedBox>

    {/* Horizontal Bar 2 (Bottom) END_COMMENT_HERE}
    <RoundedBox args={[barLength, barThickness, 0.3]} radius={barBevelRadius} smoothness={4} position={[0, -barLength / 6, 0]}>
      <meshStandardMaterial color={boardColor} roughness={0.2} metalness={0.5} />
    </RoundedBox>

      {/* --- CLICKABLE SLOTS & GAME PIECES --- END_COMMENT_HERE}
      {cellPositions.map((pos, index) => (
        <group key={index} position={[pos[0], pos[1], 0]}>
          {/* Invisible or semi-transparent clickable slot END_COMMENT_HERE}
          <mesh 
            onClick={(e) => {
              e.stopPropagation(); // Prevents click bubbling
              handleCellClick(index);
            }}
          >
            <boxGeometry args={[barLength/6, barLength/6, 0.4]} />
            <meshBasicMaterial transparent opacity={0.2} /> {/* Set opacity to 0.2 if you want to see the hitboxes while testing END_COMMENT_HERE}
          </mesh>

          {/* Render X or O if the slot is claimed END_COMMENT_HERE}
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
 END_COMMENT_HERE
 */