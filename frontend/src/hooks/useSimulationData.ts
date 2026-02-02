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

// Regulatory compliance data
interface RegulatoryCompliance {
    compliant: boolean;
    violations: Array<{
        parameter: string;
        value: number;
        threshold: number | string;
        severity: string;
    }>;
    impairment_category: string;
    consecutive_violations: number;
    tmdl_status: Array<{
        parameter: string;
        current_load: number;
        tmdl_limit: number;
        compliance: boolean;
        reduction_needed: number;
    }>;
}

interface TargetProfileSummary {
    id: string;
    name: string;
    description: string;
    grid_shape: [number, number] | number[];
    domain_size: [number, number] | number[];
    waterbody_type: string;
    mean_depth_m?: number;
    eddy_viscosity_m2_s?: number;
    baseline?: Record<string, number>;
}

interface TargetListResponse {
    active_target: string;
    targets: TargetProfileSummary[];
}

interface SelectTargetResponse {
    message?: string;
    active_target?: string;
    profile?: TargetProfileSummary;
    error?: string;
    available?: string[];
}

interface LessonSummary {
    id: string;
    target_id: string;
    name: string;
    description: string;
}

interface LessonListResponse {
    target_id?: string | null;
    lessons: LessonSummary[];
}

interface RunLessonResponse {
    error?: string;
    message?: string;
    lesson?: LessonSummary;
    active_target?: string;
    status?: any;
}

