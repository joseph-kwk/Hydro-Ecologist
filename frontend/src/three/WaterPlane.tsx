import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface WaterPlaneProps {
  turbidity?: number;
  algaeLevel?: number;
}

export default function WaterPlane({ turbidity = 0, algaeLevel = 0 }: WaterPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWaveAmplitude: { value: 0.3 },
      uWaveFrequency: { value: 0.5 },
      uWaterColor: { value: new THREE.Color(0x0077be) },
      uDeepWaterColor: { value: new THREE.Color(0x003d5c) },
      uTurbidity: { value: turbidity },
      uAlgaeLevel: { value: algaeLevel },
    }),
    [turbidity, algaeLevel]
  );

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    
    uniform float uTime;
    uniform float uWaveAmplitude;
    uniform float uWaveFrequency;
    
    void main() {
        vUv = uv;
        vPosition = position;
        
        float wave1 = sin(position.x * uWaveFrequency + uTime) * uWaveAmplitude;
        float wave2 = sin(position.z * uWaveFrequency * 1.3 + uTime * 1.1) * uWaveAmplitude * 0.8;
        float wave3 = cos(position.x * uWaveFrequency * 0.7 + position.z * uWaveFrequency * 0.7 + uTime * 0.9) * uWaveAmplitude * 0.5;
        
        vec3 newPosition = position;
        newPosition.y += wave1 + wave2 + wave3;
        
        float dx = cos(position.x * uWaveFrequency + uTime) * uWaveAmplitude * uWaveFrequency;
        float dz = cos(position.z * uWaveFrequency * 1.3 + uTime * 1.1) * uWaveAmplitude * 0.8 * uWaveFrequency * 1.3;
        vNormal = normalize(vec3(-dx, 1.0, -dz));
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `;

  const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    
    uniform float uTime;
    uniform vec3 uWaterColor;
    uniform vec3 uDeepWaterColor;
    uniform float uTurbidity;
    uniform float uAlgaeLevel;
    
    void main() {
        vec3 baseColor = mix(uWaterColor, uDeepWaterColor, smoothstep(-5.0, -20.0, vPosition.y));
        
        vec3 algaeColor = vec3(0.2, 0.8, 0.3);
        baseColor = mix(baseColor, algaeColor, uAlgaeLevel * 0.5);
        
        vec3 turbidColor = vec3(0.6, 0.5, 0.3);
        baseColor = mix(baseColor, turbidColor, uTurbidity * 0.4);
        
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
        
        float caustic = sin(vUv.x * 20.0 + uTime) * sin(vUv.y * 20.0 + uTime * 1.3) * 0.5 + 0.5;
        caustic = pow(caustic, 3.0) * 0.3;
        
        vec3 finalColor = baseColor + vec3(caustic) + vec3(fresnel * 0.4);
        
        float alpha = 0.85 + fresnel * 0.15;
        
        gl_FragColor = vec4(finalColor, alpha);
    }
  `;

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime * 0.5;
      material.uniforms.uTurbidity.value = turbidity;
      material.uniforms.uAlgaeLevel.value = algaeLevel;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[200, 200, 256, 256]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
