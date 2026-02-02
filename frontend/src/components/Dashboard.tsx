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

type ChemistrySnapshot = {
  nutrient: number;
  phytoplankton: number;
  zooplankton: number;
  detritus: number;
  dissolved_oxygen: number;
  ph: number;
  bod: number;
  temperature: number;
};

type RunSnapshot = {
  id: 'A' | 'B';
  timestamp: Date;
  targetId: string | null;
  targetName: string | null;
  health: string;
  chemistry: ChemistrySnapshot;
};

function toChemistrySnapshot(chemistry: any): ChemistrySnapshot | null {
  if (!chemistry) return null;
  const keys: Array<keyof ChemistrySnapshot> = [
    'nutrient',
    'phytoplankton',
    'zooplankton',
    'detritus',
    'dissolved_oxygen',
    'ph',
    'bod',
    'temperature',
  ];
  for (const k of keys) {
    if (typeof chemistry[k] !== 'number') return null;
  }
  return {
    nutrient: chemistry.nutrient,
    phytoplankton: chemistry.phytoplankton,
    zooplankton: chemistry.zooplankton,
    detritus: chemistry.detritus,
    dissolved_oxygen: chemistry.dissolved_oxygen,
    ph: chemistry.ph,
    bod: chemistry.bod,
    temperature: chemistry.temperature,
  };
}

function formatDelta(value: number, digits = 2) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function buildExplanation(prev: ChemistrySnapshot, next: ChemistrySnapshot, lastActionLabel: string) {
  const deltas = {
    dissolved_oxygen: next.dissolved_oxygen - prev.dissolved_oxygen,
    bod: next.bod - prev.bod,
    temperature: next.temperature - prev.temperature,
    phytoplankton: next.phytoplankton - prev.phytoplankton,
    zooplankton: next.zooplankton - prev.zooplankton,
    detritus: next.detritus - prev.detritus,
    nutrient: next.nutrient - prev.nutrient,
    ph: next.ph - prev.ph,
  };

  const top = Object.entries(deltas)
    .map(([k, v]) => ({ k, v: v as number, abs: Math.abs(v as number) }))
    .sort((a, b) => b.abs - a.abs)
    .slice(0, 3)
    .map((c) => `${c.k.replace('_', ' ')} ${formatDelta(c.v)}`)
    .join(', ');

  const bullets: string[] = [`Top changes: ${top}.`];

  // DO heuristics aligned to backend: DO changes from photosynthesis, respiration*BOD, and temperature saturation/reaeration.
  if (deltas.dissolved_oxygen < -0.01) {
    if (deltas.bod > 0.01) bullets.push('DO decreased largely because BOD increased (higher oxygen demand).');
    if (deltas.temperature > 0.05) bullets.push('Warmer water lowers DO saturation, pushing DO downward.');
    if (deltas.detritus > 0.01 || deltas.zooplankton > 0.01 || deltas.phytoplankton > 0.01) {
      bullets.push('More biomass/detritus increases respiration terms that can consume DO.');
    }
  } else if (deltas.dissolved_oxygen > 0.01) {
    if (deltas.bod < -0.01) bullets.push('DO increased partly because BOD dropped (less oxygen demand).');
    if (deltas.phytoplankton > 0.01) bullets.push('Higher phytoplankton can increase photosynthetic oxygen production.');
    if (deltas.temperature < -0.05) bullets.push('Cooler water raises DO saturation, helping DO recover.');
  }

  // Nutrient/phyto heuristics.
  if (deltas.nutrient < -0.01 && deltas.phytoplankton > 0.01) {
    bullets.push('Nutrients decreased while phytoplankton increased: uptake/growth is likely dominating.');
  }
  if (deltas.nutrient > 0.01 && deltas.detritus < -0.01) {
    bullets.push('Nutrients increased while detritus decreased: remineralization can return nutrients.');
  }

  return {
    title: 'Why did this change?',
    subtitle: lastActionLabel,
    bullets: Array.from(new Set(bullets)).slice(0, 6),
    deltas,
  };
}

