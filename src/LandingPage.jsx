import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Avatar } from './Avatar';
import './LandingPage.css';
import defaultCalibrations from './calibrations.json';

// Base64 silent 2-second WAV file to drive the HTML5 Audio element for mock lip-sync
const SILENT_WAV = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";

// Smooth lerp helper
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

// General array-based linear spline interpolator for any number of segments
const getInterpolatedValue = (vals, progress) => {
  const index = Math.floor(progress);
  const fraction = progress - index;
  if (index >= vals.length - 1) return vals[vals.length - 1];
  if (index < 0) return vals[0];
  return lerp(vals[index], vals[index + 1], fraction);
};

// 3D Scene Manager: Dynamically updates Camera and Avatar based on Scroll progress
function LandingSceneManager({ scrollProgress, calibrationMode, currentActiveSection, children }) {
  const smoothScroll = useRef(scrollProgress.current);

  useFrame((state, delta) => {
    const progress = scrollProgress.current;

    // Smooth the scroll progress
    const speed = 4.5;
    smoothScroll.current = THREE.MathUtils.lerp(
      smoothScroll.current,
      progress,
      1 - Math.exp(-speed * delta)
    );

    // Freeze camera frame to active section if in placement calibration mode
    // On mobile/tablet, freeze at index 0 (Hero view) to keep it static
    const activeProgress = window.innerWidth < 1024
      ? 0
      : (calibrationMode
          ? Math.min(10, Math.max(0, currentActiveSection))
          : smoothScroll.current);

    // 1. Camera Positions per Section (11 milestones for 11 sections)
    let camX = getInterpolatedValue([0.28, -0.15, 0.12, -0.28, 0.28, -0.24, 0.0, -0.22, 0.22, -0.20, 0.0], activeProgress);
    const camY = getInterpolatedValue([0.12, 0.46, -0.15, 0.08, -0.05, 0.06, 0.0, 0.05, -0.05, 0.05, 0.0], activeProgress);
    const camZ = getInterpolatedValue([1.35, 0.65, 1.85, 1.15, 1.50, 1.22, 1.55, 1.40, 1.50, 1.45, 1.60], activeProgress);

    // 2. Camera LookAt targets per Section
    let targetX = getInterpolatedValue([0.28, -0.15, 0.12, -0.28, 0.28, -0.24, 0.0, -0.22, 0.22, -0.20, 0.0], activeProgress);
    const targetY = getInterpolatedValue([0.06, 0.46, -0.15, 0.08, -0.05, 0.06, 0.0, 0.05, -0.05, 0.05, 0.0], activeProgress);
    const targetZ = getInterpolatedValue([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], activeProgress);

    if (window.innerWidth < 1024) {
      camX = 0;
      targetX = 0;
    }

    state.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.12);
    state.camera.lookAt(new THREE.Vector3(targetX, targetY, targetZ));
  });

  return <>{children}</>;
}

// Sub-component to manage Avatar scaling and positional layouts per Section
function AvatarWrapper({ scrollProgress, modelPath, calibrations, calibrationMode, currentActiveSection, ...props }) {
  const avatarRef = useRef();
  const smoothScroll = useRef(scrollProgress.current);

  useFrame((state, delta) => {
    if (!avatarRef.current) return;
    const progressVal = scrollProgress.current;

    // Smooth the scroll progress
    const speed = 4.5;
    smoothScroll.current = THREE.MathUtils.lerp(
      smoothScroll.current,
      progressVal,
      1 - Math.exp(-speed * delta)
    );

    const progress = smoothScroll.current;
    const { width: viewportWidth } = state.viewport;

    let posX, posY, posZ, rotY, scale;
    
    // If on mobile/tablet, freeze spline coordinate extraction at index 0 (Hero view) to keep it static
    const activeProgressVal = window.innerWidth < 1024 ? 0 : progress;

    if (calibrationMode && window.innerWidth >= 1024) {
      // Direct real-time mapping to calibrated values of active section
      const activeSec = Math.min(10, Math.max(0, currentActiveSection));
      const config = calibrations[activeSec];
      posX = viewportWidth * config.posXPercent;
      posY = config.posY;
      posZ = config.posZ;
      rotY = config.rotY;
      scale = config.scale;
    } else {
      // Dynamic scroll spline interpolation using calibration array milestones
      posX = getInterpolatedValue(calibrations.map(c => viewportWidth * c.posXPercent), activeProgressVal);
      posY = getInterpolatedValue(calibrations.map(c => c.posY), activeProgressVal);
      posZ = getInterpolatedValue(calibrations.map(c => c.posZ), activeProgressVal);
      rotY = getInterpolatedValue(calibrations.map(c => c.rotY), activeProgressVal);
      scale = getInterpolatedValue(calibrations.map(c => c.scale), activeProgressVal);
    }

    // Responsive position and scale adjustments for tablets & mobile phones
    if (window.innerWidth < 1024) {
      posX = 0; // Keep avatar always centered
      rotY = 0; // Force avatar to face straight forward towards the user front
      
      const isMobile = window.innerWidth < 768;
      const isShortMobile = isMobile && window.innerHeight < 700;
      
      // Scale down avatar so it fits the smaller aspect ratio screen
      const scaleMultiplier = isMobile ? (isShortMobile ? 0.45 : 0.55) : 0.72;
      scale = scale * scaleMultiplier;

      // Adjust height offset so avatar head remains visible and framed nicely
      const posYOffset = isMobile ? -0.15 : -0.05;
      posY = posY + posYOffset;
    }

    avatarRef.current.position.lerp(new THREE.Vector3(posX, posY, posZ), 0.12);
    avatarRef.current.rotation.y = THREE.MathUtils.lerp(avatarRef.current.rotation.y, rotY, 0.12);
    avatarRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.12);
  });

  return (
    <group ref={avatarRef}>
      <Avatar modelPath={modelPath} {...props} />
    </group>
  );
}