export function useSimulationData() {
    const [health, setHealth] = useState<string>('');
    const [chemistry, setChemistry] = useState<ChemistryData | null>(null);
    const [spatialGrid, setSpatialGrid] = useState<SpatialGridData | null>(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const [isFetchingData, setIsFetchingData] = useState(false);
    const [isStepping, setIsStepping] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isFetchingSpatial, setIsFetchingSpatial] = useState(false);

    const [dataError, setDataError] = useState<string | null>(null);
    const [spatialError, setSpatialError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsFetchingData(true);
        setDataError(null);
        try {
            const healthRes = await axios.get<{ health_status: string }>(`${API_BASE_URL}/status/health`);
            setHealth(healthRes.data.health_status);

            const chemistryRes = await axios.get<ChemistryData>(`${API_BASE_URL}/status/chemistry`);
            setChemistry(chemistryRes.data);
            
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Failed to fetch simulation data:", error);
            setHealth("Error: Could not connect to backend.");
            setDataError("Could not connect to backend (is FastAPI running on http://127.0.0.1:8000?).");
        } finally {
            setIsFetchingData(false);
        }
    }, []);

    const [targets, setTargets] = useState<TargetProfileSummary[]>([]);
    const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
    const [activeTarget, setActiveTarget] = useState<TargetProfileSummary | null>(null);
    const [isFetchingTargets, setIsFetchingTargets] = useState(false);
    const [targetError, setTargetError] = useState<string | null>(null);

    const [lessons, setLessons] = useState<LessonSummary[]>([]);
    const [isFetchingLessons, setIsFetchingLessons] = useState(false);
    const [isRunningLesson, setIsRunningLesson] = useState(false);
    const [lessonError, setLessonError] = useState<string | null>(null);

    const fetchTargets = useCallback(async () => {
        setIsFetchingTargets(true);
        setTargetError(null);
        try {
            const res = await axios.get<TargetListResponse>(`${API_BASE_URL}/targets`);
            setTargets(res.data.targets);
            setActiveTargetId(res.data.active_target);

            const active = res.data.targets.find((t) => t.id === res.data.active_target) ?? null;
            setActiveTarget(active);
        } catch (error) {
            console.error('Failed to fetch targets:', error);
            setTargetError('Failed to fetch target profiles.');
        } finally {
            setIsFetchingTargets(false);
        }
    }, []);

    const selectTarget = useCallback(
        async (targetId: string) => {
            setTargetError(null);
            try {
                const res = await axios.post<SelectTargetResponse>(`${API_BASE_URL}/targets/select?target_id=${encodeURIComponent(targetId)}`);
                if (res.data.error) {
                    setTargetError(res.data.error);
                    return false;
                }
                setActiveTargetId(res.data.active_target ?? targetId);
                if (res.data.profile) {
                    setActiveTarget(res.data.profile);
                }
                // Refresh after target reset
                await fetchData();
                return true;
            } catch (error) {
                console.error('Failed to select target:', error);
                setTargetError('Failed to switch target.');
                return false;
            }
        },
        [fetchData]
    );

    const fetchLessons = useCallback(async (targetId?: string | null) => {
        setIsFetchingLessons(true);
        setLessonError(null);
        try {
            const url = targetId
                ? `${API_BASE_URL}/lessons?target_id=${encodeURIComponent(targetId)}`
                : `${API_BASE_URL}/lessons`;
            const res = await axios.get<LessonListResponse>(url);
            setLessons(res.data.lessons);
        } catch (error) {
            console.error('Failed to fetch lessons:', error);
            setLessonError('Failed to load lesson presets.');
        } finally {
            setIsFetchingLessons(false);
        }
    }, []);

    const runLesson = useCallback(
        async (lessonId: string) => {
            setIsRunningLesson(true);
            setLessonError(null);
            try {
                const res = await axios.post<RunLessonResponse>(
                    `${API_BASE_URL}/lessons/run?lesson_id=${encodeURIComponent(lessonId)}`
                );
                if (res.data.error) {
                    setLessonError(res.data.error);
                    return null;
                }
                if (res.data.active_target) {
                    setActiveTargetId(res.data.active_target);
                }
                // Refresh displayed values after lesson application
                await fetchData();
                return res.data;
            } catch (error) {
                console.error('Failed to run lesson:', error);
                setLessonError('Failed to run lesson.');
                return null;
            } finally {
                setIsRunningLesson(false);
            }
        },
        [fetchData]
    );

    const stepSimulation = useCallback(async () => {
        setIsStepping(true);
        try {
            await axios.post(`${API_BASE_URL}/simulation/step`);
            // After stepping, refresh the data
            await fetchData();
        } catch (error) {
            console.error("Failed to step simulation:", error);
        } finally {
            setIsStepping(false);
        }
    }, [fetchData]);

    const resetSimulation = useCallback(async () => {
        setIsResetting(true);
        try {
            await axios.post(`${API_BASE_URL}/simulation/reset`);
            await fetchData();
        } catch (error) {
            console.error("Failed to reset simulation:", error);
        } finally {
            setIsResetting(false);
        }
    }, [fetchData]);

    const injectParameters = useCallback(async (nutrient: number, pollutant: number) => {
        try {
            await axios.post(`${API_BASE_URL}/simulation/inject?nutrient=${nutrient}&pollutant=${pollutant}`);
            await fetchData();
        } catch (error) {
            console.error("Failed to inject parameters:", error);
        }
    }, [fetchData]);

    const fetchSpatialGrid = useCallback(async (parameter: string = 'dissolved_oxygen', downsample: number = 4) => {
        setIsFetchingSpatial(true);
        setSpatialError(null);
        try {
            const response = await axios.get<SpatialGridData>(
                `${API_BASE_URL}/status/chemistry/grid?parameter=${parameter}&downsample=${downsample}`
            );
            setSpatialGrid(response.data);
        } catch (error) {
            console.error("Failed to fetch spatial grid:", error);
            setSpatialError('Failed to fetch spatial grid.');
        } finally {
            setIsFetchingSpatial(false);
        }
    }, []);
    
    const toggleMarineHeatwave = useCallback(async (activate: boolean, intensity: number = 3.5) => {
        try {
            await axios.post(`${API_BASE_URL}/simulation/heatwave?activate=${activate}&intensity=${intensity}`);
            await fetchData();
        } catch (error) {
            console.error("Failed to toggle marine heatwave:", error);
        }
    }, [fetchData]);
    
    const deployRemediation = useCallback(async (x: number, y: number, radius: number, type: string, intensity: number = 1.0) => {
        try {
            await axios.post(`${API_BASE_URL}/remediation/deploy`, null, {
                params: { x, y, radius, intervention_type: type, intensity }
            });
            return true;
        } catch (error) {
            console.error("Failed to deploy remediation:", error);
            return false;
        }
    }, []);
    
    const getRemediationSummary = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/remediation/summary`);
            return response.data;
        } catch (error) {
            console.error("Failed to fetch remediation summary:", error);
            return null;
        }
    }, []);
    
    const getRegulatoryCompliance = useCallback(async () => {
        try {
            const response = await axios.get<RegulatoryCompliance>(`${API_BASE_URL}/regulatory/compliance`);
            return response.data;
        } catch (error) {
            console.error("Failed to fetch regulatory compliance:", error);
            return null;
        }
    }, []);
    
    const getRegulatoryHistory = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/regulatory/summary`);
            return response.data;
        } catch (error) {
            console.error("Failed to fetch regulatory history:", error);
            return null;
        }
    }, []);

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

    useEffect(() => {
        fetchTargets();
    }, [fetchTargets]);

    useEffect(() => {
        fetchLessons(activeTargetId);
    }, [activeTargetId, fetchLessons]);

    return { 
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
        fetchTargets,
        selectTarget,
        lessons,
        isFetchingLessons,
        isRunningLesson,
        lessonError,
        fetchLessons,
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
        exportData 
    };
}
