// src/hooks/useSimulationData.ts
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

// Define the structure of the chemistry data
interface ChemistryData {
    nutrient: number;
    phytoplankton: number;
    zooplankton: number;
    detritus: number;
    dissolved_oxygen: number;
    ph: number;
    bod: number;
    temperature: number;
}

// Spatial grid data structure
interface SpatialGridData {
    grid: number[][];
    min: number;
    max: number;
    nx: number;
    ny: number;
}

export function useSimulationData() {
    const [health, setHealth] = useState<string>('');
    const [chemistry, setChemistry] = useState<ChemistryData | null>(null);
    const [spatialGrid, setSpatialGrid] = useState<SpatialGridData | null>(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchData = useCallback(async () => {
        try {
            const healthRes = await axios.get<{ health_status: string }>(`${API_BASE_URL}/status/health`);
            setHealth(healthRes.data.health_status);

            const chemistryRes = await axios.get<ChemistryData>(`${API_BASE_URL}/status/chemistry`);
            setChemistry(chemistryRes.data);
            
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Failed to fetch simulation data:", error);
            setHealth("Error: Could not connect to backend.");
        }
    }, []);

    const stepSimulation = useCallback(async () => {
        try {
            await axios.post(`${API_BASE_URL}/simulation/step`);
            // After stepping, refresh the data
            fetchData();
        } catch (error) {
            console.error("Failed to step simulation:", error);
        }
    }, [fetchData]);

    const resetSimulation = useCallback(async () => {
        try {
            await axios.post(`${API_BASE_URL}/simulation/reset`);
            fetchData();
        } catch (error) {
            console.error("Failed to reset simulation:", error);
        }
    }, [fetchData]);

    const injectParameters = useCallback(async (nutrient: number, pollutant: number) => {
        try {
            await axios.post(`${API_BASE_URL}/simulation/inject?nutrient=${nutrient}&pollutant=${pollutant}`);
            fetchData();
        } catch (error) {
            console.error("Failed to inject parameters:", error);
        }
    }, [fetchData]);

    const fetchSpatialGrid = useCallback(async (parameter: string = 'dissolved_oxygen', downsample: number = 4) => {
        try {
            const response = await axios.get<SpatialGridData>(
                `${API_BASE_URL}/status/chemistry/grid?parameter=${parameter}&downsample=${downsample}`
            );
            setSpatialGrid(response.data);
        } catch (error) {
            console.error("Failed to fetch spatial grid:", error);
        }
    }, []);
    
    const toggleMarineHeatwave = useCallback(async (activate: boolean, intensity: number = 3.5) => {
        try {
            await axios.post(`${API_BASE_URL}/simulation/heatwave?activate=${activate}&intensity=${intensity}`);
            fetchData();
        } catch (error) {
            console.error("Failed to toggle marine heatwave:", error);
        }
    }, [fetchData]);

    const exportData = useCallback(() => {
        if (chemistry) {
            const data = {
                timestamp: new Date().toISOString(),
                health,
                chemistry,
                spatialGrid,
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hydro-ecologist-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [chemistry, health, spatialGrid]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { 
        health, 
        chemistry, 
        spatialGrid,
        lastUpdated, 
        stepSimulation, 
        fetchData, 
        fetchSpatialGrid,
        resetSimulation, 
        injectParameters,
        toggleMarineHeatwave,
        exportData 
    };
}
