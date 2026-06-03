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
    const activeProgress = calibrationMode
      ? Math.min(10, Math.max(0, currentActiveSection))
      : smoothScroll.current;

    // 1. Camera Positions per Section (11 milestones for 11 sections)
    const camX = getInterpolatedValue([0.28, -0.15, 0.12, -0.28, 0.28, -0.24, 0.0, -0.22, 0.22, -0.20, 0.0], activeProgress);
    const camY = getInterpolatedValue([0.12, 0.46, -0.15, 0.08, -0.05, 0.06, 0.0, 0.05, -0.05, 0.05, 0.0], activeProgress);
    const camZ = getInterpolatedValue([1.35, 0.65, 1.85, 1.15, 1.50, 1.22, 1.55, 1.40, 1.50, 1.45, 1.60], activeProgress);

    state.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.12);

    // 2. Camera LookAt targets per Section
    const targetX = getInterpolatedValue([0.28, -0.15, 0.12, -0.28, 0.28, -0.24, 0.0, -0.22, 0.22, -0.20, 0.0], activeProgress);
    const targetY = getInterpolatedValue([0.06, 0.46, -0.15, 0.08, -0.05, 0.06, 0.0, 0.05, -0.05, 0.05, 0.0], activeProgress);
    const targetZ = getInterpolatedValue([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], activeProgress);

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

    if (calibrationMode) {
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
      posX = getInterpolatedValue(calibrations.map(c => viewportWidth * c.posXPercent), progress);
      posY = getInterpolatedValue(calibrations.map(c => c.posY), progress);
      posZ = getInterpolatedValue(calibrations.map(c => c.posZ), progress);
      rotY = getInterpolatedValue(calibrations.map(c => c.rotY), progress);
      scale = getInterpolatedValue(calibrations.map(c => c.scale), progress);
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
        setChatMessages((prev) => [...prev, { sender: 'assistant', text: `Translating query to ASL queue: "${userText}"` }]);
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
          🚀 <span>HMI ENGINE</span>
        </div>
        <div className="landing-nav-links">
          <button
            className={`nav-glow-btn ${calibrationMode ? 'primary' : ''}`}
            onClick={() => setCalibrationMode(!calibrationMode)}
            style={{
              borderColor: calibrationMode ? 'var(--accent-primary)' : 'var(--border-glass)',
              boxShadow: calibrationMode ? '0 0 12px var(--accent-glow)' : 'none'
            }}
          >
            🛠️ Placement HUD: {calibrationMode ? 'ON' : 'OFF'}
          </button>
          <button className="nav-glow-btn primary" onClick={() => navigateTo('main')}>
            Launch App
          </button>
        </div>
      </nav>

      <div className="landing-scroll-layer">

        {/* SECTION 0: HERO VIEW */}
        <section className="landing-section">
          <div className="section-content">
            <span className="hero-tagline">Interaction Engine v2.0</span>
            <h1 className="landing-heading">
              Human-Centric AI Avatars <br />
              <span className="text-gradient-indigo">for Natural Interaction</span>
            </h1>
            <p className="landing-desc">
              Human communication relies on expressions, gestures, eye contact, speech, and context. Traditional interfaces often ignore these signals. Our Human-Machine Interaction platform bridges this gap.
            </p>
            <div className="landing-action-row">
              <button className="landing-btn primary" onClick={triggerHello}>
                👋 Say Hello
              </button>
              <button className="landing-btn outline" onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}>
                Explore Research ↓
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

        {/* SECTION 1: THE FUTURE OF HMI */}
        <section className="landing-section">
          <div className="section-content right-align">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>Sensory Synthesis</span>
            <h2 className="landing-subheading text-gradient-emerald">Reimagining the Human-Machine Interface</h2>
            <p className="landing-desc">
              We believe the next era of computing won't be defined by keyboards or command lines, but by natural, face-to-face interaction. Our HMI platform integrates visual and auditory sensory loops to enable machines to understand and express subtle human cues.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', padding: '1.2rem', borderRadius: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#9ca3af' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-green)' }}></div>
                <span>Real-Time Interaction Flow</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '0.78rem', marginTop: '5px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>Human Cue</div>
                <span style={{ opacity: 0.3 }}>→</span>
                <div style={{ background: 'rgba(143, 148, 251, 0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-active)' }}>Affective Parser</div>
                <span style={{ opacity: 0.3 }}>→</span>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>Avatar Response</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: AFFECTIVE ENGINE (EXPRESSIONS & EMOTIONS) */}
        <section className="landing-section">
          <div className="section-content">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>Blendshape Morphing</span>
            <h2 className="landing-subheading text-gradient-magenta">Expressive Morphing Array</h2>
            <p className="landing-desc">
              Our Affective Engine maps verbal sentiment and lexical tone to over 50 fine-grained facial blendshapes. Hover over the emotions below to trigger micro-expressions on the avatar in real-time.
            </p>

            <div className="emotion-card-grid">
              {['happy', 'excited', 'surprised', 'sad', 'angry', 'thinking', 'confused', 'neutral'].map(emo => (
                <div
                  key={emo}
                  className={`emotion-card ${activeEmotion === emo ? 'active' : ''}`}
                  onMouseEnter={() => setActiveEmotion(emo)}
                  onMouseLeave={() => setActiveEmotion('neutral')}
                >
                  {emo.charAt(0).toUpperCase() + emo.slice(1)}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3: KINETIC SKELETON RIGGING (GESTURES) */}
        <section className="landing-section">
          <div className="section-content right-align">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>Kinetic Telemetry</span>
            <h2 className="landing-subheading text-gradient-cyan">Kinetic Body Language</h2>
            <p className="landing-desc">
              Communication extends beyond the face. The platform synthesizes natural skeletal gestures dynamically based on speech intent. Click the cards below to trigger upper-body motor functions.
            </p>

            <div className="gesture-card-grid">
              {[
                { id: 'hello', title: 'Greeting', desc: 'A polite friendly wave.' },
                { id: 'thumbsUp', title: 'Thumbs Up', desc: 'Positive feedback acknowledgement.' },
                { id: 'clapping', title: 'Clapping', desc: 'Appreciative feedback gesture.' },
                { id: 'shrugging', title: 'Shrug', desc: 'Expressing uncertainty or thought.' },
                { id: 'fistRaise', title: 'Cheer', desc: 'Energetic success animation.' },
                { id: 'bow', title: 'Formal Bow', desc: 'Respectful greeting or gratitude.' },
                { id: 'thankYou', title: 'Thank You', desc: 'A warm gesture of appreciation.' }
              ].map(gest => (
                <div
                  key={gest.id}
                  className={`gesture-card ${currentGesture === gest.id ? 'active' : ''}`}
                  onClick={() => setCurrentGesture(currentGesture === gest.id ? 'none' : gest.id)}
                >
                  <span className="gesture-card-title">{gest.title}</span>
                  <span className="gesture-card-desc">{gest.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4: CONVERSATIONAL LOOP (SPEECH & LIP SYNC) */}
        <section className="landing-section">
          <div className="section-content">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>Vocal Orchestration</span>
            <h2 className="landing-subheading text-gradient-violet">Sub-Second Conversational Loop</h2>
            <p className="landing-desc">
              A conversation is a living, bi-directional stream. Our pipeline features low-latency voice activity detection (VAD), speech-to-text, LLM inference, and synchronous viseme synthesis.
            </p>

            <div className="glass-hud-panel" style={{ gap: '1rem' }}>
              <div className="speaking-indicator">
                <div className="speaking-indicator-dot"></div>
                <span>Conversational Agent Active</span>
              </div>
              <div className="waveform-container active">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="waveform-bar" style={{ height: `${20 + Math.sin(i * 0.5) * 60}%` }}></div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: '#9ca3af' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                  <span>Voice Activity Detection (VAD)</span>
                  <span style={{ color: 'var(--accent-green)' }}>12ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                  <span>Speech-to-Text (Whisper API)</span>
                  <span style={{ color: 'var(--accent-green)' }}>180ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                  <span>Language Model Inference</span>
                  <span style={{ color: 'var(--accent-green)' }}>450ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Viseme & Audio Synthesizer</span>
                  <span style={{ color: 'var(--accent-green)' }}>210ms</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: GAZE AWARENESS & SPATIAL ATTENTION */}
        <section className="landing-section">
          <div className="section-content right-align">
            <span className="hero-tagline" style={{ color: 'var(--accent-primary)' }}>Spatial Steering</span>
            <h2 className="landing-subheading text-gradient-indigo">Spatial Gaze Tracking</h2>
            <p className="landing-desc">
              Intelligent systems should know where you are looking. Our spatial attention engine tracks mouse coordinates to steer the avatar's eye line, establishing real-time eye contact. Move your mouse across this section to test it.
            </p>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '16px', padding: '1.2rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#888' }}>
                <span>Tracking Coordinates</span>
                <span style={{ color: 'var(--accent-green)', fontWeight: 'bold' }}>ACTIVE</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontFamily: 'monospace', color: 'var(--accent-text)' }}>
                <div>Yaw Offset: {(-mousePos.x * 0.5).toFixed(3)} rad</div>
                <div>Pitch Offset: {(mousePos.y * 0.5).toFixed(3)} rad</div>
                <div>Cursor X: {mousePos.x.toFixed(3)}</div>
                <div>Cursor Y: {mousePos.y.toFixed(3)}</div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: ACCESSIBILITY & SIGN LANGUAGE */}
        <section className="landing-section">
          <div className="section-content">
            <span className="hero-tagline">Democratizing Interaction</span>
            <h2 className="landing-subheading text-gradient-emerald">Accessibility Through Sign Language</h2>
            <p className="landing-desc">
              To truly democratize interaction, digital humans must be accessible to everyone. Our platform translates written or spoken text into real-time American Sign Language (ASL) fingerspelling. Click below to watch the avatar spell words.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="asl-btn" onClick={() => triggerAslSpelling('HMI')}>Spell "HMI"</button>
                <button className="asl-btn" onClick={() => triggerAslSpelling('HELLO')}>Spell "HELLO"</button>
                <button className="asl-btn" onClick={() => triggerAslSpelling('WELCOME')}>Spell "WELCOME"</button>
                <button className="asl-btn" onClick={() => triggerAslSpelling('')} style={{ color: 'var(--accent-text)', borderColor: 'var(--border-active)' }}>Clear Queue</button>
              </div>
              {aslStatus && (
                <div style={{ background: 'rgba(143, 148, 251, 0.05)', border: '1px solid var(--border-active)', padding: '10px 16px', borderRadius: '12px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{aslStatus}</span>
                  <span style={{ color: '#888', fontSize: '0.75rem' }}>Playing ASL FBX sequence</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 7: INTERACTIVE DEMONSTRATION PLAYGROUND */}
        <section className="landing-section">
          <div className="section-content right-align">
            <span className="hero-tagline">Platform Sandbox</span>
            <h2 className="landing-subheading text-gradient-magenta">Unified HMI Playground</h2>
            <p className="landing-desc">
              Converse with the avatar, toggle sign language mode, and review the live blendshape logs in our unified sandbox console.
            </p>

            <div className="glass-hud-panel" style={{ width: '100%', padding: '1.8rem', gap: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 600 }}>Interactive Console</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: aslEnabled ? 'var(--accent-green)' : '#888' }}>
                    <input type="checkbox" checked={aslEnabled} onChange={() => setAslEnabled(!aslEnabled)} style={{ accentColor: 'var(--accent-green)' }} />
                    <span>ASL Mode</span>
                  </label>
                </div>
              </div>

              <div className="chat-container">
                <div className="chat-log" style={{ minHeight: '140px', maxHeight: '180px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.sender}`} style={{ padding: '8px 12px', fontSize: '0.85rem', width: 'fit-content' }}>
                      <div>{msg.text}</div>
                      {msg.gesture && msg.gesture !== 'none' && (
                        <div style={{ fontSize: '0.68rem', opacity: 0.6, marginTop: '3px' }}>[Gesture: {msg.gesture}]</div>
                      )}
                    </div>
                  ))}
                  {isThinking && (
                    <div className="chat-bubble assistant" style={{ fontStyle: 'italic', opacity: 0.5, padding: '8px 12px', fontSize: '0.8rem' }}>
                      Synthesizing response...
                    </div>
                  )}
                </div>

                <form onSubmit={handleChatSubmit} className="chat-input-row" style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={aslEnabled ? "Type word to sign/speak..." : "Type 'hello', 'laugh', 'cheer'..."}
                    disabled={isThinking}
                    style={{ width: '100%' }}
                  />
                  <button type="submit" className="chat-send-btn" disabled={isThinking || !chatInput.trim()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 8: APPLICATIONS OF HMI */}
        <section className="landing-section full-width">
          <div className="section-content full-width">
            <span className="hero-tagline">Real-World Integration</span>
            <h2 className="landing-subheading text-gradient-gold">Domain Adaptations</h2>
            <p className="landing-desc" style={{ maxWidth: '600px', margin: '0 auto' }}>
              From immersive research platforms to accessible kiosk systems, digital humans can adapt to multiple domains.
            </p>

            <div className="applications-grid">
              {[
                { title: 'Interactive Education', desc: 'Enhancing student retention through friendly, conversational tutors capable of micro-expressions.', icon: '🎓' },
                { title: 'Digital Reception', desc: 'Directing visitors in lobbies and virtual halls with low-latency facial analyses.', icon: '🛎️' },
                { title: 'Accessibility & Inclusion', desc: 'Bridging sensory gaps via real-time spoken-to-sign language fingerspelling engines.', icon: '🤟' },
                { title: 'Clinical & HMI Research', desc: 'Analyzing interaction signals, facial gaze compliance, and spatial coordination loops.', icon: '🔬' },
                { title: 'Storytelling & Games', desc: 'Generating contextual scripts and real-time animation blends for games and narratives.', icon: '📚' }
              ].map((app, idx) => (
                <div key={idx} className="application-card">
                  <div className="app-card-visual" style={{ fontSize: '1.8rem' }}>{app.icon}</div>
                  <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 600, color: '#fff' }}>{app.title}</h3>
                  <p style={{ fontSize: '0.82rem', margin: 0, color: '#9ca3af', lineHeight: '1.5' }}>{app.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 9: RESEARCH & TECHNOLOGY */}
        <section className="landing-section full-width">
          <div className="section-content full-width">
            <span className="hero-tagline">System Architecture</span>
            <h2 className="landing-subheading text-gradient-cyan">Engineering the Interaction Layer</h2>
            <p className="landing-desc" style={{ maxWidth: '600px', margin: '0 auto' }}>
              An open architecture built on low-latency networks, MediaPipe tracking, and WebGL rendering.
            </p>

            <div className="research-flow" style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {[
                { title: 'Voice Input & VAD Filter', desc: 'Continuous voice capturing with ambient noise cancellation and sub-15ms energy boundary detection.', tech: 'VAD Engine' },
                { title: 'Cognitive LLM Orchestrator', desc: 'Lexical parsing using FastAPI WebSockets to map sentiments, emotions, and visemes synchronously.', tech: 'Llama 3' },
                { title: 'Kinematic & Motor Control', desc: 'Blending skeletal structures with custom Mixamo animation clips and real-time gaze steering.', tech: 'Mixamo Rig' },
                { title: 'WebGL Render Pipeline', desc: 'R3F and Three.js-based rendering at 60fps, optimizing blendshapes to run smoothly on desktop and mobile browsers.', tech: 'Three.js / WebGL' }
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
            <span className="hero-tagline">Get Started</span>
            <h2 className="landing-subheading text-gradient-violet" style={{ fontSize: '2.5rem' }}>The Future of HMI is Human-Centric</h2>
            <p className="landing-desc" style={{ maxWidth: '600px', margin: '0 auto' }}>
              Connect with engineers, check repository assets, or test our core HMI platform sandbox.
            </p>

            <div className="landing-action-row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
              <button className="landing-btn primary" onClick={() => navigateTo('main')}>Launch Platform Sandbox</button>
            </div>

            <div className="qr-cards-container">
              {/* Card 1: Discord */}
              <div 
                className="holographic-qr-card" 
                style={{ borderColor: 'rgba(143, 148, 251, 0.25)' }} 
                onClick={() => window.open('https://discord.gg', '_blank')}
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
                  Scan to chat with researchers, developers, and HMI builders.
                </p>
                <div className="qr-card-action">Scan to Join →</div>
              </div>

              {/* Card 2: LinkedIn */}
              <div 
                className="holographic-qr-card" 
                style={{ borderColor: 'rgba(0, 240, 255, 0.25)' }} 
                onClick={() => window.open('https://linkedin.com', '_blank')}
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
                  Scan to follow updates and sync with business architects.
                </p>
                <div className="qr-card-action" style={{ color: '#00f0ff' }}>Scan to Follow →</div>
              </div>

              {/* Card 3: GitHub */}
              <div 
                className="holographic-qr-card" 
                style={{ borderColor: 'rgba(52, 211, 153, 0.25)' }} 
                onClick={() => window.open('https://github.com', '_blank')}
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
                  Scan to explore repository assets and check developer releases.
                </p>
                <div className="qr-card-action" style={{ color: '#34d399' }}>Scan to Explore →</div>
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
                "Future of HMI",
                "Expressions & Emotions",
                "Gestures & Body Language",
                "Speech & Lipsync Loop",
                "Gaze Awareness",
                "Accessibility & Sign Language",
                "Interactive Playground",
                "Applications of HMI",
                "Research & Architecture",
                "Join HMI Network"
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
