// src/components/Dashboard.tsx
import React, { useEffect } from 'react';
import { Activity, Droplet, Wind, AlertTriangle, TrendingUp, Play, Pause, RotateCcw, Download, Beaker, Map } from 'lucide-react';
import { useSimulationData } from '../hooks/useSimulationData';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SpatialVisualization from './SpatialVisualization';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  status?: 'good' | 'warning' | 'critical';
  trend?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, unit = '', icon, status = 'good', trend }) => {
  const statusColors = {
    good: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
    warning: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30',
    critical: 'from-red-500/20 to-rose-500/20 border-red-500/30',
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl backdrop-blur-xl bg-gradient-to-br ${statusColors[status]} border p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl`}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-white/10 backdrop-blur-sm">
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            <TrendingUp size={16} className={trend < 0 ? 'rotate-180' : ''} />
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-300 mb-2">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white">
          {typeof value === 'number' ? value.toFixed(2) : value}
        </span>
        {unit && <span className="text-lg text-gray-400">{unit}</span>}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { health, chemistry, spatialGrid, stepSimulation, fetchData, fetchSpatialGrid, resetSimulation, injectParameters, exportData } = useSimulationData();
  const [history, setHistory] = React.useState<any[]>([]);
  const [isAutoPlay, setIsAutoPlay] = React.useState(false);
  const [nutrientSlider, setNutrientSlider] = React.useState(0);
  const [pollutantSlider, setPollutantSlider] = React.useState(0);
  const [showSpatialView, setShowSpatialView] = React.useState(false);
  const [spatialParameter, setSpatialParameter] = React.useState('dissolved_oxygen');

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlay) {
      const interval = setInterval(() => {
        stepSimulation();
        if (showSpatialView) {
          fetchSpatialGrid(spatialParameter, 4);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isAutoPlay, stepSimulation, showSpatialView, spatialParameter, fetchSpatialGrid]);

  // Load spatial grid when parameter changes
  useEffect(() => {
    if (showSpatialView) {
      fetchSpatialGrid(spatialParameter, 4);
    }
  }, [spatialParameter, showSpatialView, fetchSpatialGrid]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        stepSimulation();
      } else if (e.code === 'KeyR' && !e.ctrlKey) {
        e.preventDefault();
        fetchData();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        setIsAutoPlay(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [stepSimulation, fetchData]);

  useEffect(() => {
    if (chemistry) {
      setHistory(prev => [
        ...prev.slice(-20),
        {
          time: new Date().getTime(),
          do: chemistry.dissolved_oxygen,
          nutrients: chemistry.nutrient,
          phyto: chemistry.phytoplankton,
        }
      ]);
    }
  }, [chemistry]);

  const getHealthStatus = () => {
    if (!health) return 'good';
    if (health.includes('Pristine') || health.includes('Healthy')) return 'good';
    if (health.includes('Polluted') || health.includes('Collapse')) return 'critical';
    return 'warning';
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-slate-900/80 border-b border-white/10">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Hydro-Ecologist
              </h1>
              <p className="text-sm text-gray-400 mt-1">Digital Twin · Marine Ecosystem Simulation</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => fetchData()}
                className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/20"
                title="Refresh (R)"
              >
                <Activity className="w-5 h-5 text-cyan-400" />
              </button>
              <button
                onClick={() => setIsAutoPlay(!isAutoPlay)}
                className={`px-6 py-3 rounded-xl ${isAutoPlay ? 'bg-amber-500/20 border-amber-500/30' : 'bg-white/5 border-white/10'} border backdrop-blur-xl transition-all duration-300 hover:scale-105`}
                title="Auto-play (P)"
              >
                {isAutoPlay ? <Pause className="w-5 h-5 text-amber-400" /> : <Play className="w-5 h-5 text-cyan-400" />}
              </button>
              <button
                onClick={() => stepSimulation()}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/50"
                title="Step (Space)"
              >
                Advance
              </button>
              <button
                onClick={() => resetSimulation()}
                className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-xl transition-all duration-300 hover:scale-105"
                title="Reset simulation"
              >
                <RotateCcw className="w-5 h-5 text-gray-400" />
              </button>
              <button
                onClick={() => exportData()}
                className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-xl transition-all duration-300 hover:scale-105"
                title="Export data"
              >
                <Download className="w-5 h-5 text-gray-400" />
              </button>
              <button
                onClick={() => {
                  setShowSpatialView(!showSpatialView);
                  if (!showSpatialView) {
                    fetchSpatialGrid(spatialParameter, 4);
                  }
                }}
                className={`px-6 py-3 rounded-xl ${showSpatialView ? 'bg-cyan-500/20 border-cyan-500/30' : 'bg-white/5 border-white/10'} border backdrop-blur-xl transition-all duration-300 hover:scale-105`}
                title="Toggle spatial view"
              >
                <Map className={`w-5 h-5 ${showSpatialView ? 'text-cyan-400' : 'text-gray-400'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Parameter Controls */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Beaker className="w-6 h-6 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Parameter Controls</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center justify-between text-sm text-gray-300 mb-2">
                <span>Inject Nutrients</span>
                <span className="text-cyan-400">{nutrientSlider.toFixed(1)} µmol/L</span>
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={nutrientSlider}
                onChange={(e) => setNutrientSlider(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <button
                onClick={() => {
                  injectParameters(nutrientSlider, 0);
                  setNutrientSlider(0);
                }}
                disabled={nutrientSlider === 0}
                className="mt-3 w-full px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Add Nutrients
              </button>
            </div>
            <div>
              <label className="flex items-center justify-between text-sm text-gray-300 mb-2">
                <span>Inject Pollutants</span>
                <span className="text-red-400">{pollutantSlider.toFixed(1)} mg/L</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={pollutantSlider}
                onChange={(e) => setPollutantSlider(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <button
                onClick={() => {
                  injectParameters(0, pollutantSlider);
                  setPollutantSlider(0);
                }}
                disabled={pollutantSlider === 0}
                className="mt-3 w-full px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Add Pollutants
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Shortcuts: <kbd className="px-2 py-1 bg-white/10 rounded">Space</kbd> to step, 
            <kbd className="px-2 py-1 bg-white/10 rounded ml-2">P</kbd> to play/pause,
            <kbd className="px-2 py-1 bg-white/10 rounded ml-2">R</kbd> to refresh
          </p>
        </div>

        {/* Health Status Banner */}
        <div className={`rounded-2xl backdrop-blur-xl bg-gradient-to-r ${
          getHealthStatus() === 'good' ? 'from-emerald-500/20 to-green-500/20 border-emerald-500/30' :
          getHealthStatus() === 'critical' ? 'from-red-500/20 to-rose-500/20 border-red-500/30' :
          'from-amber-500/20 to-yellow-500/20 border-amber-500/30'
        } border p-6 transition-all duration-500`}>
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
              {getHealthStatus() === 'critical' ? (
                <AlertTriangle className="w-8 h-8 text-red-400" />
              ) : (
                <Droplet className="w-8 h-8 text-cyan-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Ecosystem Health</h2>
              <p className="text-gray-200">{health || 'Analyzing...'}</p>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        {chemistry && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Dissolved Oxygen"
              value={chemistry.dissolved_oxygen}
              unit="mg/L"
              icon={<Wind className="w-6 h-6 text-cyan-400" />}
              status={chemistry.dissolved_oxygen < 2 ? 'critical' : chemistry.dissolved_oxygen < 4 ? 'warning' : 'good'}
              trend={2.3}
            />
            <MetricCard
              title="Nutrients"
              value={chemistry.nutrient}
              unit="µmol/L"
              icon={<TrendingUp className="w-6 h-6 text-emerald-400" />}
              status={chemistry.nutrient > 15 ? 'warning' : 'good'}
              trend={-1.2}
            />
            <MetricCard
              title="Phytoplankton"
              value={chemistry.phytoplankton}
              unit="µmol/L"
              icon={<Activity className="w-6 h-6 text-green-400" />}
              status={chemistry.phytoplankton > 5 ? 'warning' : 'good'}
              trend={4.5}
            />
            <MetricCard
              title="Zooplankton"
              value={chemistry.zooplankton}
              unit="µmol/L"
              icon={<Droplet className="w-6 h-6 text-blue-400" />}
              status="good"
            />
            <MetricCard
              title="Detritus"
              value={chemistry.detritus}
              unit="µmol/L"
              icon={<AlertTriangle className="w-6 h-6 text-amber-400" />}
              status="good"
            />
            <MetricCard
              title="pH Level"
              value={chemistry.ph}
              unit=""
              icon={<Droplet className="w-6 h-6 text-purple-400" />}
              status={chemistry.ph < 7.5 || chemistry.ph > 8.5 ? 'warning' : 'good'}
            />
          </div>
        )}

        {/* Charts */}
        {history.length > 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Dissolved Oxygen Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
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

            <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">NPZD Dynamics</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="nutrients" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="phyto" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
