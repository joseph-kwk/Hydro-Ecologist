import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';
import { Suspense } from 'react';
import WaterPlane from './WaterPlane';

interface SceneProps {
  turbidity?: number;
  algaeLevel?: number;
}

export default function Scene({ turbidity = 0, algaeLevel = 0 }: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 15, 30], fov: 60 }}
      gl={{ alpha: true, antialias: true }}
    >
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
        <pointLight position={[-10, 10, -10]} intensity={0.5} color="#4fc3f7" />

        {/* Sky and environment */}
        <Sky sunPosition={[100, 20, 100]} turbidity={8} rayleigh={2} />
        <Environment preset="sunset" />

        {/* Water with realistic shader */}
        <WaterPlane turbidity={turbidity} algaeLevel={algaeLevel} />

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={10}
          maxDistance={100}
        />

        {/* Fog for depth */}
        <fog attach="fog" args={['#87ceeb', 50, 200]} />
      </Suspense>
    </Canvas>
  );
}
