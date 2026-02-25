import React from 'react';
import { ARCADE_LEVELS, ENDLESS_STAGES } from '../data/levels';
import { GameState } from '../types';
import { X, Shield, Zap } from 'lucide-react';

// --- TEMP DEV FEATURE ---
interface DevDashboardProps {
  setGameState: (state: GameState) => void;
  setIsDevMode: (isDev: boolean) => void;
  isInvincible: boolean;
  setIsInvincible: (isInvincible: boolean) => void;
  setLevelIndex: (index: number) => void;
  initializeGame: () => void;
  setCampaignMode: (mode: any) => void;
}

const DevDashboard: React.FC<DevDashboardProps> = ({
  setGameState,
  setIsDevMode,
  isInvincible,
  setIsInvincible,
  setLevelIndex,
  initializeGame,
  setCampaignMode
}) => {

  const handleLevelSelect = (index: number, mode: 'ARCADE' | 'ENDLESS') => {
    setCampaignMode(mode);
    setLevelIndex(index);
    initializeGame();
    setGameState(GameState.PLAYING);
  };

  const closeDevMode = () => {
    setIsDevMode(false);
    setGameState(GameState.MENU);
  };

  return (
    <div className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
        <h2 className="text-3xl font-black text-cyan-400 font-[Orbitron]">DEV DASHBOARD</h2>
        <button 
          onClick={closeDevMode}
          className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-yellow-400" />
              God Mode
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Invincibility (Ball Reset)</span>
              <button
                onClick={() => setIsInvincible(!isInvincible)}
                className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                  isInvincible 
                    ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]' 
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {isInvincible ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              Hotkeys (In-Game)
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 font-mono">
              <div>H - Heart (+1 Life)</div>
              <div>B - Barrier</div>
              <div>A - Armor</div>
              <div>E - Enlarge</div>
              <div>M - Multiball</div>
              <div>T - Turret</div>
              <div>L - Laser</div>
              <div>Z - Lightning</div>
              <div>C - Cluster</div>
              <div>S - Sticky</div>
            </div>
          </div>
        </div>

        {/* Level Select */}
        <div className="space-y-6">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Arcade Levels</h3>
            <div className="grid grid-cols-5 gap-2">
              {ARCADE_LEVELS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleLevelSelect(i, 'ARCADE')}
                  className="p-2 bg-slate-700 hover:bg-cyan-600 text-white rounded font-mono text-sm transition-colors"
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Endless Stages</h3>
            <div className="grid grid-cols-5 gap-2">
              {ENDLESS_STAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleLevelSelect(i, 'ENDLESS')}
                  className="p-2 bg-slate-700 hover:bg-purple-600 text-white rounded font-mono text-sm transition-colors"
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevDashboard;
