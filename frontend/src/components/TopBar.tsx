import React from 'react';
import { Activity, Droplet, AlertTriangle, Clock } from 'lucide-react';

interface TopBarProps {
  health: string;
  chemistry: any;
  isAutoPlay: boolean;
  elapsedTime: number;
}

export default function TopBar({ health, chemistry, isAutoPlay, elapsedTime }: TopBarProps) {
  const getHealthStatus = () => {
    if (!health) return { color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' };
    if (health.includes('Pristine') || health.includes('Healthy')) 
      return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' };
    if (health.includes('Polluted') || health.includes('Collapse')) 
      return { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' };
    return { color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' };
  };

  const status = getHealthStatus();

  return (
    <div className="absolute top-0 left-0 right-0 z-20 backdrop-blur-xl bg-slate-950/60 border-b border-white/10">
      <div className="px-6 py-3 flex items-center justify-between">
        {/* Left: Health Status */}
        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl ${status.bg} ${status.border} border`}>
          <Droplet className={`w-5 h-5 ${status.color}`} />
          <span className="text-sm font-semibold text-white">
            {health || 'Initializing...'}
          </span>
        </div>

        {/* Center: Key Metrics */}
        <div className="flex items-center gap-4">
          {chemistry && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-400">DO:</span>
                <span className={`text-sm font-bold ${chemistry.dissolved_oxygen < 2 ? 'text-red-400' : 'text-cyan-400'}`}>
                  {chemistry.dissolved_oxygen.toFixed(1)}
                </span>
                <span className="text-xs text-gray-500">mg/L</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-400">Nutrients:</span>
                <span className={`text-sm font-bold ${chemistry.nutrient > 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {chemistry.nutrient.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
                <span className="text-xs text-gray-400">pH:</span>
                <span className="text-sm font-bold text-purple-400">{chemistry.ph.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {/* Right: Time & Status */}
        <div className="flex items-center gap-4">
          {isAutoPlay && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 animate-pulse">
              <Activity className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-amber-300">AUTO-PLAY</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">{Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
