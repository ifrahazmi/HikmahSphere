import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Node {
  position: THREE.Vector3;
  color: THREE.Color;
}

const HeroSphere: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const nodesRef = useRef<THREE.Mesh[]>([]);
  const linesRef = useRef<THREE.LineSegments | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || window.innerHeight || 800;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 3;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Main Sphere
    const sphereGeometry = new THREE.IcosahedronGeometry(1.2, 32);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: 0x059669,
      emissive: 0x047857,
      shininess: 100,
      wireframe: false
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphereRef.current = sphere;
    scene.add(sphere);

    // Create gradient effect with vertex coloring
    const positions = sphereGeometry.attributes.position.array as Float32Array;
    const colors: number[] = [];
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      // Gradient from emerald to teal
      const r = (x + 1) / 2 * 0.05 + 0.04;
      const g = (y + 1) / 2 * 0.5 + 0.35;
      const b = (z + 1) / 2 * 0.5 + 0.35;

      colors.push(r, g, b);
    }
    sphereGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0x14b8a6, 0.5);
    pointLight2.position.set(-5, -5, 5);
    scene.add(pointLight2);

    // Create nodes around sphere
    const nodeCount = 16;
    const nodes: Node[] = [];
    const nodesMesh: THREE.Mesh[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const phi = Math.acos((2 * i) / nodeCount - 1);
      const theta = Math.sqrt(nodeCount * Math.PI) * phi;

      const x = Math.sin(phi) * Math.cos(theta) * 2.2;
      const y = Math.sin(phi) * Math.sin(theta) * 2.2;
      const z = Math.cos(phi) * 2.2;

      const nodeGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const hue = i / nodeCount;
      const nodeColor = new THREE.Color();
      nodeColor.setHSL(0.4 + hue * 0.1, 0.8, 0.5);

      const nodeMaterial = new THREE.MeshPhongMaterial({
        color: nodeColor,
        emissive: nodeColor,
        emissiveIntensity: 0.5,
        shininess: 100
      });

      const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
      nodeMesh.position.set(x, y, z);
      scene.add(nodeMesh);
      nodesMesh.push(nodeMesh);

      nodes.push({
        position: new THREE.Vector3(x, y, z),
        color: nodeColor
      });
    }
    nodesRef.current = nodesMesh;

    // Create connection lines between nodes
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions: number[] = [];
    const lineColors: number[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = nodes[i].position.distanceTo(nodes[j].position);
        if (dist < 2.5) {
          linePositions.push(
            nodes[i].position.x,
            nodes[i].position.y,
            nodes[i].position.z,
            nodes[j].position.x,
            nodes[j].position.y,
            nodes[j].position.z
          );

          const color1 = nodes[i].color;
          const color2 = nodes[j].color;
          lineColors.push(color1.r, color1.g, color1.b, color2.r, color2.g, color2.b);
        }
      }
    }

    lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lineColors), 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      opacity: 0.3,
      transparent: true,
      linewidth: 1
    });

    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    linesRef.current = lines;
    scene.add(lines);

    // Mouse tracking for rotation influence
    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    let animationId: number;
    let time = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      time += 0.002;

      // Rotate sphere
      if (sphereRef.current) {
        sphereRef.current.rotation.x += 0.0005;
        sphereRef.current.rotation.y += 0.001 + mouseRef.current.x * 0.0005;
        sphereRef.current.rotation.z += 0.0003;
      }

      // Rotate lines
      if (linesRef.current) {
        linesRef.current.rotation.copy(sphere.rotation);
      }

      // Rotate and update nodes
      nodesMesh.forEach((node, i) => {
        node.rotation.x += 0.01;
        node.rotation.y += 0.02;

        // Pulsing effect
        const scale = 1 + Math.sin(time * 3 + i) * 0.15;
        node.scale.set(scale, scale, scale);

        // Glow effect
        const material = node.material as THREE.MeshPhongMaterial;
        if (material.emissiveIntensity) {
          material.emissiveIntensity = 0.5 + Math.sin(time * 2 + i) * 0.3;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      const newWidth = containerRef.current?.clientWidth || width;
      const newHeight = containerRef.current?.clientHeight || height;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    const container = containerRef.current;
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      container?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center"
      style={{ background: 'transparent' }}
    />
  );
};

export default HeroSphere;