// Floating individual shape with local bursting animation states
function FloatingShape({ cfg, mousePos, scrollProgress, onBurst }) {
  const meshRef = useRef();
  const sparklesGroupRef = useRef();
  const [bursting, setBursting] = useState(false);
  const burstProgress = useRef(0);
  const [sparkles, setSparkles] = useState([]);
  const smoothScroll = useRef(scrollProgress.current);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    const progressVal = scrollProgress.current;

    // Smooth scroll progress
    const speed = 4.5;
    smoothScroll.current = THREE.MathUtils.lerp(
      smoothScroll.current,
      progressVal,
      1 - Math.exp(-speed * delta)
    );

    const progress = smoothScroll.current;

    if (bursting) {
      burstProgress.current += delta;
      const totalDuration = 0.85; // 850ms total sequence for dramatic sparkles
      const t = Math.min(1.0, burstProgress.current / totalDuration);

      if (t >= 1.0) {
        setBursting(false);
        setSparkles([]);
        burstProgress.current = 0;
        onBurst(cfg.id); // notify parent to replace this shape
        return;
      }

      // 1. Explode scale and fade out the main shape (completes in 180ms)
      if (meshRef.current) {
        const shapeT = Math.min(1.0, burstProgress.current / 0.18);
        const currentScale = cfg.scale * (1.0 + shapeT * 3.5);
        meshRef.current.scale.set(currentScale, currentScale, currentScale);
        meshRef.current.material.opacity = 1.0 - shapeT;
        meshRef.current.material.transmission = (1.0 - shapeT) * 0.9;
        if (shapeT >= 1.0) {
          meshRef.current.scale.set(0, 0, 0); // Hide completely
        }
      }

      // 2. Animate the sparkles group
      if (sparklesGroupRef.current && sparklesGroupRef.current.children.length > 0) {
        const gravity = 2.4; // gravity pulling sparkles down
        sparklesGroupRef.current.children.forEach((child, idx) => {
          const p = sparkles[idx];
          if (!p) return;

          // 3D dispersion with gravity
          child.position.x = p.vx * t;
          child.position.y = p.vy * t - 0.5 * gravity * t * t;
          child.position.z = p.vz * t;

          // Spin, shrink and fade out
          child.rotation.x += delta * 4;
          child.rotation.y += delta * 4;

          const size = p.scale * (1.0 - t);
          child.scale.set(size, size, size);

          if (child.material) {
            child.material.opacity = 1.0 - t;
          }
        });
      }
      return;
    }

    if (!meshRef.current) return;

    // Normal floating motion
    const floatOffset = Math.sin(elapsed * 0.8 + cfg.id * 1.5) * 0.08;
    meshRef.current.position.y = cfg.baseY + floatOffset;

    // Gentle rotation
    meshRef.current.rotation.x = elapsed * 0.15 + cfg.id;
    meshRef.current.rotation.y = elapsed * 0.2 + cfg.id * 0.5;

    // Parallax depth scroll
    meshRef.current.position.z = cfg.baseZ + progress * 0.04;

    // Mouse tracking drift
    const targetX = cfg.baseX + mousePos.x * 0.15;
    const targetY = cfg.baseY + floatOffset + mousePos.y * 0.15;
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetX, 0.05);
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.05);

    // Keep scale and opacity normal
    meshRef.current.scale.set(cfg.scale, cfg.scale, cfg.scale);
    meshRef.current.material.opacity = 1.0;
    meshRef.current.material.transmission = 0.9;
  });

  let geometry;
  if (cfg.type === 'torusKnot') {
    geometry = <torusKnotGeometry args={[0.5, 0.15, 100, 16]} />;
  } else if (cfg.type === 'sphere') {
    geometry = <sphereGeometry args={[0.6, 32, 32]} />;
  } else if (cfg.type === 'box') {
    geometry = <boxGeometry args={[0.7, 0.7, 0.7]} />;
  } else {
    geometry = <torusGeometry args={[0.5, 0.15, 16, 100]} />;
  }

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[cfg.baseX, cfg.baseY, cfg.baseZ]}
        onClick={(e) => {
          e.stopPropagation();
          if (!bursting) {
            // Generate 35 dramatic random sparkles flying in all directions
            const count = 35;
            const temp = [];
            for (let i = 0; i < count; i++) {
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos(Math.random() * 2 - 1);
              // Speed between 0.6 and 2.6
              const speed = 0.6 + Math.random() * 2.0;
              const vx = Math.sin(phi) * Math.cos(theta) * speed;
              const vy = Math.sin(phi) * Math.sin(theta) * speed;
              const vz = Math.cos(phi) * speed;

              temp.push({
                id: i,
                vx,
                vy,
                vz,
                scale: 0.5 + Math.random() * 0.7,
                color: Math.random() > 0.45 ? cfg.color : (Math.random() > 0.5 ? '#ffffff' : '#fbbf24'),
              });
            }

            // Sync the sparkles group position to the shape's current visual position
            if (meshRef.current && sparklesGroupRef.current) {
              sparklesGroupRef.current.position.copy(meshRef.current.position);
            }

            setSparkles(temp);
            setBursting(true);
            burstProgress.current = 0;
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'default';
        }}
      >
        {geometry}
        <meshPhysicalMaterial
          transmission={0.9}
          roughness={0.12}
          metalness={0.1}
          thickness={0.4}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          transparent={true}
          color={cfg.color}
        />
      </mesh>

      <group ref={sparklesGroupRef}>
        {sparkles.map((p) => (
          <mesh key={p.id}>
            <sphereGeometry args={[0.016, 5, 5]} />
            <meshBasicMaterial
              color={p.color}
              transparent={true}
              opacity={1}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// Floating glassmorphic shapes reacting to scroll and cursor movement
function FloatingBackgroundShapes({ scrollProgress, mousePos }) {
  const [shapes, setShapes] = useState([
    { id: 0, type: 'torusKnot', scale: 0.12, baseX: -0.7, baseY: 0.4, baseZ: -0.5, color: '#8f94fb' },
    { id: 1, type: 'sphere', scale: 0.08, baseX: 0.8, baseY: -0.3, baseZ: -0.7, color: '#34d399' },
    { id: 2, type: 'box', scale: 0.07, baseX: -0.6, baseY: -0.4, baseZ: -0.6, color: '#ff007f' },
    { id: 3, type: 'torus', scale: 0.1, baseX: 0.7, baseY: 0.5, baseZ: -0.4, color: '#00f0ff' }
  ]);

  const handleBurstShape = (id) => {
  const shapeTypes = ['torusKnot', 'sphere', 'box', 'torus'];
  const colors = ['#8f94fb', '#34d399', '#ff007f', '#00f0ff', '#fbbf24', '#a78bfa'];
  
  const randomType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  
  const side = Math.random() > 0.5 ? 1 : -1;
  const randomX = (0.55 + Math.random() * 0.35) * side; 
  const randomY = -0.55 + Math.random() * 1.1; 
  const randomScale = 0.06 + Math.random() * 0.08;

  document.body.style.cursor = 'default';

  setShapes(prev => prev.map(s => {
    if (s.id === id) {
      return {
        id: Date.now() + Math.random(),
        type: randomType,
        scale: randomScale,
        baseX: randomX,
        baseY: randomY,
        baseZ: -0.4 - Math.random() * 0.4,
        color: randomColor
      };
    }
    return s;
  }));
};

return (
  <group>
    {shapes.map(cfg => (
      <FloatingShape
        key={cfg.id}
        cfg={cfg}
        mousePos={mousePos}
        scrollProgress={scrollProgress}
        onBurst={handleBurstShape}
      />
    ))}
  </group>
);
}

// Data powering the interactive Emotion Engine product demo showcase
const emotionDemoData = [
{
  id: 'happy',
  name: 'Happy',
  features: 'Mouth corners raised, cheek puff, brow raised',
  subsystem: 'Emotion Engine',
  latency: '24ms',
  capability: 'Real-Time Expression Rendering'
},
{
  id: 'excited',
  name: 'Excited',
  features: 'Wide smile, open jaw, elevated eyes, inner brows raised',
  subsystem: 'Sentiment Detection',
  latency: '28ms',
  capability: 'Emotion Mapping'
},
{
  id: 'surprised',
  name: 'Surprised',
  features: 'Inner brows raised, eyes wide, jaw drop',
  subsystem: 'Affective System',
  latency: '20ms',
  capability: 'Blendshape Generation'
},
{
  id: 'thinking',
  name: 'Thinking',
  features: 'Brows knitted, eye squint, mouth dimples compressed',
  subsystem: 'Cognitive Parser',
  latency: '32ms',
  capability: 'Real-Time Expression Rendering'
},
{
  id: 'confused',
  name: 'Confused',
  features: 'Asymmetric brows, eye squint, slight mouth frown',
  subsystem: 'Sentiment Parsing',
  latency: '26ms',
  capability: 'Emotion Mapping'
},
{
  id: 'sad',
  name: 'Sad',
  features: 'Inner brows raised, lips puckered, eyes slightly blinked',
  subsystem: 'Emotion Engine',
  latency: '25ms',
  capability: 'Real-Time Expression Rendering'
},
{
  id: 'angry',
  name: 'Angry',
  features: 'Brows down & in, eyes wide, mouth compressed',
  subsystem: 'Affective System',
  latency: '22ms',
  capability: 'Blendshape Generation'
},
{
  id: 'neutral',
  name: 'Neutral',
  features: 'Baseline resting posture, calm eyes, relaxed jaw',
  subsystem: 'Resting State',
  latency: '12ms',
  capability: 'Real-Time Expression Rendering'
}
];

// Data powering the interactive Gesture System product demo showcase
const gestureDemoData = [
{
  id: 'hello',
  title: 'Greeting',
  desc: 'Creates a welcoming first impression.',
  subsystem: 'Gesture Engine',
  latency: '18ms',
  asset: 'Wave.glb'
},
{
  id: 'thumbsUp',
  title: 'Thumbs Up',
  desc: 'Signals alignment and positive reinforcement.',
  subsystem: 'Gesture Engine',
  latency: '16ms',
  asset: 'ThumbsUp.glb'
},
{
  id: 'nodding',
  title: 'Nodding',
  desc: 'Signals understanding and active listening.',
  subsystem: 'Kinetic Motor Engine',
  latency: '22ms',
  asset: 'Procedural Nod'
},
{
  id: 'shrugging',
  title: 'Shrugging',
  desc: 'Expresses uncertainty or cognitive load naturally.',
  subsystem: 'Gesture Engine',
  latency: '24ms',
  asset: 'shrugging.glb'
},
{
  id: 'lookingAround',
  title: 'Looking Around',
  desc: 'Demonstrates environmental scanning and spatial attention.',
  subsystem: 'Spatial Steering Engine',
  latency: '20ms',
  asset: 'LookingAround.glb'
},
{
  id: 'clapping',
  title: 'Clapping',
  desc: 'Provides celebratory or appreciative feedback.',
  subsystem: 'Gesture Engine',
  latency: '28ms',
  asset: 'clapping.glb'
},
{
  id: 'listening',
  title: 'Listening Pose',
  desc: 'Indicates focused attention on user query input.',
  subsystem: 'Attention Engine',
  latency: '15ms',
  asset: 'listening.glb'
}
];

export default function LandingPage({ navigateTo, modelPath, setModelPath }) {
  const [scrollState, setScrollState] = useState(0);
  const scrollRef = useRef(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Live 3D Placement Calibration States (11 milestones for 11 sections)
  const LOCAL_STORAGE_KEY = 'facial_expressions_landing_calibrations_v2';

  const [calibrations, setCalibrations] = useState(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // If the cached calibrations array is smaller (e.g. from an older version of the page),
          // pad the missing sections using the factory default values to prevent crashes.
          if (parsed.length < defaultCalibrations.length) {
            const merged = [...parsed];
            for (let i = parsed.length; i < defaultCalibrations.length; i++) {
              merged.push(defaultCalibrations[i]);
            }
            return merged;
          }
          return parsed;
        }
      } catch (e) { }
    }
    return defaultCalibrations;
  });

  const [calibrationMode, setCalibrationMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const activeSec = Math.min(10, Math.max(0, Math.round(scrollState)));

  const handleCalibrateChange = (key, value) => {
    setCalibrations(prev => {
      const next = [...prev];
      next[activeSec] = {
        ...next[activeSec],
        [key]: value
      };
      return next;
    });
  };

  const handleSaveCalibrations = () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(calibrations));
    setSaveStatus('Persistent Save Complete! 💾');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleResetCalibrations = () => {
    if (window.confirm("Reset all coordinates to factory defaults?")) {
      setCalibrations(defaultCalibrations);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setSaveStatus('Reset Completed! 🔄');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleDownloadCalibrationsJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(calibrations, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "calibrations.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setSaveStatus('JSON File Downloaded! 📥');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  // Interactive Section States
  const [heroGesture, setHeroGesture] = useState('none');
  const [heroEmotion, setHeroEmotion] = useState({ neutral: 1.0 });
  const [activeEmotion, setActiveEmotion] = useState('neutral');
  const [currentGesture, setCurrentGesture] = useState('none');

  // Dance & Inactivity Tracker for Hero Section (Section 1)
  const [isDancing, setIsDancing] = useState(false);
  const [lastInteractionTime, setLastInteractionTime] = useState(Date.now());
  const pageMountTime = useRef(Date.now());
  const randomDanceRef = useRef('silly_dancing');

  // Trigger initial friendly greeting on first load / mount
  useEffect(() => {
    setHeroGesture('hello');
    setHeroEmotion({ kind: 0.6, happy: 0.4 }); // friendly small smile blend

    const timer = setTimeout(() => {
      setHeroGesture('none');
      setHeroEmotion({ neutral: 1.0 });
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  // Activity listeners to reset inactivity timers
  useEffect(() => {
    const resetTimer = () => {
      setLastInteractionTime(Date.now());

      // If we are currently dancing, interrupt it immediately and return to normal with a warm smile!
      if (isDancing) {
        setIsDancing(false);
        setHeroGesture('none');
        setHeroEmotion({ kind: 0.8, happy: 0.2 }); // warm smile

        // Return to neutral after 3 seconds of warm smile
        setTimeout(() => {
          setHeroEmotion({ neutral: 1.0 });
        }, 3000);
      }
    };

    window.addEventListener('scroll', resetTimer, { passive: true });
    window.addEventListener('touchstart', resetTimer, { passive: true });
    window.addEventListener('mousemove', resetTimer, { passive: true });
    window.addEventListener('click', resetTimer, { passive: true });

    return () => {
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [isDancing]);

  // Main inactivity checker hook
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceInteraction = now - lastInteractionTime;

      // Only qualify if in Section 1 (Hero scroll < 0.6)
      const inHeroSection = scrollRef.current < 0.6;

      // Initial Greeting lasts 4 seconds, so we start checking after that.
      // We trigger the dance moves if there is no interaction for 10 seconds (10000ms) while in the Hero section and not already dancing
      if (inHeroSection && !isDancing && timeSinceInteraction >= 10000) {
        // Also check that the initial mount wave has finished (e.g. at least 4 seconds have passed since page load)
        const timeSinceMount = now - pageMountTime.current;
        if (timeSinceMount > 4000) {
          // Pick a random dance move
          const dances = ['silly_dancing', 'wave_hip_hop', 'bboy_hip_hop', 'bboy_uprock'];
          randomDanceRef.current = dances[Math.floor(Math.random() * dances.length)];
          setIsDancing(true);
          setHeroGesture(randomDanceRef.current);
          setHeroEmotion({ kind: 0.5, happy: 0.2, neutral: 0.3 }); // warm, moderate smile expression
        }
      }

      // If they scrolled out of Section 1 while dancing, stop immediately!
      if (!inHeroSection && isDancing) {
        setIsDancing(false);
        setHeroGesture('none');
        setHeroEmotion({ neutral: 1.0 });
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, [isDancing, lastInteractionTime]);

  // Section 4 Telemetry Interactive State (NEW)
  const [latencyDebug, setLatencyDebug] = useState([85, 92, 110, 80, 95, 90, 88, 102]);
  const [activeMicroExpression, setActiveMicroExpression] = useState(null);

  const triggerLatencyPeak = () => {
    setLatencyDebug(prev => [...prev.slice(1), 380]);
    setActiveMicroExpression({
      type: 'worried',
      intensity: 1.8,
      duration: 1.2,
      timestamp: Date.now()
    });
    setTimeout(() => {
      setLatencyDebug(prev => [...prev.slice(1), 91]);
    }, 1800);
  };

  // Section 5 Crowd Attention Glance State (NEW)
  const [crowdGlance, setCrowdGlance] = useState('none');
  const [crowdAttention, setCrowdAttention] = useState(null);

  const handleCrowdGlance = (type) => {
    setCrowdGlance(type);
    if (type === 'left') {
      setCrowdAttention({
        state: 'ACTIVE',
        active_target: { pitch: 0.05, yaw: -0.65, userX: -0.65, userY: 0.05 }
      });
    } else if (type === 'right') {
      setCrowdAttention({
        state: 'ACTIVE',
        active_target: { pitch: -0.05, yaw: 0.65, userX: 0.65, userY: -0.05 }
      });
    } else if (type === 'crowd') {
      setCrowdAttention({
        state: 'CROWD'
      });
    } else {
      setCrowdAttention(null);
    }
  };

  const [chatMessages, setChatMessages] = useState([
    { sender: 'assistant', text: "Hello! I am connected to the multimodality pipeline. Try typing a query below!" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);
  const [aslEnabled, setAslEnabled] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);

  const [customAslQueue, setCustomAslQueue] = useState(null);
  const [aslStatus, setAslStatus] = useState('');

  const triggerAslSpelling = (word) => {
    if (!word) {
      setCustomAslQueue([]);
      setAslStatus('');
      return;
    }
    const letters = word.toUpperCase().replace(/[^A-Z]/g, '').split('');
    const queue = letters.map(letter => ({
      type: 'letter',
      gloss: letter,
      path: `animations/asl/letters/${letter.toLowerCase()}.fbx`,
      speed: 1.8
    }));

    const queueWithPauses = [];
    for (let i = 0; i < queue.length; i++) {
      queueWithPauses.push(queue[i]);
      if (i < queue.length - 1) {
        queueWithPauses.push({ type: 'pause', duration: 350 });
      }
    }

    setAslEnabled(true);
    setCustomAslQueue(queueWithPauses);
    setAslStatus(`Spelling: ${letters.join('-')}`);
  };

  const faqs = [
    {
      q: "Does the avatar require a local GPU to run?",
      a: "No. The 3D rendering and blendshape interpolations are fully optimized in WebGL via Three.js/React Three Fiber and run smoothly at 60fps on modern mobile and desktop browsers without a dedicated GPU. The optional MediaPipe face-tracking uses GPU web delegation if available, falling back to CPU gracefully."
    },
    {
      q: "Can I replace the avatar model with my own custom character?",
      a: "Yes! The system is fully compatible with any standard Ready Player Me (RPM) GLB models or custom humanoids exported with standard ARKit blendshape names (like mouthSmileLeft, jawOpen, etc.). Simply swap the GLB path in the code."
    },
    {
      q: "How does the sub-second vocal Lip-Sync pipeline operate?",
      a: "During conversations, the system generates phoneme/viseme cues matching the spoken audio timestamps (using Rhubarb lip-sync standard). The React Three Fiber wrapper interpolates these visemes smoothly per frame to create organic mouth shapes that stay perfectly in sync with the audio."
    },
    {
      q: "Can the landing page run completely serverless?",
      a: "Absolutely! The landing page is engineered to be 100% static and serverless. The chatbot utilizes a local client-side semantic parser to simulate realistic expression blends, skeletal gestures, and lipsync. You can deploy it directly to GitHub Pages without running a Python backend."
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 10 : 0;

      scrollRef.current = progress;
      setScrollState(progress);
    };

    const originalBodyOverflowX = document.body.style.overflowX;
    const originalBodyOverflowY = document.body.style.overflowY;
    const originalBodyHeight = document.body.style.height;
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';

    const rootEl = document.getElementById('root');
    let originalRootHeight = '';
    if (rootEl) {
      originalRootHeight = rootEl.style.height;
      rootEl.style.height = 'auto';
    }

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.body.style.overflowX = originalBodyOverflowX;
      document.body.style.overflowY = originalBodyOverflowY;
      document.body.style.height = originalBodyHeight;
      if (rootEl) {
        rootEl.style.height = originalRootHeight;
      }
    };
  }, []);

  useEffect(() => {
    if (scrollState >= 4.5 && scrollState < 5.5) {
      const states = ['none', 'left', 'crowd', 'right'];
      let currentIndex = 0;

      const interval = setInterval(() => {
        currentIndex = (currentIndex + 1) % states.length;
        const targetState = states[currentIndex];
        setCrowdGlance(targetState);

        if (targetState === 'left') {
          setCrowdAttention({
            state: 'ACTIVE',
            active_target: { pitch: 0.05, yaw: -0.65, userX: -0.65, userY: 0.05 }
          });
        } else if (targetState === 'right') {
          setCrowdAttention({
            state: 'ACTIVE',
            active_target: { pitch: -0.05, yaw: 0.65, userX: 0.65, userY: -0.05 }
          });
        } else if (targetState === 'crowd') {
          setCrowdAttention({
            state: 'CROWD'
          });
        } else {
          setCrowdAttention(null);
        }
      }, 3000);

      return () => clearInterval(interval);
    } else {
      setCrowdAttention(null);
      setCrowdGlance('none');
    }
  }, [scrollState]);

  const handleMouseMove = (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1; 
    const y = -(e.clientY / window.innerHeight) * 2 + 1; 
    setMousePos({ x, y });
  };

  const triggerHello = () => {
    setHeroGesture('hello');
    setHeroEmotion({ happy: 1.0 });
    setTimeout(() => {
      setHeroGesture('none');
      setHeroEmotion({ neutral: 1.0 });
    }, 3500);
  };

  const generatePhonemes = (text, durationSec) => {
    const visemesList = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const cues = [];
    const stepCount = Math.floor(durationSec * 8); 

    for (let i = 0; i < stepCount; i++) {
      const start = (i / stepCount) * durationSec;
      const end = ((i + 1) / stepCount) * durationSec;
      const viseme = i === stepCount - 1 ? 'X' : visemesList[Math.floor(Math.random() * visemesList.length)];
      cues.push({ start, end, viseme });
    }
    return cues;
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isThinking) return;

    const userText = chatInput;
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setIsThinking(true);
    setAudioChunks([]); 

    if (aslEnabled) {
      setTimeout(() => {
        setIsThinking(false);
        setChatMessages((prev) => [...prev, { sender: 'assistant', text: `Translating query to sign language queue: "${userText}"` }]);
        triggerAslSpelling(userText);
      }, 1000);
      return;
    }

    setTimeout(() => {
      let botResponse = "I can dynamically process your query, translate speech, and synthesize expressions.";
      let matchedGesture = 'shrugging';
      let matchedEmotion = 'thinking';

      const lowerText = userText.toLowerCase();
      if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
        botResponse = "Hello there! Welcome to the emotional AI avatar playground. How can I help you today?";
        matchedGesture = 'hello';
        matchedEmotion = 'happy';
      } else if (lowerText.includes('joke') || lowerText.includes('funny') || lowerText.includes('laugh')) {
        botResponse = "Haha! That is hilarious. I love clean humor and emotional synchronization.";
        matchedGesture = 'laughing';
        matchedEmotion = 'excited';
      } else if (lowerText.includes('win') || lowerText.includes('success') || lowerText.includes('great') || lowerText.includes('cheer')) {
        botResponse = "Awesome! We made it. Let's celebrate our AI orchestration achievements!";
        matchedGesture = 'fistRaise';
        matchedEmotion = 'excited';
      } else if (lowerText.includes('sorry') || lowerText.includes('sad') || lowerText.includes('cry')) {
        botResponse = "Oh, I am deeply sorry to hear that. I wish I could offer physical comfort.";
        matchedGesture = 'thankYou';
        matchedEmotion = 'sad';
      } else if (lowerText.includes('receptionist') || lowerText.includes('hotel') || lowerText.includes('greet')) {
        botResponse = "Welcome! I serve as your multi-modal receptionist. Allow me to guide you around.";
        matchedGesture = 'hello';
        matchedEmotion = 'kind';
      }

      setChatMessages((prev) => [...prev, { sender: 'assistant', text: botResponse, gesture: matchedGesture }]);
      setIsThinking(false);

      const responseDuration = Math.max(2.5, botResponse.length * 0.05); 
      const visemes = generatePhonemes(botResponse, responseDuration);

      setAudioChunks([
        {
          url: SILENT_WAV,
          visemes: visemes,
          text: botResponse,
          responseId: Date.now(),
          emotions: { [matchedEmotion]: 1.0 }
        }
      ]);
    }, 1200);
  };

  const getActiveEmotionWeights = () => {
    if (scrollState < 0.5) {
      return heroEmotion;
    }
    if (scrollState >= 0.5 && scrollState < 1.5) {
      return { kind: 0.5, neutral: 0.5 };
    }
    if (scrollState >= 1.5 && scrollState < 2.5) {
      return { [activeEmotion]: 1.0 };
    }
    if (scrollState >= 2.5 && scrollState < 3.5) {
      return { neutral: 1.0 };
    }
    if (scrollState >= 3.5 && scrollState < 4.5) {
      return isThinking ? { thinking: 0.8, neutral: 0.2 } : { neutral: 1.0 };
    }
    if (scrollState >= 4.5 && scrollState < 5.5) {
      return { warm: 0.6, neutral: 0.4 };
    }
    if (scrollState >= 5.5 && scrollState < 6.5) {
      return { focused: 0.7, kind: 0.3 };
    }
    if (scrollState >= 6.5 && scrollState < 7.5) {
      return isThinking ? { thinking: 0.8 } : { warm: 0.6, neutral: 0.4 };
    }
    if (scrollState >= 7.5 && scrollState < 8.5) {
      return { curious: 0.5, neutral: 0.5 };
    }
    if (scrollState >= 8.5 && scrollState < 9.5) {
      return { thinking: 0.6, curious: 0.4 }; 
    }
    if (scrollState >= 9.5) {
      return { excited: 0.6, happy: 0.4 };
    }
    return { neutral: 1.0 };
  };

  const getActiveGesture = () => {
    if (scrollState < 0.5) return heroGesture;
    if (scrollState >= 2.5 && scrollState < 3.5) return currentGesture;
    return 'none';
  };

  const attentionState = scrollState < 0.5 ? {
    state: 'ACTIVE',
    active_target: {
      pitch: mousePos.y * 0.5,
      yaw: -mousePos.x * 0.5,
      userX: -mousePos.x,
      userY: -mousePos.y
    }
  } : null;

  const getActiveAttentionState = () => {
    if (scrollState < 0.5) return attentionState;
    if (scrollState >= 4.5 && scrollState < 5.5) {
      return {
        state: 'ACTIVE',
        active_target: {
          pitch: mousePos.y * 0.6,
          yaw: -mousePos.x * 0.6,
          userX: -mousePos.x,
          userY: -mousePos.y
        }
      };
    }
    if (scrollState >= 5.5 && scrollState < 6.5) return crowdAttention; 
    return null;
  };

  const getBackgroundOpacity = (index, scrollState) => {
    const distance = Math.abs(scrollState - index);
    if (distance <= 1.0) {
      return 1.0 - distance;
    }
    return 0;
  };

  return (
    <div className="landing-page-root" onMouseMove={handleMouseMove}>

      {/* Dynamic Background Gradients */}
      <div className="landing-background-overlay-container">
        {Array.from({ length: 11 }).map((_, idx) => (
          <div
            key={idx}
            className={`landing-bg-gradient-layer layer-${idx}`}
            style={{
              opacity: getBackgroundOpacity(idx, scrollState),
            }}
          />
        ))}
      </div>

      <div className="landing-canvas-container">
        <Canvas camera={{ position: [0.3, 0.1, 1.4], fov: 45 }}>
          <ambientLight intensity={0.65} />

          <directionalLight position={[3, 4, 3]} intensity={1.5} color="#8f94fb" />
          <directionalLight position={[-3, 4, -3]} intensity={1.2} color="#4e54c8" />
          <directionalLight position={[0, -2, 2]} intensity={0.4} color="#34d399" />

          <Suspense fallback={null}>
            <Environment preset="city" />
            <FloatingBackgroundShapes scrollProgress={scrollRef} mousePos={mousePos} />
            <LandingSceneManager
              scrollProgress={scrollRef}
              calibrationMode={calibrationMode}
              currentActiveSection={activeSec}
            >
              <AvatarWrapper
                scrollProgress={scrollRef}
                modelPath={modelPath}
                calibrations={calibrations}
                calibrationMode={calibrationMode}
                currentActiveSection={activeSec}
                emotionWeights={getActiveEmotionWeights()}
                currentGesture={getActiveGesture()}
                activeMicroExpression={activeMicroExpression}
                attentionState={getActiveAttentionState()}
                audioChunks={(scrollState >= 3.5 && scrollState < 4.5) || (scrollState >= 6.5 && scrollState < 7.5) ? audioChunks : []}
                aslEnabled={aslEnabled}
                customAslQueue={customAslQueue}
                onAslStateChange={(s) => {
                  console.log("ASL sequence update:", s);
                }}
                disableFaceTracking={true}
              />
            </LandingSceneManager>
            <ContactShadows position={[0, -0.9, 0]} opacity={0.55} scale={4} blur={2.2} />
          </Suspense>
        </Canvas>
      </div>

      <nav className="landing-nav">
        <div className="landing-nav-logo">
          ⚡ <span>AURA // HMI FRAMEWORK</span>
        </div>
      </nav>

      <div className="landing-scroll-layer">

        {/* SECTION 0: HERO VIEW */}
        <section className="landing-section">
          <div className="section-content">
            <span className="hero-tagline">THE HUMAN–MACHINE INTERACTION FRAMEWORK</span>
            <h1 className="landing-heading">
              AI that doesn't just answer — <br />
              <span className="text-gradient-indigo">it interacts.</span>
            </h1>
            <p className="landing-desc">
              AURA bridges the gap between static language models and embodied human presence. Empower digital avatars with low-latency vision, speech synthesis, emotional reasoning, and social awareness in real time.
            </p>
            <div className="landing-action-row">
              <button className="landing-btn primary" onClick={triggerHello}>
                👋 Test Live Greeting
              </button>
              <button className="landing-btn outline" onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}>
                Explore Capabilities ↓
              </button>
            </div>
          </div>

          <div className="scroll-prompt">
            <span>Scroll to explore</span>
            <div className="scroll-prompt-mouse">
              <div className="scroll-prompt-wheel"></div>
            </div>
          </div>
        </section>

        {/* SECTION 1: THE FUTURE OF HMI (PROBLEM & VISION) */}
        <section className="landing-section">
          <div className="section-content right-align">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>THE HMI VISION</span>
            <h2 className="landing-subheading text-gradient-emerald">The Embodiment Gap: Bringing Human Presence to Digital Intelligence</h2>
            <p className="landing-desc">
              While today's generative models possess advanced reasoning capabilities, they remain bottlenecked by flat screens and silent text feeds. This physical detachment strips away the rich, non-verbal signals—micro-expressions, gaze alignment, and physical postures—that build rapport and trust in everyday human communication.
            </p>
            <p className="landing-desc">
              Our vision is to build the missing interaction layer. AURA serves as the sensory-motor framework that equips cognitive engines with a responsive digital body. By translating digital reasoning into low-latency face blendshapes, natural body gestures, and spatial awareness, AURA transforms static machine outputs into empathetic, face-to-face interactions.
            </p>
          </div>
        </section>

        {/* SECTION 2: THE EMOTION ENGINE */}
        <section className="landing-section">
          <div className="section-content">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>AFFECTIVE RIGGING</span>
            <h2 className="landing-subheading text-gradient-magenta">Digital Humans That Express, Not Just Respond</h2>
            <p className="landing-desc">
              Trust is built on recognition. AURA's core Emotion Engine parses sentiment and lexical tone to drive over 50 fine-grained facial micro-expressions. Hover or click an emotion card below to see blendshapes morph in real-time.
            </p>

            <div className="emotion-card-grid">
              {emotionDemoData.map(emo => (
                <div
                  key={emo.id}
                  className={`emotion-card ${activeEmotion === emo.id ? 'active' : ''}`}
                  onMouseEnter={() => setActiveEmotion(emo.id)}
                  onMouseLeave={() => setActiveEmotion('neutral')}
                  onClick={() => setActiveEmotion(emo.id)}
                >
                  <div className="card-header-row">
                    <span className="card-title-text">{emo.name}</span>
                  </div>
                  <p className="card-features-desc">{emo.features}</p>
                  <div className="card-meta-row">
                    <span className="card-meta-subsystem">{emo.subsystem}</span>
                    <span className="card-meta-separator">•</span>
                    <span className="card-meta-latency">{emo.latency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: CORE CAPABILITIES (GESTURES & BODY LANGUAGE) */}
        <section className="landing-section">
          <div className="section-content right-align">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>KINETIC SYNTHESIS</span>
            <h2 className="landing-subheading text-gradient-cyan">Kinetic Body Language & Non-Verbal Alignment</h2>
            <p className="landing-desc">
              Communication extends beyond the face. AURA manages a fully rigged skeletal posture system with autonomous life movements (breathing, micro-blinks) and context-aware upper-body motor controls. Click a gesture below to trigger skeletal blending.
            </p>

            <div className="gesture-card-grid">
              {gestureDemoData.map(gest => (
                <div
                  key={gest.id}
                  className={`gesture-card ${currentGesture === gest.id ? 'active' : ''}`}
                  onClick={() => setCurrentGesture(currentGesture === gest.id ? 'none' : gest.id)}
                >
                  <div className="card-header-row">
                    <span className="gesture-card-title">{gest.title}</span>
                  </div>
                  <p className="gesture-card-desc">{gest.desc}</p>
                  <div className="card-meta-row">
                    <span className="card-meta-subsystem">{gest.subsystem}</span>
                    <span className="card-meta-separator">•</span>
                    <span className="card-meta-latency">{gest.latency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4: HOW IT WORKS (SPEECH & LIP SYNC) */}
        <section className="landing-section">
          <div className="section-content">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>VOCAL CO-SCHEDULING</span>
            <h2 className="landing-subheading text-gradient-violet">Sub-Second Sensory Alignment: Synthesizing Vocal and Viseme Pipelines</h2>
            <p className="landing-desc">
              A conversation is a living, bi-directional stream. Traditional AI systems trigger speech-to-text, LLM reasoning, text-to-speech, and graphic rendering in sequential, isolated phases—causing noticeable delays that break conversational flow.
            </p>
            <p className="landing-desc">
              AURA eliminates this delay through a unified co-scheduling pipeline. By streaming language model responses token-by-token directly into our viseme synthesizer, the avatar begins speaking and animating its lips synchronously within milliseconds of user speech completion, achieving sub-second vocal alignment.
            </p>

            <div className="glass-hud-panel" style={{ gap: '1rem', padding: '1.5rem' }}>
              <div className="waveform-container active" style={{ height: '60px' }}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="waveform-bar" style={{ height: `${20 + Math.sin(i * 0.5) * 60}%`, width: '4px', background: 'var(--accent-primary)' }}></div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: GAZE AWARENESS & SPATIAL ATTENTION */}
        <section className="landing-section">
          <div className="section-content right-align">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>SPATIAL STEERING</span>
            <h2 className="landing-subheading text-gradient-indigo">Spatial Intelligence: Procedural Attention and Dynamic Eye Contact</h2>
            <p className="landing-desc">
              Natural interaction is situated in space. Today's digital interfaces are physically detached—their avatars stare blindly forward, oblivious to where the speaker is standing. This lack of spatial alignment strips away the subtle eye contact, focus shifts, and head cues that build rapport in human relationships, creating a lifeless communication void.
            </p>
            <p className="landing-desc">
              Our vision is to ground digital agents in the physical environment. AURA achieves this through a real-time, procedural spatial attention engine. By translating user positioning into coordinated look-at vectors, AURA steers the avatar's eye line and head tilt. This dynamic feedback loop simulates the mechanics of human eye contact—incorporating natural saccadic micro-movements and active listener responses—to turn screens into authentic face-to-face engagements.
            </p>
          </div>
        </section>

        {/* SECTION 6: ACCESSIBILITY & SIGN LANGUAGE */}
        <section className="landing-section">
          <div className="section-content">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>INCLUSIVE DESIGN</span>
            <h2 className="landing-subheading text-gradient-emerald">Accessibility Through Sign Language Translation</h2>
            <p className="landing-desc">
              To break down communication barriers, AURA translates speech and text into real-time sign language fingerspelling. By integrating specialized accessibility layers, the framework maps linguistic tokens directly to rigged hand gestures and finger coordinates.
            </p>
            <p className="landing-desc">
              This enables digital avatars to act as inclusive interfaces in public kiosks, educational environments, and customer assistance desks, delivering expressive and accessible communication options for deaf and hard-of-hearing users worldwide.
            </p>
          </div>
        </section>

        {/* SECTION 7: CONVERSATIONAL PIPELINE ORCHESTRATION */}
        <section className="landing-section">
          <div className="section-content right-align">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>CONVERSATIONAL ORCHESTRATION</span>
            <h2 className="landing-subheading text-gradient-magenta">Conversational Pipeline: Unified Multimodal Orchestration</h2>
            <p className="landing-desc">
              AURA's unified conversational pipeline coordinates speech activity detection, large language reasoning, and viseme generation into a single, low-latency execution loop. Rather than processing text, audio, and graphics in isolated sequence, the pipeline streams generative text directly into the expression and gesture controllers.
            </p>
            <p className="landing-desc">
              By running this entire orchestration client-side, AURA eliminates server-side graphics rendering and minimizes interaction delay. The system dynamically translates incoming dialogue into appropriate non-verbal gestures, synchronizes lip blendshapes with the generated audio, and triggers responsive movements to build a seamless conversational connection.
            </p>
          </div>
        </section>

        {/* SECTION 8: FRAMEWORK ARCHITECTURE */}
        <section className="landing-section full-width">
          <div className="section-content full-width">
            <span className="hero-tagline">MODULAR STACK</span>
            <h2 className="landing-subheading text-gradient-gold">Modular Human-Machine Interaction Architecture</h2>
            <p className="landing-desc" style={{ maxWidth: '600px', margin: '0 auto' }}>
              AURA is structured as an open, reusable framework rather than a closed application. Developers can extend, customize, or replace individual layers of the HMI stack to build context-specific digital human intelligence.
            </p>

            <div className="applications-grid">
              {[
                { title: 'Physical Layer', desc: 'Manages 3D meshes, skeleton rigging, blendshapes, facial expressions, and upper-body kinetic gestures.' },
                { title: 'Perception Layer', desc: 'Synthesizes real-time computer vision, user localization, gaze steering, active speaker detection, and audio capture.' },
                { title: 'Intelligence Layer', desc: 'Executes large language reasoning, conversational state history, context memory, and preference learning.' },
                { title: 'Social Layer', desc: 'Controls multi-person attention tracking, active speaker prioritization, gaze direction, and crowd engagement.' },
                { title: 'Accessibility Layer', desc: 'Translates speech and text inputs into real-time sign language fingerspelling and hand movements.' }
              ].map((app, idx) => (
                <div key={idx} className="application-card">
                  <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600, color: '#fff' }}>{app.title}</h3>
                  <p style={{ fontSize: '0.82rem', margin: 0, color: '#9ca3af', lineHeight: '1.5' }}>{app.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 9: ENTERPRISE USE CASES */}
        <section className="landing-section full-width">
          <div className="section-content full-width">
            <span className="hero-tagline">REAL-WORLD INTEGRATION</span>
            <h2 className="landing-subheading text-gradient-cyan">Domain Adaptation & Enterprise Profiles</h2>
            <p className="landing-desc" style={{ maxWidth: '600px', margin: '0 auto' }}>
              From low-latency visitor kiosks to inclusive classroom assistants, AURA's modular layers adapt to distinct organizational roles and environments.
            </p>

            <div className="research-flow" style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {[
                { title: 'AI Receptionist & Guest Operations', desc: 'Greets visitors, handles complex lobby inquiries, collects visitor logs, and manages crowd queuing naturally.', tech: 'Frontdesk Kiosk' },
                { title: 'AI Educator & Conversational Tutor', desc: 'Delivers personalized lessons using gestures and micro-expressions to gauge student focus and maximize retention.', tech: 'Online Learning' },
                { title: 'Inclusive Public Services Assistant', desc: 'Bridges deaf communication barriers in hospitals, schools, and civic counters using live sign language translation.', tech: 'Civic Terminals' },
                { title: 'Research & Interaction Platform', desc: 'Provides an open sandbox for clinical and cognitive scientists to analyze eye contact compliance and non-verbal cues.', tech: 'HMI Lab Suite' }
              ].map((node, idx) => (
                <div key={idx} className="research-flow-node">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="research-node-title" style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', margin: 0 }}>{node.title}</div>
                    <span style={{ fontSize: '0.74rem', background: 'rgba(143, 148, 251, 0.1)', border: '1px solid var(--border-active)', padding: '4px 10px', borderRadius: '20px', color: 'var(--accent-text)', fontWeight: 600 }}>{node.tech}</span>
                  </div>
                  <div className="research-node-desc" style={{ fontSize: '0.95rem', color: '#9ca3af', lineHeight: 1.6, marginTop: '5px', textAlign: 'left' }}>{node.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 10: FINAL CALL TO ACTION */}
        <section className="landing-section full-width">
          <div className="section-content full-width">
            <span className="hero-tagline">DEVELOPER & INVESTOR PORTAL</span>
            <h2 className="landing-subheading text-gradient-violet" style={{ fontSize: '2.5rem' }}>Join the Next Wave of Human-Machine Interaction</h2>
            <p className="landing-desc" style={{ maxWidth: '600px', margin: '0 auto' }}>
              Explore the source repository, connect with business development architects, or test our developer calibrations panel.
            </p>

            <div className="landing-action-row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
              <button className="landing-btn primary" onClick={() => navigateTo('main')}>Launch Platform Sandbox</button>
            </div>

            <div className="qr-cards-container">
              {/* Card 1: Discord */}
              <div 
                className="holographic-qr-card" 
                style={{ borderColor: 'rgba(143, 148, 251, 0.25)' }} 
                onClick={() => window.open('https://discord.gg/8ZFcYhDNW', '_blank')}
              >
                <div className="qr-scanner-box">
                  <div className="qr-scanner-beam" style={{ background: '#8f94fb', boxShadow: '0 0 10px #8f94fb' }}></div>
                  <div className="qr-vector-placeholder">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', width: '80%', height: '80%' }}>
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} style={{ background: (i % 3 === 0 || i % 5 === 1) ? '#8f94fb' : 'transparent', border: '1px solid rgba(143, 148, 251, 0.2)', borderRadius: '2px' }}></div>
                      ))}
                    </div>
                  </div>
                </div>
                <h4 className="qr-card-title">Discord Community</h4>
                <span className="qr-card-tag" style={{ color: '#8f94fb', background: 'rgba(143, 148, 251, 0.08)', borderColor: 'rgba(143, 148, 251, 0.2)' }}>Join Chat</span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.4, textAlign: 'center' }}>
                  Chat with researchers, developers, and HMI builders.
                </p>
              </div>

              {/* Card 2: LinkedIn */}
              <div 
                className="holographic-qr-card" 
                style={{ borderColor: 'rgba(0, 240, 255, 0.25)' }} 
                onClick={() => window.open('https://www.linkedin.com/posts/rohith-r-8090a125a_aura-ritalumniassociation-humanmachineinteraction-activity-7470730841418174465-z3Jr?utm_source=share&utm_medium=member_desktop&rcm=ACoAAD-6lUkBgJibWcvx9UM1ShtxGs__F6pHdx8', '_blank')}
              >
                <div className="qr-scanner-box">
                  <div className="qr-scanner-beam" style={{ background: '#00f0ff', boxShadow: '0 0 10px #00f0ff' }}></div>
                  <div className="qr-vector-placeholder">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', width: '80%', height: '80%' }}>
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} style={{ background: (i % 2 === 0 && i % 3 === 1) ? '#00f0ff' : 'transparent', border: '1px solid rgba(0, 240, 255, 0.2)', borderRadius: '2px' }}></div>
                      ))}
                    </div>
                  </div>
                </div>
                <h4 className="qr-card-title">LinkedIn Network</h4>
                <span className="qr-card-tag" style={{ color: '#00f0ff', background: 'rgba(0, 240, 255, 0.08)', borderColor: 'rgba(0, 240, 255, 0.2)' }}>Connect</span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.4, textAlign: 'center' }}>
                  Follow updates and sync with business architects.
                </p>
              </div>

              {/* Card 3: GitHub */}
              <div 
                className="holographic-qr-card" 
                style={{ borderColor: 'rgba(52, 211, 153, 0.25)' }} 
                onClick={() => window.open('https://github.com/Rohith57373/AURA', '_blank')}
              >
                <div className="qr-scanner-box">
                  <div className="qr-scanner-beam" style={{ background: '#34d399', boxShadow: '0 0 10px #34d399' }}></div>
                  <div className="qr-vector-placeholder">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', width: '80%', height: '80%' }}>
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} style={{ background: (i % 4 === 1 || i % 3 === 0) ? '#34d399' : 'transparent', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '2px' }}></div>
                      ))}
                    </div>
                  </div>
                </div>
                <h4 className="qr-card-title">GitHub Repository</h4>
                <span className="qr-card-tag" style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.08)', borderColor: 'rgba(52, 211, 153, 0.2)' }}>Source Code</span>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.4, textAlign: 'center' }}>
                  Explore repository assets and check developer releases.
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>

      {calibrationMode && (
        <div className="calibration-hud">
          <h3>
            🛠️ 3D Placement HUD
            <span className="calibration-section-indicator" style={{ display: 'block', fontSize: '0.74rem', marginTop: '4px', color: 'var(--accent-primary)' }}>
              Section {activeSec}: {[
                "Hero Stage",
                "Problem & Vision",
                "The Emotion Engine",
                "Core Capabilities",
                "Pipeline Execution",
                "Spatial Intelligence",
                "Framework Architecture",
                "Conversational Pipeline",
                "Sign Language Accessibility",
                "High-Performance WebGL Engine",
                "Enterprise & Community Portal"
              ][activeSec]}
            </span>
          </h3>

          <p style={{ fontSize: '0.74rem', color: '#a0aec0', margin: '0 0 6px 0', lineHeight: 1.4 }}>
            Scroll to a section to load its values. Slide coordinates to position the avatar exactly where you want it!
          </p>

          <div className="calibration-row">
            <label>
              <span>Horizontal Offset:</span>
              <span>{(calibrations[activeSec].posXPercent * 100).toFixed(0)}% width</span>
            </label>
            <input
              type="range"
              min="-0.5"
              max="0.5"
              step="0.01"
              value={calibrations[activeSec].posXPercent}
              onChange={(e) => handleCalibrateChange('posXPercent', parseFloat(e.target.value))}
            />
          </div>

          <div className="calibration-row">
            <label>
              <span>Vertical (posY):</span>
              <span>{calibrations[activeSec].posY.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="-1.2"
              max="1.2"
              step="0.01"
              value={calibrations[activeSec].posY}
              onChange={(e) => handleCalibrateChange('posY', parseFloat(e.target.value))}
            />
          </div>

          <div className="calibration-row">
            <label>
              <span>Depth (posZ):</span>
              <span>{calibrations[activeSec].posZ.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="-1.5"
              max="1.5"
              step="0.02"
              value={calibrations[activeSec].posZ}
              onChange={(e) => handleCalibrateChange('posZ', parseFloat(e.target.value))}
            />
          </div>

          <div className="calibration-row">
            <label>
              <span>Rotation (rotY):</span>
              <span>{calibrations[activeSec].rotY.toFixed(2)} rad</span>
            </label>
            <input
              type="range"
              min="-3.14"
              max="3.14"
              step="0.02"
              value={calibrations[activeSec].rotY}
              onChange={(e) => handleCalibrateChange('rotY', parseFloat(e.target.value))}
            />
          </div>

          <div className="calibration-row">
            <label>
              <span>Mesh Size (Scale):</span>
              <span>{calibrations[activeSec].scale.toFixed(2)}x</span>
            </label>
            <input
              type="range"
              min="0.3"
              max="1.8"
              step="0.02"
              value={calibrations[activeSec].scale}
              onChange={(e) => handleCalibrateChange('scale', parseFloat(e.target.value))}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', margin: '8px 0', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSaveCalibrations}
                className="landing-btn primary"
                style={{ flex: 1, fontSize: '0.78rem', padding: '0.5rem', borderRadius: '10px' }}
              >
                💾 Save Local
              </button>
              <button
                onClick={handleResetCalibrations}
                className="landing-btn outline"
                style={{ flex: 1, fontSize: '0.78rem', padding: '0.5rem', borderRadius: '10px' }}
              >
                🔄 Reset Defaults
              </button>
            </div>
            <button
              onClick={handleDownloadCalibrationsJSON}
              className="landing-btn outline"
              style={{ fontSize: '0.78rem', padding: '0.5rem', borderRadius: '10px', width: '100%', borderColor: 'var(--accent-primary)', color: 'var(--accent-text)' }}
            >
              📥 Download calibrations.json
            </button>
          </div>

          {saveStatus && (
            <div style={{ fontSize: '0.74rem', color: 'var(--accent-green)', textAlign: 'center', fontWeight: 'bold' }}>
              {saveStatus}
            </div>
          )}

          <div className="code-output-container">
            <span>📋 Generated Spline Code:</span>
            <div className="code-output">
              {`const posX = getInterpolatedValue([${calibrations.map(c => `viewportWidth * ${c.posXPercent.toFixed(2)}`).join(', ')}], progress);
const posY = getInterpolatedValue([${calibrations.map(c => c.posY.toFixed(2)).join(', ')}], progress);
const rotY = getInterpolatedValue([${calibrations.map(c => c.rotY.toFixed(2)).join(', ')}], progress);
const scale = getInterpolatedValue([${calibrations.map(c => c.scale.toFixed(2)).join(', ')}], progress);`}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
