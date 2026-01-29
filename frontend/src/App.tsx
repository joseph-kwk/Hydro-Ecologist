// src/App.tsx
import Dashboard from './components/Dashboard';
import Scene from './three/Scene';
import { useSimulationData } from './hooks/useSimulationData';

function App() {
  const { chemistry } = useSimulationData();

  // Calculate turbidity and algae level from chemistry data
  const turbidity = chemistry ? Math.min(chemistry.detritus / 5, 1) : 0;
  const algaeLevel = chemistry ? Math.min(chemistry.phytoplankton / 10, 1) : 0;

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950">
      {/* Main Content */}
      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
        {/* 3D Viewport */}
        <main className="w-full lg:w-3/5 h-1/2 lg:h-full relative">
          <Scene turbidity={turbidity} algaeLevel={algaeLevel} />
          <div className="absolute bottom-4 left-4 backdrop-blur-xl bg-slate-900/80 rounded-2xl border border-white/10 px-6 py-3">
            <p className="text-sm text-gray-300">
              <span className="font-semibold text-cyan-400">3D View:</span> Interactive Marine Environment
            </p>
          </div>
        </main>

        {/* Dashboard Panel */}
        <aside className="w-full lg:w-2/5 h-1/2 lg:h-full">
          <Dashboard />
        </aside>
      </div>
    </div>
  );
}

export default App;
