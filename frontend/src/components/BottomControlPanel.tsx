import React, { useState } from 'react';
import { 
  Sliders, TrendingUp, Settings, Play, Pause, RotateCcw, 
  Download, Droplet, Wind, Activity, AlertTriangle, Beaker, Zap 
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BottomControlPanelProps {
  chemistry: any;
  history: any[];
  isAutoPlay: boolean;
  onToggleAutoPlay: () => void;
  onStep: () => void;
  onReset: () => void;
  onExport: () => void;
  onInject: (nutrient: number, pollutant: number) => void;
  onPreset: (preset: string) => void;
}

export default function BottomControlPanel({
  chemistry,
  history,
  isAutoPlay,
  onToggleAutoPlay,
  onStep,
  onReset,
  onExport,
  onInject,
  onPreset,
}: BottomControlPanelProps) {
  const [activeTab, setActiveTab] = useState<'parameters' | 'charts' | 'controls'>('parameters');
  const [nutrient, setNutrient] = useState(0);
  const [pollutant, setPollutant] = useState(0);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 backdrop-blur-2xl bg-slate-950/90 border-t border-white/10">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 border-b border-white/5">
        <button
          onClick={() => setActiveTab('parameters')}
          className={`px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all ${
            activeTab === 'parameters'
              ? 'bg-white/10 text-cyan-400 border-t-2 border-cyan-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }`}
        >
          <Sliders className="w-4 h-4 inline mr-2" />
          Parameters
        </button>
        <button
          onClick={() => setActiveTab('charts')}
          className={`px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all ${
            activeTab === 'charts'
              ? 'bg-white/10 text-cyan-400 border-t-2 border-cyan-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Charts
        </button>
        <button
          onClick={() => setActiveTab('controls')}
          className={`px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all ${
            activeTab === 'controls'
              ? 'bg-white/10 text-cyan-400 border-t-2 border-cyan-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Controls
        </button>

        {/* Main action buttons on the right */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggleAutoPlay}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              isAutoPlay 
                ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30' 
                : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30'
            }`}
          >
            {isAutoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={onStep}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-semibold transition-all"
          >
            Step Forward
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-4 h-[220px] overflow-y-auto">
        {activeTab === 'parameters' && (
          <div className="space-y-4">
            {/* Presets */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-400 font-semibold">Quick Presets:</span>
              <button onClick={() => onPreset('pristine')} className="px-4 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 transition-all">
                Pristine
              </button>
              <button onClick={() => onPreset('urban')} className="px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all">
                Urban Runoff
              </button>
              <button onClick={() => onPreset('algae')} className="px-4 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-xs font-semibold hover:bg-green-500/30 transition-all">
                Algae Bloom
              </button>
              <button onClick={() => onPreset('polluted')} className="px-4 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/30 transition-all">
                Heavy Pollution
              </button>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Nutrient Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplet className="w-5 h-5 text-emerald-400" />
                    <span className="text-base font-semibold text-white">Inject Nutrients</span>
                  </div>
                  <span className="text-lg font-bold text-emerald-400">{nutrient.toFixed(1)} µmol/L</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={nutrient}
                  onChange={(e) => setNutrient(parseFloat(e.target.value))}
                  className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex gap-2">
                  <button onClick={() => setNutrient(0)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400">Clear</button>
                  <button onClick={() => setNutrient(5)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400">Low</button>
                  <button onClick={() => setNutrient(10)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400">Med</button>
                  <button onClick={() => setNutrient(20)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400">High</button>
                  <button 
                    onClick={() => { onInject(nutrient, 0); setNutrient(0); }}
                    disabled={nutrient === 0}
                    className="ml-auto px-6 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Pollutant Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <span className="text-base font-semibold text-white">Inject Pollutants</span>
                  </div>
                  <span className="text-lg font-bold text-red-400">{pollutant.toFixed(1)} mg/L</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={pollutant}
                  onChange={(e) => setPollutant(parseFloat(e.target.value))}
                  className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <div className="flex gap-2">
                  <button onClick={() => setPollutant(0)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400">Clear</button>
                  <button onClick={() => setPollutant(2)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400">Low</button>
                  <button onClick={() => setPollutant(5)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400">Med</button>
                  <button onClick={() => setPollutant(10)} className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-400">High</button>
                  <button 
                    onClick={() => { onInject(0, pollutant); setPollutant(0); }}
                    disabled={pollutant === 0}
                    className="ml-auto px-6 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Keyboard hints */}
            <div className="text-xs text-gray-500 pt-2 border-t border-white/5">
              <kbd className="px-2 py-1 bg-white/10 rounded">Space</kbd> Step · 
              <kbd className="px-2 py-1 bg-white/10 rounded ml-2">P</kbd> Play/Pause · 
              <kbd className="px-2 py-1 bg-white/10 rounded ml-2">R</kbd> Refresh
            </div>
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Dissolved Oxygen</h3>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorDO" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="do" stroke="#06b6d4" fillOpacity={1} fill="url(#colorDO)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <h3 className="text-sm font-semibold text-white mb-3">NPZD Dynamics</h3>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="nutrients" stroke="#10b981" strokeWidth={2} dot={false} name="Nutrients" />
                  <Line type="monotone" dataKey="phyto" stroke="#3b82f6" strokeWidth={2} dot={false} name="Phytoplankton" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'controls' && (
          <div className="space-y-4">
            {/* Detailed Metrics */}
            {chemistry && (
              <div className="grid grid-cols-6 gap-3">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Wind className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-gray-400">DO</span>
                  </div>
                  <p className="text-xl font-bold text-white">{chemistry.dissolved_oxygen.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">mg/L</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Droplet className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-gray-400">Nutrients</span>
                  </div>
                  <p className="text-xl font-bold text-white">{chemistry.nutrient.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">µmol/L</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-400">Phytoplankton</span>
                  </div>
                  <p className="text-xl font-bold text-white">{chemistry.phytoplankton.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">µmol/L</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Droplet className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-gray-400">Zooplankton</span>
                  </div>
                  <p className="text-xl font-bold text-white">{chemistry.zooplankton.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">µmol/L</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-gray-400">Detritus</span>
                  </div>
                  <p className="text-xl font-bold text-white">{chemistry.detritus.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">µmol/L</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Beaker className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-gray-400">pH</span>
                  </div>
                  <p className="text-xl font-bold text-white">{chemistry.ph.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">—</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/5">
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              >
                <RotateCcw className="w-5 h-5 text-gray-400" />
                <span className="font-semibold text-gray-300">Reset Simulation</span>
              </button>
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              >
                <Download className="w-5 h-5 text-gray-400" />
                <span className="font-semibold text-gray-300">Export Data</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
