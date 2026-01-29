// src/components/Dashboard.tsx
import React from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { useSimulationData } from '../hooks/useSimulationData';

interface DataCardProps {
    title: string;
    value: string | number;
    unit?: string;
}

const DataCard: React.FC<DataCardProps> = ({ title, value, unit = '' }) => (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <p className="text-2xl font-semibold text-white">
            {typeof value === 'number' ? value.toFixed(2) : value}
            <span className="text-lg ml-1 text-gray-300">{unit}</span>
        </p>
    </div>
);

export default function Dashboard() {
    const { health, chemistry, lastUpdated, stepSimulation, fetchData } = useSimulationData();

    return (
        <div className="p-4 bg-gray-900 text-white h-full">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Hydro-Ecologist Dashboard</h1>
                <div className="flex items-center gap-4">
                    <button onClick={() => fetchData()} className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 transition">
                        <RefreshCw size={20} />
                    </button>
                    <button onClick={() => stepSimulation()} className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 transition">
                        <Play size={20} />
                        <span>Step Simulation</span>
                    </button>
                </div>
            </div>
            
            <div className="mb-4 p-4 rounded-lg bg-gray-800">
                <h2 className="text-lg font-semibold mb-2">Ecosystem Health Status</h2>
                <p className="text-cyan-300">{health || 'Loading...'}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {chemistry ? (
                    <>
                        <DataCard title="Dissolved Oxygen" value={chemistry.dissolved_oxygen} unit="mg/L" />
                        <DataCard title="Nutrient Level" value={chemistry.nutrient} unit="µmol/L" />
                        <DataCard title="Phytoplankton" value={chemistry.phytoplankton} unit="µmol/L" />
                        <DataCard title="Zooplankton" value={chemistry.zooplankton} unit="µmol/L" />
                        <DataCard title="Detritus" value={chemistry.detritus} unit="µmol/L" />
                    </>
                ) : (
                    <p>Loading chemistry data...</p>
                )}
            </div>
            <p className="text-xs text-gray-500 mt-4">Last Updated: {lastUpdated.toLocaleTimeString()}</p>
        </div>
    );
}
