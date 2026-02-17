import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, Difficulty, CampaignMode } from './types';
import { Play, RotateCcw, Trophy, Settings, Home, Volume2, VolumeX, ArrowLeft, Heart, Zap, HelpCircle, X, ChevronsRight, Infinity, Layers } from 'lucide-react';
import { playSound, startMusic, stopMusic, setMusicVolume, setSfxVolume, getMusicVolume, getSfxVolume } from './utils/audio';
import { DIFFICULTY_SETTINGS } from './constants';
import { ARCADE_LEVELS, ENDLESS_STAGES } from './data/levels';
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
  const [multiplier, setMultiplier] = useState(1);
  const [showHelp, setShowHelp] = useState(false);
  const [countdown, setCountdown] = useState(3);
  
  // Campaign State
  const [campaignMode, setCampaignMode] = useState<CampaignMode>(CampaignMode.ARCADE);
  const [levelIndex, setLevelIndex] = useState(0); // 0-based index for array access
  const [difficultyMultiplier, setDifficultyMultiplier] = useState(1.0); // Increases in Endless

  // Responsive Scale
  const scale = useGameScale(BASE_WIDTH, BASE_HEIGHT);

  // Audio State
  const [musicVol, setMusicVolState] = useState(0.3);
  const [sfxVol, setSfxVolState] = useState(0.5);
  
  // Store previous volume for unmuting
  const prevMusicVol = useRef(0.3);
  const prevSfxVol = useRef(0.5);

  useEffect(() => {
    const stored = localStorage.getItem('neonBreakerHighScore');
    if (stored) {
      setHighScore(parseInt(stored));
    }
    // Initialize Audio
    const initMusicVol = getMusicVolume();
    const initSfxVol = getSfxVolume();
    setMusicVolState(initMusicVol);
    setSfxVolState(initSfxVol);
    
    if (initMusicVol > 0) prevMusicVol.current = initMusicVol;
    if (initSfxVol > 0) prevSfxVol.current = initSfxVol;
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

  // Auto-Pause on Focus Loss
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && (gameState === GameState.PLAYING || gameState === GameState.RESUMING)) {
        setGameState(GameState.PAUSED);
        setShowHelp(false);
      }
    };

    const handleBlur = () => {
      if (gameState === GameState.PLAYING || gameState === GameState.RESUMING) {
        setGameState(GameState.PAUSED);
        setShowHelp(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameState]);

  // Resume Countdown Logic
  useEffect(() => {
    if (gameState === GameState.RESUMING) {
      setCountdown(3);
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setGameState(GameState.PLAYING);
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState]);

  const startArcade = () => {
    setCampaignMode(CampaignMode.ARCADE);
    setLevelIndex(0);
    setDifficultyMultiplier(1.0);
    initializeGame();
  };

  const startEndless = () => {
    setCampaignMode(CampaignMode.ENDLESS);
    setLevelIndex(0);
    setDifficultyMultiplier(1.0);
    initializeGame();
  };

  const initializeGame = () => {
    playSound('start');
    setScore(0);
    setMultiplier(1);
    // Reset lives based on difficulty
    setLives(DIFFICULTY_SETTINGS[difficulty].lives);
    setGameState(GameState.PLAYING);
    setGameKey(prev => prev + 1);
  };

  const restartGame = () => {
    // Restart current mode
    initializeGame();
  };

  const handleLevelComplete = () => {
    playSound('victory');
    setGameState(GameState.LEVEL_TRANSITION);
    
    // Transition delay
    setTimeout(() => {
      if (campaignMode === CampaignMode.ARCADE) {
          const nextIndex = levelIndex + 1;
          if (nextIndex < ARCADE_LEVELS.length) {
              setLevelIndex(nextIndex);
              setGameState(GameState.PLAYING);
          } else {
              setGameState(GameState.VICTORY); // Game Beaten
          }
      } else {
          // Endless Mode Logic
          const nextIndex = levelIndex + 1;
          if (nextIndex < ENDLESS_STAGES.length) {
              setLevelIndex(nextIndex);
          } else {
              // Loop back to start, increase difficulty
              setLevelIndex(0);
              setDifficultyMultiplier(prev => prev + 0.1);
          }
          setGameState(GameState.PLAYING);
      }
    }, 2000); // 2 seconds banner
  };

  const returnToMenu = () => {
    setGameState(GameState.MENU);
    setGameKey(prev => prev + 1); // Reset game state
  };

  const togglePause = () => {
    if (gameState === GameState.PLAYING || gameState === GameState.RESUMING) {
      setGameState(GameState.PAUSED);
      setShowHelp(false); // Reset help state
    } else if (gameState === GameState.PAUSED) {
      setGameState(GameState.RESUMING);
    } else if (gameState === GameState.MENU) {
      setGameState(GameState.SETTINGS);
      setShowHelp(false);
    } else if (gameState === GameState.SETTINGS) {
      setGameState(GameState.MENU);
    }
  };

  const handleMusicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMusicVolState(val);
    setMusicVolume(val);
    if (val > 0) prevMusicVol.current = val;
  };

  const handleSfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSfxVolState(val);
    setSfxVolume(val);
    if (val > 0) prevSfxVol.current = val;
  };
  
  const toggleMusicMute = () => {
    if (musicVol > 0) {
      setMusicVolState(0);
      setMusicVolume(0);
    } else {
      const restore = prevMusicVol.current > 0 ? prevMusicVol.current : 0.3;
      setMusicVolState(restore);
      setMusicVolume(restore);
    }
  };

  const toggleSfxMute = () => {
    if (sfxVol > 0) {
      setSfxVolState(0);
      setSfxVolume(0);
    } else {
      const restore = prevSfxVol.current > 0 ? prevSfxVol.current : 0.5;
      setSfxVolState(restore);
      setSfxVolume(restore);
    }
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

  const PowerUpInfo = ({ color, name, desc }: { color: string, name: string, desc: string }) => (
    <div className="flex items-start gap-3 bg-slate-800/50 p-2 rounded-lg">
      <div className="w-4 h-4 rounded-full mt-0.5 shrink-0 shadow-[0_0_8px]" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}></div>
      <div>
        <div className="text-xs font-bold text-white leading-none mb-1">{name}</div>
        <div className="text-[10px] text-slate-400 leading-tight">{desc}</div>
      </div>
    </div>
  );

  const showHud = gameState === GameState.PLAYING || gameState === GameState.PAUSED || gameState === GameState.RESUMING || gameState === GameState.LEVEL_TRANSITION;
  const isHotStreak = multiplier >= 3.0;
  
  // Get formatted level display
  const getLevelDisplay = () => {
    if (campaignMode === CampaignMode.ARCADE) {
        return `LEVEL ${levelIndex + 1}`;
    } else {
        const loop = Math.floor(difficultyMultiplier); 
        return `STAGE ${levelIndex + 1}`;
    }
  };

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
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-mono text-cyan-400 leading-none">{score.toString().padStart(5, '0')}</span>
                  {multiplier > 1 && (
                    <span className={`text-sm font-bold flex items-center ${isHotStreak ? 'text-yellow-400 animate-pulse' : 'text-slate-300'}`}>
                      <Zap className={`w-3 h-3 mr-0.5 ${isHotStreak ? 'fill-yellow-400' : ''}`} />
                      x{multiplier.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-center">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Status</span>
                 {(gameState === GameState.PLAYING || gameState === GameState.RESUMING || gameState === GameState.LEVEL_TRANSITION) && (
                    <div className="flex flex-col items-center">
                        <span className="text-green-400 text-xs font-bold flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full bg-green-500 ${gameState === GameState.RESUMING ? 'animate-ping' : 'animate-pulse'}`}></span>
                        {getLevelDisplay()}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">
                            {campaignMode} - {difficulty}
                            {difficultyMultiplier > 1 && <span className="text-red-400 ml-1">+{Math.round((difficultyMultiplier - 1) * 100)}%</span>}
                        </span>
                    </div>
                 )}
                 {gameState === GameState.PAUSED && <span className="text-yellow-500 text-xs font-bold animate-pulse">PAUSED</span>}
              </div>

              <div className="flex flex-col items-end">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Lives</span>
                <div className="flex gap-1 mt-1">
                  {[...Array(Math.max(0, lives))].map((_, i) => (
                    <Heart 
                      key={i} 
                      className="w-5 h-5 fill-pink-500 text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)] animate-pulse" 
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
                setMultiplier={setMultiplier}
                levelIndex={levelIndex}
                campaignMode={campaignMode}
                difficultyMultiplier={difficultyMultiplier}
                onLevelComplete={handleLevelComplete}
            />

            {/* Resume Countdown Overlay */}
            {gameState === GameState.RESUMING && (
              <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                <div className="text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(34,211,238,0.8)] animate-pulse font-[Orbitron]">
                  {countdown}
                </div>
              </div>
            )}

            {/* Level Transition Overlay */}
            {gameState === GameState.LEVEL_TRANSITION && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-40 transition-all duration-500">
                <div className="flex flex-col items-center animate-in slide-in-from-right duration-700 fade-in">
                   <div className="flex items-center gap-4 text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]">
                       <ChevronsRight className="w-12 h-12" />
                       <h2 className="text-6xl font-black font-[Orbitron] italic tracking-tighter">
                          CLEARED
                       </h2>
                       <ChevronsRight className="w-12 h-12" />
                   </div>
                   <p className="text-slate-300 mt-4 font-mono text-lg animate-pulse">NEXT WAVE INCOMING...</p>
                </div>
              </div>
            )}

            {/* Menu Overlay */}
            {gameState === GameState.MENU && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg z-20">
                <div className="text-center p-8 border border-white/10 rounded-2xl bg-white/5 shadow-2xl backdrop-blur-md w-96">
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
                
                <div className="space-y-4">
                    <button 
                        onClick={startArcade}
                        className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-lg transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] flex items-center justify-center gap-3"
                    >
                        <Layers className="w-6 h-6 fill-current" />
                        <div className="text-left">
                            <div className="leading-none text-lg">ARCADE MODE</div>
                            <div className="text-[10px] opacity-75 font-normal">10 Progressive Levels</div>
                        </div>
                    </button>

                    <button 
                        onClick={startEndless}
                        className="w-full py-4 bg-purple-500 hover:bg-purple-400 text-slate-900 font-bold rounded-lg transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.8)] flex items-center justify-center gap-3"
                    >
                        <Infinity className="w-6 h-6" />
                        <div className="text-left">
                            <div className="leading-none text-lg">ENDLESS MODE</div>
                            <div className="text-[10px] opacity-75 font-normal">Infinite Looping Stages</div>
                        </div>
                    </button>
                </div>

                </div>
            </div>
            )}

            {/* Settings / Pause Overlay */}
            {(gameState === GameState.PAUSED || gameState === GameState.SETTINGS) && (
                 <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center rounded-lg z-30">
                 <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-80 relative overflow-hidden flex flex-col max-h-[90%]">
                    
                    {/* Help Toggle Button */}
                    {!showHelp && (
                        <button 
                            onClick={() => setShowHelp(true)}
                            className="absolute right-4 top-5 text-slate-500 hover:text-cyan-400 transition-colors z-10"
                            aria-label="How to Play"
                        >
                            <HelpCircle className="w-6 h-6" />
                        </button>
                    )}

                    {showHelp ? (
                        <div className="flex flex-col h-full overflow-hidden">
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <h3 className="text-xl font-bold font-[Orbitron] text-white">HOW TO PLAY</h3>
                                <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="overflow-y-auto pr-2 space-y-5 custom-scrollbar flex-1">
                                <section>
                                    <h4 className="text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wider">Controls</h4>
                                    <div className="space-y-2 text-xs text-slate-300 bg-slate-800/30 p-3 rounded-lg">
                                        <div className="flex justify-between">
                                            <span>Move</span>
                                            <span className="font-mono text-white">Mouse / Arrows / Drag</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Launch</span>
                                            <span className="font-mono text-white">Space / Up / Tap Top</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Dash</span>
                                            <span className="font-mono text-white">Shift / Double Tap Bot</span>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-xs font-bold text-pink-400 mb-2 uppercase tracking-wider">Power-Ups</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        <PowerUpInfo color="#22c55e" name="Enlarge" desc="Expands paddle width (10s)" />
                                        <PowerUpInfo color="#fbbf24" name="Multiball" desc="Spawns extra balls (Instant)" />
                                        <PowerUpInfo color="#ef4444" name="Laser" desc="Fires massive beam (2s Charge)" />
                                        <PowerUpInfo color="#facc15" name="Lightning" desc="Chain brick destruction (5s)" />
                                        <PowerUpInfo color="#f87171" name="Cluster" desc="Explosive shrapnel hits (5s)" />
                                        <PowerUpInfo color="#38bdf8" name="Shield" desc="Saves ball from death (10s)" />
                                        <PowerUpInfo color="#4ade80" name="Sticky" desc="Catch and aim ball (10s)" />
                                        <PowerUpInfo color="#ec4899" name="Heart" desc="+1 Life (Instant)" />
                                    </div>
                                </section>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-6 text-center font-[Orbitron] tracking-wider shrink-0">
                            {gameState === GameState.PAUSED ? 'PAUSED' : 'SETTINGS'}
                            </h2>
                            
                            {/* Audio Controls */}
                            <div className="space-y-4 mb-8 shrink-0">
                                <div>
                                    <div className="flex justify-between text-xs text-slate-400 mb-1 uppercase font-bold tracking-wider">
                                        <span>Music Volume</span>
                                        <span>{Math.round(musicVol * 100)}%</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                          onClick={toggleMusicMute} 
                                          className="focus:outline-none hover:opacity-80 transition-opacity"
                                          title={musicVol > 0 ? "Mute Music" : "Unmute Music"}
                                        >
                                            {musicVol > 0 ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
                                        </button>
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
                                        <button 
                                          onClick={toggleSfxMute} 
                                          className="focus:outline-none hover:opacity-80 transition-opacity"
                                          title={sfxVol > 0 ? "Mute SFX" : "Unmute SFX"}
                                        >
                                            {sfxVol > 0 ? <Volume2 className="w-4 h-4 text-pink-400" /> : <VolumeX className="w-4 h-4 text-slate-600" />}
                                        </button>
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

                            <div className="space-y-3 shrink-0">
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
                        </>
                    )}
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
                <p className="text-green-200 text-xl mb-8">Campaign Complete!</p>
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