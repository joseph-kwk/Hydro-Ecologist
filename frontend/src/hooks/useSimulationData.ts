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
}

export function useSimulationData() {
    const [health, setHealth] = useState<string>('');
    const [chemistry, setChemistry] = useState<ChemistryData | null>(null);
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

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { health, chemistry, lastUpdated, stepSimulation, fetchData };
}
