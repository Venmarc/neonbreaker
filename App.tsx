import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, Difficulty } from './types';
import { Play, RotateCcw, Trophy, Settings, Home, Volume2, VolumeX, ArrowLeft, Heart } from 'lucide-react';
import { playSound, startMusic, stopMusic, setMusicVolume, setSfxVolume, getMusicVolume, getSfxVolume } from './utils/audio';
import { DIFFICULTY_SETTINGS } from './constants';
import { useGameScale } from './hooks/useGameScale';
import './App.css';

// Logical Resolution
const BASE_WIDTH = 800;
const BASE_HEIGHT = 800;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [gameKey, setGameKey] = useState(0); // Used to force remount for restart
  
  // Responsive Scale
  const scale = useGameScale(BASE_WIDTH, BASE_HEIGHT);

  // Audio State
  const [musicVol, setMusicVolState] = useState(0.3);
  const [sfxVol, setSfxVolState] = useState(0.5);

  useEffect(() => {
    const stored = localStorage.getItem('neonBreakerHighScore');
    if (stored) {
      setHighScore(parseInt(stored));
    }
    // Initialize Audio
    setMusicVolState(getMusicVolume());
    setSfxVolState(getSfxVolume());
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('neonBreakerHighScore', score.toString());
    }
  }, [score, highScore]);

  // Handle music toggle based on state
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      startMusic();
    } else if (gameState === GameState.MENU || gameState === GameState.SETTINGS) {
      // Keep music in menu/settings
      startMusic();
    }
  }, [gameState]);

  const startGame = () => {
    playSound('start');
    setScore(0);
    // Reset lives based on difficulty
    setLives(DIFFICULTY_SETTINGS[difficulty].lives);
    setGameState(GameState.PLAYING);
  };

  const restartGame = () => {
    setGameKey(prev => prev + 1); // Force remount
    setScore(0);
    // Reset lives based on difficulty
    setLives(DIFFICULTY_SETTINGS[difficulty].lives);
    setGameState(GameState.PLAYING);
    playSound('start');
  };

  const returnToMenu = () => {
    setGameState(GameState.MENU);
    setGameKey(prev => prev + 1); // Reset game state
  };

  const togglePause = () => {
    if (gameState === GameState.PLAYING) {
      setGameState(GameState.PAUSED);
    } else if (gameState === GameState.PAUSED) {
      setGameState(GameState.PLAYING);
    } else if (gameState === GameState.MENU) {
      setGameState(GameState.SETTINGS);
    } else if (gameState === GameState.SETTINGS) {
      setGameState(GameState.MENU);
    }
  };

  const handleMusicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMusicVolState(val);
    setMusicVolume(val);
  };

  const handleSfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSfxVolState(val);
    setSfxVolume(val);
  };

  const DifficultyButton = ({ level, current }: { level: Difficulty, current: Difficulty }) => (
    <button 
      onClick={() => setDifficulty(level)}
      className={`px-3 py-1 rounded-md font-bold text-xs transition-all ${
        current === level 
          ? 'bg-cyan-500 text-slate-900 shadow-[0_0_10px_rgba(6,182,212,0.5)]' 
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
      }`}
    >
      {level}
    </button>
  );

  const showHud = gameState === GameState.PLAYING || gameState === GameState.PAUSED;

  return (
    <div className="app-container">
      {/* 
        The game-stage is a fixed-size container that gets scaled up/down 
        via CSS transform to fit the window.
      */}
      <div 
        className="game-stage font-sans text-white selection:bg-pink-500 selection:text-white"
        style={{ transform: `scale(${scale})` }}
      >
      
        {/* Header Area */}
        <div className="w-full flex flex-col items-center relative h-[140px] justify-center">
          
          {/* Settings Button */}
          <button 
              onClick={togglePause}
              className="absolute left-0 top-2 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
              aria-label="Settings"
          >
              <Settings className="w-6 h-6" />
          </button>

          <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-600 mb-2 drop-shadow-lg font-[Orbitron]">
            NEON BREAKER
          </h1>
          
          {showHud && (
            <div className="w-full flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800 backdrop-blur-sm shadow-lg">
              <div className="flex flex-col ml-10 md:ml-0">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Score</span>
                <span className="text-2xl font-mono text-cyan-400 leading-none">{score.toString().padStart(5, '0')}</span>
              </div>
              
              <div className="flex flex-col items-center">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Status</span>
                 {gameState === GameState.PLAYING && (
                    <span className="text-green-400 text-xs font-bold flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      {difficulty}
                    </span>
                 )}
                 {gameState === GameState.PAUSED && <span className="text-yellow-500 text-xs font-bold animate-pulse">PAUSED</span>}
              </div>

              <div className="flex flex-col items-end">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lives</span>
                <div className="flex gap-1 mt-1">
                  {[...Array(4)].map((_, i) => (
                    <Heart 
                      key={i} 
                      className={`w-5 h-5 transition-all duration-300 ${
                        i < lives 
                          ? 'fill-pink-500 text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]' 
                          : 'fill-slate-800 text-slate-800 opacity-20'
                      }`} 
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Game Area */}
        <div className="relative w-[800px] h-[600px] shrink-0">
            <GameCanvas 
                key={gameKey}
                gameState={gameState} 
                setGameState={setGameState}
                score={score}
                setScore={setScore}
                lives={lives}
                setLives={setLives}
                difficulty={difficulty}
            />

            {/* Menu Overlay */}
            {gameState === GameState.MENU && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20">
                <div className="text-center p-8 border border-white/10 rounded-2xl bg-white/5 shadow-2xl backdrop-blur-md w-80">
                <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                <h2 className="text-3xl font-bold text-white mb-2 font-[Orbitron]">High Score</h2>
                <p className="text-4xl font-mono text-cyan-400 mb-6">{highScore}</p>
                
                <div className="flex flex-col gap-3 mb-8">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Select Difficulty</span>
                    <div className="flex gap-2 justify-center">
                    <DifficultyButton level={Difficulty.EASY} current={difficulty} />
                    <DifficultyButton level={Difficulty.MEDIUM} current={difficulty} />
                    <DifficultyButton level={Difficulty.HARD} current={difficulty} />
                    </div>
                </div>
                
                <button 
                    onClick={startGame}
                    className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] flex items-center justify-center gap-2"
                >
                    <Play className="w-5 h-5 fill-current" />
                    START GAME
                </button>
                </div>
            </div>
            )}

            {/* Settings / Pause Overlay */}
            {(gameState === GameState.PAUSED || gameState === GameState.SETTINGS) && (
                 <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center rounded-lg z-30">
                 <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-80">
                    <h2 className="text-2xl font-bold text-white mb-6 text-center font-[Orbitron] tracking-wider">
                      {gameState === GameState.PAUSED ? 'PAUSED' : 'SETTINGS'}
                    </h2>
                    
                    {/* Audio Controls */}
                    <div className="space-y-4 mb-8">
                        <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider">
                                <span>Music Volume</span>
                                <span>{Math.round(musicVol * 100)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {musicVol > 0 ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.05" 
                                    value={musicVol} 
                                    onChange={handleMusicChange}
                                    className="w-full accent-cyan-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider">
                                <span>SFX Volume</span>
                                <span>{Math.round(sfxVol * 100)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {sfxVol > 0 ? <Volume2 className="w-4 h-4 text-pink-400" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.05" 
                                    value={sfxVol} 
                                    onChange={handleSfxChange}
                                    className="w-full accent-pink-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button 
                            onClick={togglePause}
                            className="w-full py-3 bg-white hover:bg-slate-200 text-slate-900 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {gameState === GameState.PAUSED ? (
                                <>
                                    <Play className="w-4 h-4 fill-current" />
                                    RESUME
                                </>
                            ) : (
                                <>
                                    <ArrowLeft className="w-4 h-4" />
                                    BACK
                                </>
                            )}
                        </button>
                        
                        {gameState === GameState.PAUSED && (
                            <>
                                <button 
                                    onClick={restartGame}
                                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    RESTART
                                </button>
                                <button 
                                    onClick={returnToMenu}
                                    className="w-full py-3 border border-slate-600 hover:bg-slate-800 text-slate-400 hover:text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Home className="w-4 h-4" />
                                    MAIN MENU
                                </button>
                            </>
                        )}
                    </div>
                 </div>
                 </div>
            )}

            {/* Game Over Overlay */}
            {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 bg-red-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20">
                <h2 className="text-5xl font-black text-white mb-2 drop-shadow-md font-[Orbitron]">GAME OVER</h2>
                <p className="text-red-200 text-xl mb-8 font-mono">Final Score: {score}</p>
                <div className="flex gap-4">
                    <button 
                    onClick={returnToMenu}
                    className="px-6 py-3 bg-red-950/50 text-white border border-red-500/30 font-bold rounded-full hover:bg-red-900 transition-colors flex items-center gap-2"
                    >
                    <Home className="w-5 h-5" />
                    MENU
                    </button>
                    <button 
                    onClick={restartGame}
                    className="px-8 py-3 bg-white text-red-900 font-bold rounded-full hover:bg-red-50 transition-colors flex items-center gap-2 text-lg shadow-lg hover:shadow-xl hover:scale-105 transform duration-200"
                    >
                    <RotateCcw className="w-5 h-5" />
                    TRY AGAIN
                    </button>
                </div>
            </div>
            )}

            {/* Victory Overlay */}
            {gameState === GameState.VICTORY && (
            <div className="absolute inset-0 bg-green-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20">
                <h2 className="text-5xl font-black text-white mb-2 drop-shadow-md font-[Orbitron]">VICTORY!</h2>
                <p className="text-green-200 text-xl mb-8">All bricks cleared!</p>
                <div className="flex gap-4">
                    <button 
                    onClick={returnToMenu}
                    className="px-6 py-3 bg-green-950/50 text-white border border-green-500/30 font-bold rounded-full hover:bg-green-900 transition-colors flex items-center gap-2"
                    >
                    <Home className="w-5 h-5" />
                    MENU
                    </button>
                    <button 
                    onClick={restartGame}
                    className="px-8 py-3 bg-white text-green-900 font-bold rounded-full hover:bg-green-50 transition-colors flex items-center gap-2 text-lg shadow-lg hover:shadow-xl hover:scale-105 transform duration-200"
                    >
                    <RotateCcw className="w-5 h-5" />
                    PLAY AGAIN
                    </button>
                </div>
            </div>
            )}
        </div>

        {/* Footer Area */}
        <div className="flex-none mt-2 text-slate-500 text-xs text-center pb-2 h-[50px]">
          <p>Tip: Hold <span className="text-cyan-400 font-bold">DOWN</span> while ball is stuck to aim!</p>
          <p className="text-[10px] mt-1 opacity-50">Collect the <Heart className="w-3 h-3 inline text-pink-500 fill-current"/> power-up for extra life!</p>
        </div>
      </div>
    </div>
  );
};

export default App;