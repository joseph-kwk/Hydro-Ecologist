// frontend/src/shaders/waterVertex.glsl
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

uniform float uTime;
uniform float uWaveAmplitude;
uniform float uWaveFrequency;

void main() {
    vUv = uv;
    vPosition = position;
    
    // Create realistic wave motion
    float wave1 = sin(position.x * uWaveFrequency + uTime) * uWaveAmplitude;
    float wave2 = sin(position.z * uWaveFrequency * 1.3 + uTime * 1.1) * uWaveAmplitude * 0.8;
    float wave3 = cos(position.x * uWaveFrequency * 0.7 + position.z * uWaveFrequency * 0.7 + uTime * 0.9) * uWaveAmplitude * 0.5;
    
    vec3 newPosition = position;
    newPosition.y += wave1 + wave2 + wave3;
    
    // Calculate normal for lighting
    float dx = cos(position.x * uWaveFrequency + uTime) * uWaveAmplitude * uWaveFrequency;
    float dz = cos(position.z * uWaveFrequency * 1.3 + uTime * 1.1) * uWaveAmplitude * 0.8 * uWaveFrequency * 1.3;
    vNormal = normalize(vec3(-dx, 1.0, -dz));
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
