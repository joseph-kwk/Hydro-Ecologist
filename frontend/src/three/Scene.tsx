import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';

function WaterPlane() {
    // Placeholder for the dynamic water shader
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
            <planeGeometry args={[100, 100, 50, 50]} />
            <meshStandardMaterial color="#1e90ff" wireframe />
        </mesh>
    );
}

export default function Scene() {
    return (
        <Canvas camera={{ position: [0, 5, 15], fov: 60 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <Stars />
            <WaterPlane />
            <OrbitControls />
        </Canvas>
    );
}
