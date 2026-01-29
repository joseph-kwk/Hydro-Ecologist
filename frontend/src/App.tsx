// src/App.tsx
import React, { useEffect, useState } from 'react';
import Scene from './three/Scene';
import TopBar from './components/TopBar';
import BottomControlPanel from './components/BottomControlPanel';
import { useSimulationData } from './hooks/useSimulationData';

function App() {
  const {
    chemistry,
    fetchData,
    stepSimulation,
    resetSimulation,
    injectParameters,
    exportData,
  } = useSimulationData();

  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [health, setHealth] = useState('Pristine Waters');

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-play logic
  useEffect(() => {
    if (isAutoPlay) {
      const interval = setInterval(() => {
        stepSimulation();
        setElapsedTime((t) => t + 1);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isAutoPlay, stepSimulation]);

  // Update history and health status
  useEffect(() => {
    if (chemistry) {
      setHistory((prev) => [
        ...prev.slice(-19),
        {
          time: prev.length,
          do: chemistry.dissolved_oxygen,
          nutrients: chemistry.nutrient,
          phyto: chemistry.phytoplankton,
          zoo: chemistry.zooplankton,
        },
      ]);

      // Update health status
      if (chemistry.dissolved_oxygen < 2) {
        setHealth('Hypoxic Collapse');
      } else if (chemistry.dissolved_oxygen < 4) {
        setHealth('Polluted Waters');
      } else if (chemistry.nutrient > 15) {
        setHealth('Eutrophic State');
      } else if (chemistry.phytoplankton > 8) {
        setHealth('Algae Bloom');
      } else {
        setHealth('Pristine Waters');
      }
    }
  }, [chemistry]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        stepSimulation();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        setIsAutoPlay((prev) => !prev);
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        fetchData();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [stepSimulation, fetchData]);

  // Calculate turbidity and algae level
  const turbidity = chemistry ? Math.min(chemistry.detritus / 10, 1) : 0;
  const algaeLevel = chemistry ? Math.min(chemistry.phytoplankton / 10, 1) : 0;

  // Handle presets
  const handlePreset = async (preset: string) => {
    await resetSimulation();
    setHistory([]);
    setElapsedTime(0);
    
    setTimeout(async () => {
      switch (preset) {
        case 'urban':
          await injectParameters(10, 5);
          break;
        case 'algae':
          await injectParameters(15, 2);
          break;
        case 'polluted':
          await injectParameters(8, 8);
          break;
        default: // pristine
          break;
      }
    }, 500);
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 overflow-hidden relative">
      {/* Full-screen water */}
      <Scene turbidity={turbidity} algaeLevel={algaeLevel} />

      {/* Top bar */}
      <TopBar health={health} chemistry={chemistry} isAutoPlay={isAutoPlay} elapsedTime={elapsedTime} />

      {/* Bottom control panel */}
      <BottomControlPanel
        chemistry={chemistry}
        history={history}
        isAutoPlay={isAutoPlay}
        onToggleAutoPlay={() => setIsAutoPlay((prev) => !prev)}
        onStep={stepSimulation}
        onReset={() => {
          resetSimulation();
          setHistory([]);
          setElapsedTime(0);
        }}
        onExport={exportData}
        onInject={injectParameters}
        onPreset={handlePreset}
      />
    </div>
  );
}

export default App;
