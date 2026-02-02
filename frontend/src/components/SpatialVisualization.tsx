// src/components/SpatialVisualization.tsx
import React, { useEffect, useRef } from 'react';
import { Droplet, Wind, Activity, AlertTriangle } from 'lucide-react';

interface SpatialGridData {
    grid: number[][];
    min: number;
    max: number;
    nx: number;
    ny: number;
}

interface SpatialVisualizationProps {
    spatialGrid: SpatialGridData | null;
    parameter: string;
    onParameterChange: (param: string) => void;
}

const parameterInfo: Record<string, { label: string; icon: React.ReactNode; unit: string; colormap: string }> = {
    dissolved_oxygen: {
        label: 'Dissolved Oxygen',
        icon: <Wind className="w-5 h-5" />,
        unit: 'mg/L',
        colormap: 'oxygen', // low = red, high = cyan
    },
    nutrient: {
        label: 'Nutrients',
        icon: <Activity className="w-5 h-5" />,
        unit: 'µmol/L',
        colormap: 'nutrient', // low = blue, high = green
    },
    phytoplankton: {
        label: 'Phytoplankton',
        icon: <Droplet className="w-5 h-5" />,
        unit: 'µmol/L',
        colormap: 'phyto', // low = dark, high = green
    },
    bod: {
        label: 'BOD (Pollutant)',
        icon: <AlertTriangle className="w-5 h-5" />,
        unit: 'mg/L',
        colormap: 'pollutant', // low = blue, high = red/brown
    },
    temperature: {
        label: 'Temperature',
        icon: <Activity className="w-5 h-5" />,
        unit: '°C',
        colormap: 'temperature', // low = blue, high = red
    },
};

function getColor(value: number, min: number, max: number, colormap: string): string {
    const normalized = max > min ? (value - min) / (max - min) : 0.5;
    
    switch (colormap) {
        case 'oxygen':
            // Red (low) -> Yellow (mid) -> Cyan (high)
            if (normalized < 0.5) {
                const t = normalized * 2;
                const r = 220;
                const g = Math.floor(30 + t * 170);
                const b = Math.floor(30 + t * 30);
                return `rgb(${r}, ${g}, ${b})`;
            } else {
                const t = (normalized - 0.5) * 2;
                const r = Math.floor(220 - t * 214);
                const g = Math.floor(200 - t * 18);
                const b = Math.floor(60 + t * 148);
                return `rgb(${r}, ${g}, ${b})`;
            }
        
        case 'nutrient':
            // Dark Blue -> Cyan -> Green
            const r = Math.floor(10 + normalized * 40);
            const g = Math.floor(50 + normalized * 185);
            const b = Math.floor(130 - normalized * 80);
            return `rgb(${r}, ${g}, ${b})`;
        
        case 'phyto':
            // Dark -> Green
            const gr = Math.floor(20 + normalized * 120);
            const gg = Math.floor(80 + normalized * 175);
            const gb = Math.floor(30 + normalized * 70);
            return `rgb(${gr}, ${gg}, ${gb})`;
        
        case 'pollutant':
            // Blue (clean) -> Red/Brown (polluted)
            const pr = Math.floor(30 + normalized * 150);
            const pg = Math.floor(100 - normalized * 50);
            const pb = Math.floor(150 - normalized * 120);
            return `rgb(${pr}, ${pg}, ${pb})`;
        
        case 'temperature':
            // Blue (cold) -> Green (moderate) -> Orange (warm) -> Red (hot)
            if (normalized < 0.33) {
                const t = normalized / 0.33;
                const r = Math.floor(50 + t * 50);
                const g = Math.floor(100 + t * 120);
                const b = Math.floor(200 - t * 50);
                return `rgb(${r}, ${g}, ${b})`;
            } else if (normalized < 0.67) {
                const t = (normalized - 0.33) / 0.34;
                const r = Math.floor(100 + t * 120);
                const g = Math.floor(220 - t * 40);
                const b = Math.floor(150 - t * 100);
                return `rgb(${r}, ${g}, ${b})`;
            } else {
                const t = (normalized - 0.67) / 0.33;
                const r = Math.floor(220 + t * 30);
                const g = Math.floor(180 - t * 130);
                const b = Math.floor(50 - t * 30);
                return `rgb(${r}, ${g}, ${b})`;
            }
        
        default:
            // Viridis-like: Purple -> Blue -> Green -> Yellow
            const vr = Math.floor(68 + normalized * 187);
            const vg = Math.floor(1 + normalized * 230);
            const vb = Math.floor(84 - normalized * 30);
            return `rgb(${vr}, ${vg}, ${vb})`;
    }
}