export default function Dashboard() {
  const {
    health,
    chemistry,
    spatialGrid,
    lastUpdated,
    isFetchingData,
    isStepping,
    isResetting,
    isFetchingSpatial,
    dataError,
    spatialError,
    targets,
    activeTargetId,
    activeTarget,
    isFetchingTargets,
    targetError,
    selectTarget,
    lessons,
    isFetchingLessons,
    isRunningLesson,
    lessonError,
    runLesson,
    stepSimulation,
    fetchData,
    fetchSpatialGrid,
    resetSimulation,
    injectParameters,
    toggleMarineHeatwave,
    deployRemediation,
    getRemediationSummary,
    getRegulatoryCompliance,
    getRegulatoryHistory,
    exportData,
  } = useSimulationData();
  const [history, setHistory] = React.useState<any[]>([]);
  const [isAutoPlay, setIsAutoPlay] = React.useState(false);
  const [nutrientSlider, setNutrientSlider] = React.useState(0);
  const [pollutantSlider, setPollutantSlider] = React.useState(0);
  const [showSpatialView, setShowSpatialView] = React.useState(false);
  const [spatialParameter, setSpatialParameter] = React.useState('dissolved_oxygen');
  const [heatwaveActive, setHeatwaveActive] = React.useState(false);
  const [heatwaveIntensity, setHeatwaveIntensity] = React.useState(3.5);
  const [remediationType, setRemediationType] = React.useState('aeration');
  const [remediationRadius, setRemediationRadius] = React.useState(10);
  const [remediationSummary, setRemediationSummary] = React.useState<any>(null);
  const [regulatoryCompliance, setRegulatoryCompliance] = React.useState<any>(null);

  const [isCheckingCompliance, setIsCheckingCompliance] = React.useState(false);
  const [complianceError, setComplianceError] = React.useState<string | null>(null);
  const [lastComplianceCheck, setLastComplianceCheck] = React.useState<Date | null>(null);

  const [isDeployingRemediation, setIsDeployingRemediation] = React.useState(false);
  const [remediationError, setRemediationError] = React.useState<string | null>(null);
  const [lastRemediationUpdate, setLastRemediationUpdate] = React.useState<Date | null>(null);

  const [isSwitchingTarget, setIsSwitchingTarget] = React.useState(false);

  const chemistryRef = React.useRef<any>(null);
  const [prevChemistry, setPrevChemistry] = React.useState<ChemistrySnapshot | null>(null);
  const [lastActionLabel, setLastActionLabel] = React.useState<string>('');
  const [lastActionTime, setLastActionTime] = React.useState<Date | null>(null);
  const [explanation, setExplanation] = React.useState<ReturnType<typeof buildExplanation> | null>(null);

  const [runA, setRunA] = React.useState<RunSnapshot | null>(null);
  const [runB, setRunB] = React.useState<RunSnapshot | null>(null);

  const markAction = React.useCallback((label: string) => {
    const snap = toChemistrySnapshot(chemistryRef.current);
    setPrevChemistry(snap);
    setLastActionLabel(label);
    setLastActionTime(new Date());
    setExplanation(null);
  }, []);

  const captureRunSnapshot = React.useCallback((id: 'A' | 'B') => {
    const snap = toChemistrySnapshot(chemistryRef.current);
    if (!snap) return;
    const run: RunSnapshot = {
      id,
      timestamp: new Date(),
      targetId: activeTargetId ?? null,
      targetName: activeTarget?.name ?? null,
      health: health || '',
      chemistry: snap,
    };
    if (id === 'A') setRunA(run);
    else setRunB(run);
  }, [activeTarget?.name, activeTargetId, health]);

  useEffect(() => {
    chemistryRef.current = chemistry;
  }, [chemistry]);

  useEffect(() => {
    const next = toChemistrySnapshot(chemistry);
    if (!prevChemistry || !next || !lastActionLabel) return;
    setExplanation(buildExplanation(prevChemistry, next, lastActionLabel));
  }, [chemistry, prevChemistry, lastActionLabel]);

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlay) {
      const interval = setInterval(async () => {
        markAction('Auto-play: advance');
        stepSimulation();
        if (showSpatialView) {
          fetchSpatialGrid(spatialParameter, 4);
        }
        // Update regulatory compliance
        setIsCheckingCompliance(true);
        setComplianceError(null);
        try {
          const compliance = await getRegulatoryCompliance();
          if (compliance) {
            setRegulatoryCompliance(compliance);
            setLastComplianceCheck(new Date());
          } else {
            setComplianceError('Could not fetch compliance status.');
          }
        } catch {
          setComplianceError('Could not fetch compliance status.');
        } finally {
          setIsCheckingCompliance(false);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isAutoPlay, stepSimulation, showSpatialView, spatialParameter, fetchSpatialGrid, getRegulatoryCompliance, markAction]);

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
        markAction('Advance (keyboard)');
        stepSimulation();
        if (showSpatialView) {
          fetchSpatialGrid(spatialParameter, 4);
        }
      } else if (e.code === 'KeyR' && !e.ctrlKey) {
        e.preventDefault();
        markAction('Refresh (keyboard)');
        fetchData();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        setIsAutoPlay(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [stepSimulation, fetchData, showSpatialView, spatialParameter, fetchSpatialGrid, markAction]);

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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-lg border ${
                  dataError ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                }`}>
                  {dataError ? 'Backend: disconnected' : 'Backend: connected'}
                </span>
                <span className="text-xs px-2 py-1 rounded-lg border bg-white/5 border-white/10 text-gray-400">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </span>
                {(isFetchingData || isStepping || isResetting) && (
                  <span className="text-xs px-2 py-1 rounded-lg border bg-cyan-500/10 border-cyan-500/20 text-cyan-300">
                    {isResetting ? 'Resetting…' : isStepping ? 'Stepping…' : 'Refreshing…'}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-xs text-gray-400">Target</label>
                <select
                  value={activeTargetId ?? ''}
                  onChange={async (e) => {
                    const nextId = e.target.value;
                    if (!nextId || nextId === activeTargetId) return;
                    const nextName = targets.find(t => t.id === nextId)?.name ?? nextId;
                    markAction(`Switch target → ${nextName}`);
                    setIsSwitchingTarget(true);
                    try {
                      const ok = await selectTarget(nextId);
                      if (ok && showSpatialView) {
                        fetchSpatialGrid(spatialParameter, 4);
                      }
                    } finally {
                      setIsSwitchingTarget(false);
                    }
                  }}
                  disabled={isFetchingTargets || isSwitchingTarget}
                  className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Switch between environment targets"
                >
                  <option value="" disabled>
                    {isFetchingTargets ? 'Loading targets…' : 'Select target…'}
                  </option>
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {isSwitchingTarget && (
                  <span className="text-xs text-cyan-300">Switching…</span>
                )}
                {targetError && (
                  <span className="text-xs text-red-300">{targetError}</span>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  markAction('Refresh');
                  fetchData();
                }}
                disabled={isFetchingData || isStepping || isResetting}
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
                onClick={() => {
                  markAction('Advance');
                  stepSimulation();
                  if (showSpatialView) {
                    fetchSpatialGrid(spatialParameter, 4);
                  }
                }}
                disabled={isStepping || isFetchingData || isResetting}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/50"
                title="Step (Space)"
              >
                Advance
              </button>
              <button
                onClick={() => {
                  markAction('Reset');
                  resetSimulation();
                  if (showSpatialView) {
                    fetchSpatialGrid(spatialParameter, 4);
                  }
                }}
                disabled={isResetting || isStepping || isFetchingData}
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
                disabled={isFetchingSpatial}
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
        {dataError && (
          <div className="rounded-2xl backdrop-blur-xl bg-red-500/10 border border-red-500/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-red-200">Backend connection issue</div>
                <div className="text-xs text-gray-300 mt-1">{dataError}</div>
              </div>
            </div>
          </div>
        )}
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
                  markAction(`Inject nutrients: +${nutrientSlider.toFixed(1)} µmol/L`);
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
                  markAction(`Inject pollutants: +${pollutantSlider.toFixed(1)} mg/L`);
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

        {/* Target Info */}
        {activeTarget && (
          <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Target Info</h3>
                <p className="text-sm text-gray-400 mt-1">{activeTarget.name}</p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-3xl">
                  {activeTarget.description}
                </p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <div>Waterbody: <span className="text-gray-200">{activeTarget.waterbody_type}</span></div>
                {activeTarget.mean_depth_m !== undefined && (
                  <div>Depth: <span className="text-gray-200">{activeTarget.mean_depth_m.toFixed(1)} m</span></div>
                )}
                {activeTarget.eddy_viscosity_m2_s !== undefined && (
                  <div>Mixing: <span className="text-gray-200">ν={activeTarget.eddy_viscosity_m2_s}</span></div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-gray-400 text-xs">Domain</div>
                <div className="text-white font-semibold text-sm">
                  {Array.isArray(activeTarget.domain_size) ? `${activeTarget.domain_size[0]}×${activeTarget.domain_size[1]} m` : '—'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-gray-400 text-xs">Grid</div>
                <div className="text-white font-semibold text-sm">
                  {Array.isArray(activeTarget.grid_shape) ? `${activeTarget.grid_shape[0]}×${activeTarget.grid_shape[1]}` : '—'}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-gray-400 text-xs">Baseline DO</div>
                <div className="text-white font-semibold text-sm">
                  {(activeTarget.baseline?.dissolved_oxygen ?? chemistry?.dissolved_oxygen ?? 0).toFixed(2)} mg/L
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-gray-400 text-xs">Baseline Nutrients</div>
                <div className="text-white font-semibold text-sm">
                  {(activeTarget.baseline?.nutrient ?? chemistry?.nutrient ?? 0).toFixed(2)} µmol/L
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              These are educational/screening profiles (not site-calibrated). Use them to compare mechanisms across environments.
            </p>
          </div>
        )}

        {/* Lesson Presets */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Lesson Presets</h3>
              <p className="text-xs text-gray-500 mt-1">One-click guided scenarios for students and demos.</p>
            </div>
            <div className="text-xs text-gray-400">
              {isFetchingLessons ? 'Loading…' : `${lessons.length} available`}
            </div>
          </div>

          {lessonError && (
            <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200">
              {lessonError}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {lessons.map((l) => (
              <button
                key={l.id}
                onClick={async () => {
                  markAction(`Run lesson: ${l.name}`);
                  const result = await runLesson(l.id);
                  if (result && showSpatialView) {
                    fetchSpatialGrid(spatialParameter, 4);
                  }
                }}
                disabled={isRunningLesson || !!dataError}
                className="text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 p-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white font-semibold">{l.name}</div>
                  <div className="text-xs text-gray-400">{l.target_id}</div>
                </div>
                <div className="text-xs text-gray-400 mt-2 leading-relaxed">{l.description}</div>
                {isRunningLesson && (
                  <div className="text-xs text-cyan-300 mt-2">Running…</div>
                )}
              </button>
            ))}

            {!isFetchingLessons && lessons.length === 0 && (
              <div className="text-sm text-gray-400">No lessons available for this target yet.</div>
            )}
          </div>
        </div>

        {/* Why did this change? */}
        {explanation && (
          <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{explanation.title}</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {explanation.subtitle}
                  {lastActionTime ? ` · ${lastActionTime.toLocaleTimeString()}` : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  setExplanation(null);
                  setPrevChemistry(null);
                  setLastActionLabel('');
                  setLastActionTime(null);
                }}
                className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200"
              >
                Clear
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-gray-400">Key deltas (this step)</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-300">DO</div>
                  <div className={`text-right ${explanation.deltas.dissolved_oxygen >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {formatDelta(explanation.deltas.dissolved_oxygen)} mg/L
                  </div>
                  <div className="text-gray-300">Temp</div>
                  <div className={`text-right ${explanation.deltas.temperature >= 0 ? 'text-amber-300' : 'text-cyan-300'}`}>
                    {formatDelta(explanation.deltas.temperature)} °C
                  </div>
                  <div className="text-gray-300">BOD</div>
                  <div className={`text-right ${explanation.deltas.bod >= 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                    {formatDelta(explanation.deltas.bod)} mg/L
                  </div>
                  <div className="text-gray-300">Nutrient</div>
                  <div className={`text-right ${explanation.deltas.nutrient >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {formatDelta(explanation.deltas.nutrient)} µmol/L
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <div className="text-xs text-gray-400">Mechanism hints</div>
                <ul className="mt-2 space-y-2 text-sm text-gray-200">
                  {explanation.bullets.map((b) => (
                    <li key={b} className="leading-relaxed">• {b}</li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-3">
                  These are heuristics (not a full attribution model).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Run Compare A/B */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Run Compare (A/B)</h3>
              <p className="text-xs text-gray-500 mt-1">Save two snapshots and compare B − A.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => captureRunSnapshot('A')}
                disabled={!toChemistrySnapshot(chemistry) || !!dataError}
                className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save A
              </button>
              <button
                onClick={() => captureRunSnapshot('B')}
                disabled={!toChemistrySnapshot(chemistry) || !!dataError}
                className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save B
              </button>
              <button
                onClick={() => {
                  setRunA(null);
                  setRunB(null);
                }}
                className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-gray-400">Snapshot A</div>
              {runA ? (
                <div className="mt-2 text-sm text-gray-200">
                  <div className="flex justify-between"><span>Time</span><span className="text-gray-300">{runA.timestamp.toLocaleTimeString()}</span></div>
                  <div className="flex justify-between"><span>Target</span><span className="text-gray-300">{runA.targetName ?? runA.targetId ?? '—'}</span></div>
                  <div className="mt-2 text-xs text-gray-400">{runA.health}</div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-400">Not saved yet.</div>
              )}
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-xs text-gray-400">Snapshot B</div>
              {runB ? (
                <div className="mt-2 text-sm text-gray-200">
                  <div className="flex justify-between"><span>Time</span><span className="text-gray-300">{runB.timestamp.toLocaleTimeString()}</span></div>
                  <div className="flex justify-between"><span>Target</span><span className="text-gray-300">{runB.targetName ?? runB.targetId ?? '—'}</span></div>
                  <div className="mt-2 text-xs text-gray-400">{runB.health}</div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-400">Not saved yet.</div>
              )}
            </div>
          </div>

          {runA && runB && (
            <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4">
              {(runA.targetId && runB.targetId && runA.targetId !== runB.targetId) && (
                <div className="mb-3 text-xs text-amber-300">
                  Comparing different targets: {runA.targetId} vs {runB.targetId}. That’s fine for learning, but interpret deltas carefully.
                </div>
              )}
              <div className="text-xs text-gray-400 mb-2">Chemistry deltas (B − A)</div>
              <div className="grid grid-cols-4 gap-2 text-xs text-gray-300">
                <div className="font-semibold text-gray-200">Metric</div>
                <div className="font-semibold text-gray-200 text-right">A</div>
                <div className="font-semibold text-gray-200 text-right">B</div>
                <div className="font-semibold text-gray-200 text-right">Δ</div>

                {([
                  ['dissolved_oxygen', 'mg/L'],
                  ['temperature', '°C'],
                  ['bod', 'mg/L'],
                  ['nutrient', 'µmol/L'],
                  ['phytoplankton', 'µmol/L'],
                  ['zooplankton', 'µmol/L'],
                  ['detritus', 'µmol/L'],
                  ['ph', ''],
                ] as Array<[keyof ChemistrySnapshot, string]>).map(([k, unit]) => {
                  const a = runA.chemistry[k];
                  const b = runB.chemistry[k];
                  const d = b - a;
                  return (
                    <React.Fragment key={k}>
                      <div className="text-gray-300">{k.replace('_', ' ')}</div>
                      <div className="text-right text-gray-200">{a.toFixed(2)}{unit ? ` ${unit}` : ''}</div>
                      <div className="text-right text-gray-200">{b.toFixed(2)}{unit ? ` ${unit}` : ''}</div>
                      <div className={`text-right ${d >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatDelta(d)}{unit ? ` ${unit}` : ''}</div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
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
            <MetricCard
              title="Temperature"
              value={chemistry.temperature}
              unit="°C"
              icon={<Activity className="w-6 h-6 text-orange-400" />}
              status={chemistry.temperature > 25 ? 'warning' : chemistry.temperature > 28 ? 'critical' : 'good'}
            />
          </div>
        )}

        {/* Spatial View */}
        {showSpatialView && (
          <div className="space-y-3">
            {spatialError && (
              <div className="rounded-2xl backdrop-blur-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-200">
                {spatialError}
              </div>
            )}
            {isFetchingSpatial && !spatialGrid && (
              <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
                <div className="text-sm text-gray-300">Loading spatial grid…</div>
                <div className="text-xs text-gray-500 mt-1">Parameter: {spatialParameter}</div>
              </div>
            )}
            <SpatialVisualization
              spatialGrid={spatialGrid}
              parameter={spatialParameter}
              onParameterChange={(param) => setSpatialParameter(param)}
            />
          </div>
        )}

        {/* Marine Heatwave Controls */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">🌡️ Marine Heatwave Scenario</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center justify-between text-sm text-gray-300 mb-2">
                <span>Intensity</span>
                <span className="text-orange-400">+{heatwaveIntensity.toFixed(1)} °C</span>
              </label>
              <input
                type="range"
                min="1"
                max="7"
                step="0.5"
                value={heatwaveIntensity}
                onChange={(e) => setHeatwaveIntensity(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <p className="text-xs text-gray-500 mt-2">
                Typical marine heatwaves: +3-5°C for 7-21 days
              </p>
            </div>
            <div className="flex flex-col justify-center">
              <button
                onClick={() => {
                  const newState = !heatwaveActive;
                  markAction(newState ? `Activate heatwave (+${heatwaveIntensity.toFixed(1)} °C)` : 'Deactivate heatwave');
                  toggleMarineHeatwave(newState, heatwaveIntensity);
                  setHeatwaveActive(newState);
                }}
                className={`w-full px-4 py-3 rounded-lg ${
                  heatwaveActive
                    ? 'bg-orange-500/30 hover:bg-orange-500/40 border-orange-500/50'
                    : 'bg-white/5 hover:bg-white/10 border-white/10'
                } border font-semibold transition-all`}
              >
                {heatwaveActive ? '🔥 Heatwave ACTIVE' : 'Activate Heatwave'}
              </button>
              <p className="text-xs text-gray-400 mt-2 text-center">
                {heatwaveActive 
                  ? 'Causing reduced DO saturation & ecosystem stress' 
                  : 'Simulates prolonged temperature anomaly'}
              </p>
            </div>
          </div>
        </div>

        {/* Remediation Toolkit */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-white">🧪 Remediation Toolkit</h3>
            {lastRemediationUpdate && (
              <span className="ml-auto text-xs text-gray-400">
                Updated {lastRemediationUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>

          {remediationError && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200">
              {remediationError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Intervention Type Selector */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Intervention Type</label>
              <select
                value={remediationType}
                onChange={(e) => setRemediationType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="aeration">💨 Aeration (DO Boost)</option>
                <option value="wetland">🌿 Constructed Wetland</option>
                <option value="oyster_reef">🦪 Oyster Reef</option>
              </select>
              <div className="text-xs text-gray-500 mt-1">
                {remediationType === 'aeration' && 'Mechanical oxygenation +2 mg/L/day'}
                {remediationType === 'wetland' && 'Nutrient removal -30%/day'}
                {remediationType === 'oyster_reef' && 'Natural filtration -20% phyto/day'}
              </div>
            </div>

            {/* Coverage Radius */}
            <div className="space-y-2">
              <label className="flex justify-between text-sm text-gray-400">
                <span>Coverage Radius</span>
                <span className="text-green-400">{remediationRadius} cells</span>
              </label>
              <input
                type="range"
                min="5"
                max="20"
                step="1"
                value={remediationRadius}
                onChange={(e) => setRemediationRadius(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Area: ~{Math.round(Math.PI * remediationRadius * remediationRadius)} cells
              </p>
            </div>

            {/* Deploy Button & Cost */}
            <div className="flex flex-col justify-center gap-2">
              <button
                onClick={async () => {
                  markAction(`Deploy remediation: ${remediationType} (r=${remediationRadius})`);
                  setIsDeployingRemediation(true);
                  setRemediationError(null);
                  try {
                    const success = await deployRemediation(50, 50, remediationRadius, remediationType);
                    if (!success) {
                      setRemediationError('Failed to deploy remediation (check backend logs).');
                      return;
                    }
                    const summary = await getRemediationSummary();
                    if (summary) {
                      setRemediationSummary(summary);
                      setLastRemediationUpdate(new Date());
                    } else {
                      setRemediationError('Deployed, but could not refresh remediation summary.');
                    }
                  } finally {
                    setIsDeployingRemediation(false);
                  }
                }}
                disabled={isDeployingRemediation || !!dataError}
                className="w-full px-4 py-2 rounded-lg font-semibold transition-all bg-green-500/20 hover:bg-green-500/30 border-green-500/50 border disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeployingRemediation ? 'Deploying…' : 'Deploy at Center'}
              </button>
              {remediationSummary && (
                <div className="text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Capital:</span>
                    <span className="text-yellow-400">${(remediationSummary.total_capital_cost / 1000).toFixed(1)}k</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Daily Op:</span>
                    <span className="text-orange-400">${remediationSummary.daily_operational_cost.toFixed(0)}/day</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-gray-400 leading-relaxed">
              <strong className="text-blue-400">Phase 3:</strong> Deploy interventions to improve water quality. 
              Aeration boosts DO, wetlands remove nutrients/BOD, oyster reefs filter phytoplankton. 
              Effects decay over time - monitor effectiveness!
            </p>
          </div>
        </div>

        {/* Regulatory Compliance Monitor */}
        <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-white">⚖️ Regulatory Compliance</h3>
            {lastComplianceCheck && (
              <span className="text-xs text-gray-400">
                Checked {lastComplianceCheck.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={async () => {
                setIsCheckingCompliance(true);
                setComplianceError(null);
                try {
                  const compliance = await getRegulatoryCompliance();
                  if (compliance) {
                    setRegulatoryCompliance(compliance);
                    setLastComplianceCheck(new Date());
                  } else {
                    setComplianceError('Could not fetch compliance status.');
                  }
                } catch {
                  setComplianceError('Could not fetch compliance status.');
                } finally {
                  setIsCheckingCompliance(false);
                }
              }}
              disabled={isCheckingCompliance || !!dataError}
              className="ml-auto px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingCompliance ? 'Checking…' : 'Check Status'}
            </button>
          </div>

          {complianceError && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-200">
              {complianceError}
            </div>
          )}
          
          {regulatoryCompliance ? (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className={`p-4 rounded-lg border-2 ${
                regulatoryCompliance.compliant 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">
                    {regulatoryCompliance.compliant ? '✓ COMPLIANT' : '⚠ VIOLATIONS DETECTED'}
                  </span>
                  <span className={`text-sm font-mono ${
                    regulatoryCompliance.impairment_category === 'none' ? 'text-green-400' :
                    regulatoryCompliance.impairment_category === 'threatened' ? 'text-yellow-400' :
                    regulatoryCompliance.impairment_category === 'impaired' ? 'text-orange-400' :
                    'text-red-400'
                  }`}>
                    {regulatoryCompliance.impairment_category.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                {regulatoryCompliance.consecutive_violations > 0 && (
                  <p className="text-xs text-gray-400">
                    Consecutive violations: {regulatoryCompliance.consecutive_violations} steps
                  </p>
                )}
              </div>

              {/* Active Violations */}
              {regulatoryCompliance.violations && regulatoryCompliance.violations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-red-400">Current Violations:</h4>
                  {regulatoryCompliance.violations.map((v: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-white font-semibold">{v.parameter.replace('_', ' ').toUpperCase()}</span>
                          <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                            v.severity === 'critical' ? 'bg-red-500/30 text-red-300' :
                            v.severity === 'major' ? 'bg-orange-500/30 text-orange-300' :
                            'bg-yellow-500/30 text-yellow-300'
                          }`}>
                            {v.severity}
                          </span>
                        </div>
                        <div className="text-right text-xs">
                          <div className="text-white">{v.value.toFixed(2)}</div>
                          <div className="text-gray-400">Limit: {typeof v.threshold === 'number' ? v.threshold.toFixed(2) : v.threshold}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TMDL Status */}
              {regulatoryCompliance.tmdl_status && regulatoryCompliance.tmdl_status.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-blue-400">TMDL Compliance:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {regulatoryCompliance.tmdl_status.map((tmdl: any, idx: number) => (
                      <div key={idx} className={`p-3 rounded-lg ${
                        tmdl.compliance ? 'bg-green-500/10 border border-green-500/20' : 'bg-orange-500/10 border border-orange-500/20'
                      }`}>
                        <div className="text-xs text-gray-400 mb-1">{tmdl.parameter.toUpperCase()}</div>
                        <div className="text-sm text-white font-semibold">
                          {tmdl.compliance ? '✓ Within Limit' : `${tmdl.reduction_needed}% Reduction Needed`}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {tmdl.current_load.toFixed(1)} / {tmdl.tmdl_limit.toFixed(1)} limit
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standards Reference */}
              {regulatoryCompliance.standards && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    <strong className="text-blue-400">Phase 4:</strong> EPA 303(d) and TMDL monitoring. 
                    Waterbody type: <span className="text-white">{regulatoryCompliance.waterbody_type}</span>. 
                    Standards: DO ≥{regulatoryCompliance.standards.do_minimum} mg/L, 
                    Temp ≤{regulatoryCompliance.standards.temp_maximum}°C, 
                    Nutrients ≤{regulatoryCompliance.standards.nutrient_eutrophic} µmol/L.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p>Click "Check Status" to assess regulatory compliance</p>
              <p className="text-xs mt-2">EPA 303(d) Impaired Waters & TMDL Monitoring</p>
            </div>
          )}
        </div>

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
