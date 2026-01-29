// frontend/src/shaders/waterFragment.glsl
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

uniform float uTime;
uniform vec3 uWaterColor;
uniform vec3 uDeepWaterColor;
uniform float uTurbidity;
uniform float uAlgaeLevel;

void main() {
    // Base water color based on depth and turbidity
    vec3 baseColor = mix(uWaterColor, uDeepWaterColor, smoothstep(-5.0, -20.0, vPosition.y));
    
    // Add algae bloom effect (green tint)
    vec3 algaeColor = vec3(0.2, 0.8, 0.3);
    baseColor = mix(baseColor, algaeColor, uAlgaeLevel * 0.5);
    
    // Turbidity effect (brown/murky water)
    vec3 turbidColor = vec3(0.6, 0.5, 0.3);
    baseColor = mix(baseColor, turbidColor, uTurbidity * 0.4);
    
    // Fresnel effect for realistic water reflection
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
    
    // Add highlights and caustics
    float caustic = sin(vUv.x * 20.0 + uTime) * sin(vUv.y * 20.0 + uTime * 1.3) * 0.5 + 0.5;
    caustic = pow(caustic, 3.0) * 0.3;
    
    // Combine all effects
    vec3 finalColor = baseColor + vec3(caustic) + vec3(fresnel * 0.4);
    
    // Add transparency
    float alpha = 0.85 + fresnel * 0.15;
    
    gl_FragColor = vec4(finalColor, alpha);
}