export default function SpatialVisualization({ spatialGrid, parameter, onParameterChange }: SpatialVisualizationProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const info = parameterInfo[parameter] || parameterInfo.dissolved_oxygen;

    const legendGradient =
        info.colormap === 'oxygen'
            ? 'rgb(220,30,30), rgb(220,200,60), rgb(6,182,208)'
            : info.colormap === 'nutrient'
            ? 'rgb(10,50,130), rgb(30,150,100), rgb(50,235,50)'
            : info.colormap === 'phyto'
            ? 'rgb(20,80,30), rgb(60,180,70), rgb(140,255,100)'
            : info.colormap === 'pollutant'
            ? 'rgb(30,100,150), rgb(100,70,80), rgb(180,50,30)'
            : info.colormap === 'temperature'
            ? 'rgb(50,100,200), rgb(100,220,150), rgb(220,180,50), rgb(250,50,20)'
            : 'rgb(68,1,84), rgb(59,82,139), rgb(33,145,140), rgb(94,201,97), rgb(253,231,37)';

    useEffect(() => {
        if (!canvasRef.current || !spatialGrid) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { grid, min, max, nx, ny } = spatialGrid;
        
        // Set canvas size to match grid
        canvas.width = nx;
        canvas.height = ny;

        // Draw the spatial grid
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const value = grid[j]?.[i] ?? min;
                const color = getColor(value, min, max, info.colormap);
                ctx.fillStyle = color;
                ctx.fillRect(i, j, 1, 1);
            }
        }
    }, [spatialGrid, info.colormap]);

    if (!spatialGrid) {
        return (
            <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    {info.icon}
                    Spatial Distribution
                </h3>
                <div className="flex items-center justify-center h-96 text-gray-400">
                    Toggle the spatial view to load grid data
                </div>
            </div>
        );
    }

    const { min, max, nx, ny } = spatialGrid;

    return (
        <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    {info.icon}
                    {info.label} - Spatial Distribution
                </h3>
                <div className="flex gap-2">
                    {Object.keys(parameterInfo).map((param) => (
                        <button
                            key={param}
                            onClick={() => onParameterChange(param)}
                            className={`px-3 py-1 rounded-lg text-sm transition-all ${
                                param === parameter
                                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                            }`}
                        >
                            {parameterInfo[param].label.split(' ')[0]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative bg-slate-950/50 rounded-xl p-4 border border-white/5">
                <canvas
                    ref={canvasRef}
                    className="w-full h-auto rounded-lg"
                    style={{
                        imageRendering: 'pixelated',
                        maxHeight: '400px',
                    }}
                />
                
                {/* Colorbar Legend */}
                <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-4 rounded-full" style={{
                        background: `linear-gradient(to right, ${
                            legendGradient
                        })`
                    }} />
                    <div className="flex justify-between text-xs text-gray-400 w-32">
                        <span>{min.toFixed(2)}</span>
                        <span>{max.toFixed(2)}</span>
                    </div>
                    <span className="text-sm text-gray-400 w-20">{info.unit}</span>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-gray-400 mb-1">Grid Size</div>
                    <div className="text-white font-semibold">{nx} × {ny}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-gray-400 mb-1">Min Value</div>
                    <div className="text-white font-semibold">{min.toFixed(3)} {info.unit}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                    <div className="text-gray-400 mb-1">Max Value</div>
                    <div className="text-white font-semibold">{max.toFixed(3)} {info.unit}</div>
                </div>
            </div>

            <p className="text-xs text-gray-500 mt-3">
                This heatmap shows the 2D spatial distribution across the 200m × 200m domain. 
                Darker areas indicate low values, brighter areas indicate high values.
            </p>
        </div>
    );
}
