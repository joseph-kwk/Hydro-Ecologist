// src/App.tsx
import Dashboard from './components/Dashboard';
import Scene from './three/Scene';

function App() {
  return (
    <div className="w-screen h-screen flex flex-col bg-gray-900">
      <header className="p-2 bg-gray-900 border-b border-gray-700 text-center">
        <h1 className="text-xl font-bold text-white">Project: Hydro-Ecologist</h1>
      </header>
      
      <div className="flex-grow flex flex-col md:flex-row">
        {/* 3D Viewport */}
        <main className="w-full md:w-2/3 h-1/2 md:h-full bg-black">
          <Scene />
        </main>

        {/* Dashboard Panel */}
        <aside className="w-full md:w-1/3 h-1/2 md:h-full overflow-y-auto border-l border-gray-700">
          <Dashboard />
        </aside>
      </div>
    </div>
  );
}

export default App;
