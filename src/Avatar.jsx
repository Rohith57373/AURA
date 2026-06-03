import React, { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { useFaceTracker } from './useFaceTracker.jsx'
import { microExpressions } from './microExpressions'

// Emotion Mapping Dictionary using ARKit Blendshapes
const emotionMap = {
    happy: {
        mouthSmileLeft: 0.85,
        mouthSmileRight: 0.85,
        browInnerUp: 0.20,
        jawOpen: 0.25,
        cheekPuff: 0.15,
        eyeWideLeft: 0.20,
        eyeWideRight: 0.20
    },
    excited: {
        mouthSmileLeft: 1.00,
        mouthSmileRight: 1.00,
        browInnerUp: 0.45,
        jawOpen: 0.60,
        eyeWideLeft: 0.55,
        eyeWideRight: 0.55,
        cheekPuff: 0.25
    },
    neutral: {
        mouthSmileLeft: 0.10,
        mouthSmileRight: 0.10,
        jawOpen: 0.05
    },
    serious: {
        browDownLeft: 0.35,
        browDownRight: 0.35,
        mouthSmileLeft: 0.00,
        mouthSmileRight: 0.00,
        jawOpen: 0.05
    },
    angry: {
        browDownLeft: 0.90,
        browDownRight: 0.90,
        eyeWideLeft: 0.45,
        eyeWideRight: 0.45,
        jawOpen: 0.55,
        mouthSmileLeft: 0.00,
        mouthSmileRight: 0.00
    },
    furious: {
        browDownLeft: 1.00,
        browDownRight: 1.00,
        eyeWideLeft: 0.70,
        eyeWideRight: 0.70,
        jawOpen: 0.80,
        cheekPuff: 0.35
    },
    surprised: {
        browInnerUp: 0.90,
        eyeWideLeft: 1.00,
        eyeWideRight: 1.00,
        jawOpen: 0.75
    },
    funny: {
        mouthSmileLeft: 0.75,
        mouthSmileRight: 0.55,
        cheekPuff: 0.30,
        eyeWideLeft: 0.25,
        eyeWideRight: 0.25
    },
    sad: {
        browInnerUp: 0.75,
        mouthSmileLeft: 0.00,
        mouthSmileRight: 0.00,
        mouthPucker: 0.55,
        eyeBlinkLeft: 0.15,
        eyeBlinkRight: 0.15
    },
    pleading: {
        browInnerUp: 1.00,
        mouthPucker: 0.75,
        eyeWideLeft: 0.35,
        eyeWideRight: 0.35,
        eyeBlinkLeft: 0.10,
        eyeBlinkRight: 0.10
    },
    laughing: {
        mouthSmileLeft: 1.00,
        mouthSmileRight: 1.00,
        jawOpen: 0.85,
        cheekPuff: 0.45,
        eyeBlinkLeft: 0.35,
        eyeBlinkRight: 0.35
    },
    mocking: {
        mouthSmileLeft: 0.90,
        mouthSmileRight: 0.45,
        browDownLeft: 0.20,
        jawOpen: 0.30
    },
    kind: {
        mouthSmileLeft: 0.60,
        mouthSmileRight: 0.60,
        browInnerUp: 0.20,
        jawOpen: 0.20
    },
    worried: {
        browInnerUp: 0.85,
        eyeWideLeft: 0.55,
        eyeWideRight: 0.55,
        jawOpen: 0.25,
        mouthPucker: 0.35
    },
    desperate: {
        browInnerUp: 1.00,
        eyeWideLeft: 0.85,
        eyeWideRight: 0.85,
        jawOpen: 0.90,
        cheekPuff: 0.25
    },
    scared: {
        eyeWideLeft: 1.00,
        eyeWideRight: 1.00,
        browInnerUp: 0.85,
        jawOpen: 0.65
    },
    determined: {
        browDownLeft: 0.45,
        browDownRight: 0.45,
        jawOpen: 0.15,
        eyeWideLeft: 0.20,
        eyeWideRight: 0.20
    },
    focused: {
        browDownLeft: 0.30,
        browDownRight: 0.30,
        eyeWideLeft: 0.15,
        eyeWideRight: 0.15,
        jawOpen: 0.05
    },
    heroic: {
        mouthSmileLeft: 0.70,
        mouthSmileRight: 0.70,
        browInnerUp: 0.30,
        eyeWideLeft: 0.25,
        eyeWideRight: 0.25
    },
    grateful: {
        mouthSmileLeft: 0.65,
        mouthSmileRight: 0.65,
        browInnerUp: 0.35,
        jawOpen: 0.20
    },
    warm: {
        mouthSmileLeft: 0.55,
        mouthSmileRight: 0.55,
        browInnerUp: 0.25,
        eyeBlinkLeft: 0.10,
        eyeBlinkRight: 0.10
    },
    curious: {
        browInnerUp: 0.55,
        eyeWideLeft: 0.35,
        eyeWideRight: 0.35,
        jawOpen: 0.20
    },
    thinking: {
        browInnerUp: 0.8,
        browDownLeft: 0.4,
        eyeSquintLeft: 0.5,
        eyeSquintRight: 0.5,
        mouthDimpleLeft: 0.6,
        mouthDimpleRight: 0.6,
        mouthPressLeft: 0.3,
        mouthPressRight: 0.3
    },
    confused: {
        browInnerUp: 0.7,
        browDownRight: 0.8,
        eyeSquintLeft: 0.5,
        mouthFrownLeft: 0.5,
        mouthFrownRight: 0.5,
        jawLeft: 0.3
    }
}

// Phoneme Viseme Mapping Library for ARKit (Rhubarb Lip Sync)
const visemeMap = {
    A: { mouthClose: 1.0 },                                      // Closed mouth (M, B, P)
    B: { jawOpen: 0.12 },                                        // Slightly open (K, S, T)
    C: { jawOpen: 0.22, mouthDimpleLeft: 0.15, mouthDimpleRight: 0.15 }, // Open (I, E)
    D: { jawOpen: 0.42, mouthSmileLeft: 0.2, mouthSmileRight: 0.2 },  // Wide open (A, E)
    E: { mouthFunnel: 0.4, jawOpen: 0.12 },                       // Slightly rounded (O)
    F: { mouthPucker: 0.65, jawOpen: 0.08 },                       // Puckered lips (U, W, Q)
    G: { mouthPressLeft: 0.55, mouthPressRight: 0.55, jawOpen: 0.08 }, // F, V sounds
    H: { jawOpen: 0.12, mouthSmileLeft: 0.2, mouthSmileRight: 0.2 }, // L, Th sounds
    X: {}                                                        // neutral baseline
}

// ======================
// ASL BONE MAP
// ======================
const boneMap = {
    mixamorigHips: "Hips",
    mixamorigSpine: "Spine",
    mixamorigSpine1: "Spine1",
    mixamorigSpine2: "Spine2",
    mixamorigNeck: "Neck",
    mixamorigHead: "Head",
    mixamorigLeftShoulder: "LeftShoulder",
    mixamorigLeftArm: "LeftArm",
    mixamorigLeftForeArm: "LeftForeArm",
    mixamorigLeftHand: "LeftHand",
    mixamorigRightShoulder: "RightShoulder",
    mixamorigRightArm: "RightArm",
    mixamorigRightForeArm: "RightForeArm",
    mixamorigRightHand: "RightHand"
};

function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

export function Avatar({
    emotionWeights = { neutral: 1.0 },
    currentGesture = 'none', // 'none', 'hello', 'thumbsUp', 'thankYou', 'clapping', 'shrugging', 'lookingAround', 'bow', 'fistRaise', 'listening', 'laughing', 'praying', 'pickingUp'
    activeMicroExpression = null, // { type, intensity, duration, timestamp }
    audioChunks = [],
    isListening = false,
    modelPath = 'model.glb',
    attentionState = null,
    customBlendshapeOverrides = {},
    aslEnabled = false,
    customAslQueue = null,
    onAslStateChange = null,
    armSpacingOffset = 0.0,
    disableFaceTracking = false,
    ...props
}) {
    // Use a placeholder model or local model logic. 
    // RPM produces .glb files. Make sure to download a head/half-body with morph targets.
    const { scene } = useGLTF(modelPath)
    const morphMeshesRef = useRef([])

    const { faceData, isLoaded } = useFaceTracker(!disableFaceTracking);
    const bonesRef = useRef({ 
        hips: null, spine: null, spine1: null, spine2: null, head: null, neck: null, leftEye: null, rightEye: null,
        // Gesture bones
        RightArm: null, RightForeArm: null, RightHand: null,
        LeftArm: null, LeftForeArm: null, LeftHand: null,
        RightHandThumb1: null, RightHandThumb2: null, RightHandThumb3: null,
        RightHandIndex1: null, RightHandIndex2: null, RightHandIndex3: null,
        RightHandMiddle1: null, RightHandMiddle2: null, RightHandMiddle3: null,
        RightHandRing1: null, RightHandRing2: null, RightHandRing3: null,
        RightHandPinky1: null, RightHandPinky2: null, RightHandPinky3: null,
        LeftHandThumb1: null, LeftHandThumb2: null, LeftHandThumb3: null,
        LeftHandIndex1: null, LeftHandIndex2: null, LeftHandIndex3: null,
        LeftHandMiddle1: null, LeftHandMiddle2: null, LeftHandMiddle3: null,
        LeftHandRing1: null, LeftHandRing2: null, LeftHandRing3: null,
        LeftHandPinky1: null, LeftHandPinky2: null, LeftHandPinky3: null
    });
    const initialRotations = useRef({});
    const initialPositions = useRef({});
    const avatarBonesRef = useRef({});

    useEffect(() => {
        avatarBonesRef.current = {};
        scene.traverse((child) => {
            if (child.isBone) {
                avatarBonesRef.current[child.name] = child;
                if (child.name === 'Hips') bonesRef.current.hips = child;
                else if (child.name === 'Spine') bonesRef.current.spine = child;
                else if (child.name === 'Spine1') bonesRef.current.spine1 = child;
                else if (child.name === 'Spine2') bonesRef.current.spine2 = child;
                else if (child.name === 'Head') bonesRef.current.head = child;
                else if (child.name === 'Neck') bonesRef.current.neck = child;
                else if (child.name === 'LeftEye') bonesRef.current.leftEye = child;
                else if (child.name === 'RightEye') bonesRef.current.rightEye = child;
                else if (bonesRef.current.hasOwnProperty(child.name)) {
                    bonesRef.current[child.name] = child;
                }
                
                // T-pose to A-pose conversion explicitly for the female avatar
                if (modelPath.includes('female_model.glb')) {
                    if (child.name === 'LeftArm') {
                        child.rotation.x = 1.24;
                        child.rotation.y = 0.0;
                        child.rotation.z = 0.0;
                    }
                    if (child.name === 'RightArm') {
                        child.rotation.x = 1.26;
                        child.rotation.y = 0.0;
                        child.rotation.z = 0.0;
                    }
                    child.updateMatrixWorld();
                }

                // Store initial positions of arm bones to apply translation offsets
                if (['LeftArm', 'RightArm'].includes(child.name)) {
                    initialPositions.current[child.name] = {
                        x: child.position.x,
                        y: child.position.y,
                        z: child.position.z
                    };
                }

                // Store initial rotations for resetting gestures
                if (bonesRef.current[child.name] || ['Spine1', 'Spine2', 'Head', 'Neck', 'LeftEye', 'RightEye'].includes(child.name)) {
                    initialRotations.current[child.name] = {
                        x: child.rotation.x,
                        y: child.rotation.y,
                        z: child.rotation.z
                    };
                }
            }
        });
    }, [scene]);

    // ==========================================
    // ASL PLAYBACK SEQUENCER ENGINE
    // ==========================================
    const fbxCacheRef = useRef({});
    const fbxLoader = React.useMemo(() => new FBXLoader(), []);
    const aslQueueRef = useRef([]);
    const aslIndexRef = useRef(-1);
    const aslPlayingRef = useRef(false);
    const activeFbxRef = useRef(null);
    const activeMixerRef = useRef(null);
    const aslLerpWeightRef = useRef(0);
    const [aslStateInternal, setAslStateInternal] = useState({ isASLPlaying: false, currentIndex: -1 });

    const playAslItem = React.useCallback(async (index) => {
        if (!aslPlayingRef.current) return;

        if (index < 0 || index >= aslQueueRef.current.length) {
            // Queue finished!
            aslPlayingRef.current = false;
            setAslStateInternal({ isASLPlaying: false, currentIndex: -1 });
            aslIndexRef.current = -1;
            activeFbxRef.current = null;
            activeMixerRef.current = null;
            if (onAslStateChange) {
                onAslStateChange({
                    isASLPlaying: false,
                    currentIndex: -1,
                    aslQueue: aslQueueRef.current
                });
            }
            return;
        }

        const item = aslQueueRef.current[index];
        aslIndexRef.current = index;
        setAslStateInternal({ isASLPlaying: true, currentIndex: index });

        if (onAslStateChange) {
            onAslStateChange({
                isASLPlaying: true,
                currentIndex: index,
                aslQueue: aslQueueRef.current
            });
        }

        if (item.type === 'pause') {
            activeFbxRef.current = null;
            activeMixerRef.current = null;
            setTimeout(() => {
                if (aslIndexRef.current === index && aslPlayingRef.current) {
                    playAslItem(index + 1);
                }
            }, item.duration || 350);
            return;
        }

        if (item.type === 'letter') {
            try {
                let fbx = fbxCacheRef.current[item.gloss];
                if (!fbx) {
                    fbx = await fbxLoader.loadAsync(item.path);
                    
                    // Pre-traverse and cache the FBX bone mappings
                    const bones = {};
                    fbx.traverse(obj => {
                        if (obj.isBone) {
                            bones[obj.name] = obj;
                        }
                    });
                    fbx.userData.bones = bones;
                    fbxCacheRef.current[item.gloss] = fbx;
                }

                activeFbxRef.current = fbx;

                const mixer = new THREE.AnimationMixer(fbx);
                activeMixerRef.current = mixer;

                if (fbx.animations.length > 0) {
                    const action = mixer.clipAction(fbx.animations[0]);
                    action.setLoop(THREE.LoopOnce);
                    action.clampWhenFinished = true;
                    action.setEffectiveTimeScale(item.speed || 1.8);
                    action.play();

                    const durationMs = (fbx.animations[0].duration / (item.speed || 1.8)) * 1000;
                    setTimeout(() => {
                        if (aslIndexRef.current === index && aslPlayingRef.current) {
                            playAslItem(index + 1);
                        }
                    }, durationMs);
                } else {
                    playAslItem(index + 1);
                }
            } catch (e) {
                console.error("Failed to load/play ASL fbx clip", e);
                playAslItem(index + 1);
            }
        }
    }, [fbxLoader, onAslStateChange]);

    useEffect(() => {
        if (!aslEnabled) return;

        if (customAslQueue) {
            if (customAslQueue.length === 0) {
                aslPlayingRef.current = false;
                setAslStateInternal({ isASLPlaying: false, currentIndex: -1 });
                aslIndexRef.current = -1;
                activeFbxRef.current = null;
                activeMixerRef.current = null;
                if (onAslStateChange) {
                    onAslStateChange({
                        isASLPlaying: false,
                        currentIndex: -1,
                        aslQueue: []
                    });
                }
            } else {
                aslQueueRef.current = customAslQueue;
                aslPlayingRef.current = true;
                playAslItem(0);
            }
        }
    }, [customAslQueue, aslEnabled, playAslItem, onAslStateChange]);

    // Audio State Refs
    const audioRef = useRef(null)
    const audioStartTimeRef = useRef(0)
    const audioIndexRef = useRef(0)
    const isPlayingRef = useRef(false)
    const currentVisemesRef = useRef([])
    const currentTextRef = useRef("")

    // Audio Analysis Refs for Prosody
    const audioCtxRef = useRef(null)
    const analyserRef = useRef(null)
    const dataArrayRef = useRef(null)

    // Phase 7: Procedural Head Motion Engine
    const headLayerRef = useRef({
        idle: { pitch: 0, yaw: 0, roll: 0 },
        speech: { pitch: 0, yaw: 0, roll: 0 },
        emphasis: { pitch: 0, yaw: 0, roll: 0 },
        question: { pitch: 0, yaw: 0, roll: 0 },
        engagement: { pitch: 0, yaw: 0, roll: 0 }
    });

    // Lip Sync Layer
    const lipLayerRef = useRef({})

    // Trigger sequential audio chunk playback
    const audioChunksRef = useRef(audioChunks);

    // ==========================================
    // ANIMATION MIXER FOR MIXAMO GESTURES
    // ==========================================
    const mixerRef = useRef(null);
    const actionsRef = useRef({});
    const [animationsLoaded, setAnimationsLoaded] = useState(false);

    useEffect(() => {
        if (!scene) return;
        
        // Initialize the mixer
        mixerRef.current = new THREE.AnimationMixer(scene);

        // We load the GLB animation files manually to avoid Suspense crashing if they are missing
        const loader = new GLTFLoader();
        const loadAnim = (name, url, isLooping = false, bodyPartMask = 'armsOnly') => {
            return new Promise((resolve) => {
                loader.load(url, (gltf) => {
                    const clip = gltf.animations[0];
                    if (clip) {
                        console.log(`Successfully loaded animation clip '${name}' from ${url}. duration:`, clip.duration);
                        
                        // FIX: Mixamo animations prefix bones with 'mixamorig_'. Ready Player Me doesn't use this prefix.
                        // We must strip this prefix from every track name so THREE.AnimationMixer can find the bones.
                        // FIX 2: Mixamo animations contain global position data (Hips.position) which teleports/zooms the avatar.
                        // We filter out ALL position tracks so the avatar stays exactly where they are and only rotates.
                        clip.tracks = clip.tracks.filter(track => {
                            track.name = track.name.replace('mixamorig_', '');
                            
                            // Delete translation data (unless we explicitly need full body raw motion like bowing)
                            if (bodyPartMask !== 'fullBody' && track.name.includes('.position')) return false; 
                            
                            const isArmOrHand = track.name.includes('Arm') || track.name.includes('Hand') || track.name.includes('Shoulder');
                            const isCoreOrHead = track.name.includes('Spine') || track.name.includes('Neck') || track.name.includes('Head') || track.name.includes('Hips');
                            
                            if (bodyPartMask === 'armsOnly') {
                                if (!isArmOrHand) return false;
                            } else if (bodyPartMask === 'headOnly') {
                                // For 'Looking Around' we don't want arms to move, only Spine, Neck, Head
                                if (!isCoreOrHead) return false;
                            } else if (bodyPartMask === 'upperBody') {
                                // For things like shrugging or listening where arms AND head move
                                if (!isArmOrHand && !isCoreOrHead) return false;
                            }

                            return true;
                        });

                        const action = mixerRef.current.clipAction(clip);
                        action.clipId = name;
                        
                        // Set looping behavior based on parameter
                        if (isLooping) {
                            action.loop = THREE.LoopRepeat;
                            action.clampWhenFinished = false;
                        } else {
                            action.loop = THREE.LoopOnce;
                            action.clampWhenFinished = true;
                        }
                        
                        actionsRef.current[name] = action;
                    } else {
                        console.warn(`File ${url} loaded but contained NO animations inside it.`);
                    }
                    resolve();
                }, undefined, (error) => {
                    console.warn(`Could not find ${url} - Please download from Mixamo and place in public/animations/`);
                    resolve(); // resolve anyway so we don't hold up Promise.all
                });
            });
        };

        // Load requested emotes independently
        const animationsToLoad = [
            { id: 'hello', url: 'animations/Wave.glb', isLooping: false, mask: 'armsOnly' },
            { id: 'thumbsUp', url: 'animations/ThumbsUp.glb', isLooping: false, mask: 'armsOnly' },
            { id: 'thankYou', url: 'animations/ThankYou.glb', isLooping: false, mask: 'armsOnly' },
            { id: 'clapping', url: 'animations/clapping.glb', isLooping: false, mask: 'armsOnly' },
            { id: 'shrugging', url: 'animations/shrugging.glb', isLooping: false, mask: 'upperBody' },
            { id: 'lookingAround', url: 'animations/LookingAround.glb', isLooping: false, mask: 'headOnly' },
            { id: 'bow', url: 'animations/Quick%20Formal%20Bow.glb', isLooping: false, mask: 'fullBody' },
            { id: 'fistRaise', url: 'animations/Cheerful%20Fist%20Raise.glb', isLooping: false, mask: 'upperBody' },
            { id: 'listening', url: 'animations/listening.glb', isLooping: true, mask: 'upperBody' },
            { id: 'laughing', url: 'animations/Laughing.glb', isLooping: false, mask: 'upperBody' },
            { id: 'praying', url: 'animations/Praying.glb', isLooping: false, mask: 'upperBody' },
            { id: 'pickingUp', url: 'animations/Picking%20Up.glb', isLooping: false, mask: 'upperBody' },
            { id: 'idle_0', url: 'animations/Idle/Looking.glb', isLooping: false, mask: 'fullBodyNoTranslation' },
            { id: 'idle_1', url: 'animations/Idle/Walk%20In%20Circle.glb', isLooping: false, mask: 'fullBodyNoTranslation' },
            { id: 'idle_3', url: 'animations/Idle/Look%20Around.glb', isLooping: false, mask: 'fullBodyNoTranslation' },
            { id: 'idle_4', url: 'animations/Idle/Look%20Around%20(1).glb', isLooping: false, mask: 'fullBodyNoTranslation' }
        ];

        Promise.allSettled(animationsToLoad.map(anim => loadAnim(anim.id, anim.url, anim.isLooping, anim.mask))).then(() => {
            setAnimationsLoaded(true);
        });

        const handleFinished = (e) => {
            if (e.action.clipId && e.action.clipId.startsWith('idle_')) {
                idleRefreshTriggerRef.current += 1;
            }
        };
        mixerRef.current.addEventListener('finished', handleFinished);

        return () => {
            if (mixerRef.current) {
                mixerRef.current.stopAllAction();
                mixerRef.current.removeEventListener('finished', handleFinished);
            }
        };
    }, [scene]);

    // We track the currently playing gesture to only trigger transitions on change edges
    const prevGestureRef = useRef('none');
    const prevFaceDetectedRef = useRef(true);
    const activeIdleAnimationRef = useRef('idle_0');
    const idleRefreshTriggerRef = useRef(0);
    const lastIdleRefreshTriggerRef = useRef(0);
    const noFaceTimerRef = useRef(0);
    const nextIdleWaitTimeRef = useRef(20 + Math.random() * 10);
    const lastLipMoveTimeRef = useRef(0);
    const hasSpokenInSessionRef = useRef(false);

    useEffect(() => {
        audioChunksRef.current = audioChunks;

        // If the queue was wiped (new user message), reset our internal sequencer
        if (audioChunks.length === 0) {
            if (audioRef.current) {
                audioRef.current.pause();
                if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
                    URL.revokeObjectURL(audioRef.current.src);
                }
                audioRef.current = null;
            }
            audioIndexRef.current = 0;
            isPlayingRef.current = false;
            currentVisemesRef.current = [];
            hasSpokenInSessionRef.current = false;
            return;
        }

        // Try to start playing if new chunks arrived and we are idle
        if (!isPlayingRef.current) {
            playNextAudio();
        }
    }, [audioChunks])

    const playNextAudio = () => {
        // Yield if we exhausted the current queue (using the Ref to avoid stale closures!)
        if (audioIndexRef.current >= audioChunksRef.current.length) {
            isPlayingRef.current = false;
            return;
        }

        isPlayingRef.current = true;
        const chunk = audioChunksRef.current[audioIndexRef.current];
        audioIndexRef.current++;

        const audio = new Audio(chunk.url);
        currentVisemesRef.current = chunk.visemes;
        currentTextRef.current = chunk.text || "";

        // Phase 7: Question & Engagement Triggers
        const isQuestion = currentTextRef.current.trim().endsWith('?');
        const headLayer = headLayerRef.current;
        const mState = microState.current;

        // Start engagement lean
        headLayer.engagement.pitch = -0.03;

        if (isQuestion) {
            headLayer.question.pitch = 0.05;
            mState.questionBrow = 0.4;
        } else {
            mState.questionBrow = 0.0;
        }

        // Setup Web Audio Analyser for Prosody
        if (!audioCtxRef.current) {
            try {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                analyserRef.current = audioCtxRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;
                dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
            } catch (e) { console.error("Audio Context Init error", e) }
        }

        if (audioCtxRef.current && analyserRef.current) {
            try {
                // To avoid "cannot connect to multiple nodes" error on blob URLs, 
                // we recreate the source node for this new Audio element
                const source = audioCtxRef.current.createMediaElementSource(audio);
                source.connect(analyserRef.current);
                analyserRef.current.connect(audioCtxRef.current.destination);
            } catch (e) { console.warn("Media element source creation failed or already connected", e) }
        }

        let playbackStarted = false;
        const startPlayback = () => {
            if (playbackStarted) return;
            playbackStarted = true;

            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }

            const playDelayMs = 0;
            mState.brow = audioIndexRef.current === 1 ? 0.2 : mState.brow;

            // The head.rotation.x tilt is handled via scene.rotation in the animation loop
            mState.isThinkingBuffer = playDelayMs > 0;

        setTimeout(() => {
                mState.isThinkingBuffer = false;

                if (props.onChunkAffect) {
                    props.onChunkAffect(chunk);
                }

                audio.play().catch(e => {
                    console.error("Error playing audio chunk", e);
                    currentVisemesRef.current = [];
                    playNextAudio();
                });
            }, playDelayMs);
        };

        audio.oncanplay = startPlayback;
        audio.oncanplaythrough = startPlayback;
        audio.onloadeddata = startPlayback;

        audio.onplay = () => {
            audioStartTimeRef.current = performance.now();
        };

        audio.onended = () => {
            // Chunk finished. Immediately recurse. We are using Refs so the closure doesn't break.
            currentVisemesRef.current = [];
            if (chunk.url && chunk.url.startsWith('blob:')) {
                URL.revokeObjectURL(chunk.url);
            }
            if (props.onChunkEnd) {
                try {
                    props.onChunkEnd(chunk);
                } catch (e) {}
            }
            playNextAudio();
        };

        audio.onerror = (e) => {
            console.error("Audio Load Error:", e);
            currentVisemesRef.current = [];
            if (chunk.url && chunk.url.startsWith('blob:')) {
                URL.revokeObjectURL(chunk.url);
            }
            playNextAudio();
        };

        audioRef.current = audio;
        audio.load();
        if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
            startPlayback();
        }
    }

    // Micro-expression state
    const microState = useRef({
        blink: 0,
        brow: 0,
        breathing: 0,
        blinkTimer: 0,
        nextBlinkTime: randomRange(3, 6),
        browTimer: 0,
        nextBrowTime: randomRange(10, 20)
    })

    // Find all meshes with morph targets
    useEffect(() => {
        const meshes = [];
        scene.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary) {
                // If it has a substantial amount of morph targets, it's likely part of the ARKit face
                if (Object.keys(child.morphTargetDictionary).length > 50) {
                    meshes.push(child);
                }
            }
        })
        morphMeshesRef.current = meshes;
    }, [scene])

    // Micro expression persistent state tracking
    const activeMicroRef = useRef({
        type: null,
        intensity: 0,
        endTime: 0
    });

    useEffect(() => {
        if (activeMicroExpression && activeMicroExpression.type && microExpressions[activeMicroExpression.type]) {
            // Apply randomized variation on duration provided by the new dictionary
            const baseMs = microExpressions[activeMicroExpression.type].duration || 400;
            // The backend provides duration in seconds, but if it doesn't, we adapt it
            let dynamicDuration = activeMicroExpression.duration 
                                  ? (activeMicroExpression.duration * 1000) 
                                  : (baseMs + Math.random() * 100);
            
            // USER FIX: Multiply duration dramatically so they visibly linger over speech noise
            dynamicDuration *= 3.0; // scale 400ms to 1200ms

            activeMicroRef.current = {
                type: activeMicroExpression.type,
                // USER FIX: Multiply intensity so it pierces through the base viseme offsets
                intensity: (activeMicroExpression.intensity || 1.0) * 1.5,
                endTime: performance.now() + dynamicDuration
            };
        }
    }, [activeMicroExpression])

    // Interpolate morph targets every frame
    useFrame((state, delta) => {
        if (morphMeshesRef.current.length === 0) return

        const time = state.clock.elapsedTime
        const mState = microState.current;

        // --- VISUAL LIP VAD ---
        if (isListening && faceData.current && faceData.current.hasFace) {
            const lipDist = faceData.current.lipDistance || 0;
            // threshold for mouth being open enough to be considered speaking
            if (lipDist > 0.035) {
                lastLipMoveTimeRef.current = time;
                hasSpokenInSessionRef.current = true;
            }
            
            // if they started speaking, and 2.0s has passed since they closed their mouth
            if (hasSpokenInSessionRef.current && (time - lastLipMoveTimeRef.current > 2.0)) {
                if (props.onSilenceDetected) {
                    props.onSilenceDetected();
                }
                hasSpokenInSessionRef.current = false;
            }
        } else if (!isListening) {
            hasSpokenInSessionRef.current = false;
        }

        // Manage active micro-expression lerping
        let currentMicroType = activeMicroRef.current.type;
        let currentMicroIntensity = activeMicroRef.current.intensity;

        if (currentMicroType && performance.now() >= activeMicroRef.current.endTime) {
            // Decay
            activeMicroRef.current.intensity = THREE.MathUtils.lerp(activeMicroRef.current.intensity, 0, 0.1);
            currentMicroIntensity = activeMicroRef.current.intensity;
            if (currentMicroIntensity < 0.01) {
                activeMicroRef.current.type = null;
                currentMicroType = null;
            }
        }

        // 1. UPDATE MICRO EXPRESSION TIMERS
        mState.blinkTimer += delta;
        mState.browTimer += delta;

        // Trigger Blink
        if (mState.blinkTimer > mState.nextBlinkTime) {
            mState.blink = 1;
            mState.blinkTimer = 0;
            mState.nextBlinkTime = randomRange(3, 6);
        }

        // Decay Blink Naturally
        mState.blink = THREE.MathUtils.lerp(mState.blink, 0, 0.25);

        // Trigger Brow Twitch
        if (mState.browTimer > mState.nextBrowTime) {
            mState.brow = randomRange(0.1, 0.2);
            mState.browTimer = 0;
            mState.nextBrowTime = randomRange(10, 20);
        }

        // ==========================================
        // GESTURE SYNC (UI + Camera + Mic)
        // ==========================================
        if (animationsLoaded && mixerRef.current) {
            let desiredGesture = 'none';
            
            // 1. UI Buttons have highest priority
            if (currentGesture !== 'none') {
                desiredGesture = currentGesture;
            } 
            // 2. Microphone active state
            else if (isListening) {
                desiredGesture = 'none';
            }
            // 3. Camera tracking fallback
            else if (faceData.current && faceData.current.recognizedGesture !== 'none') {
                if (faceData.current.recognizedGesture === 'Thumb_Up') desiredGesture = 'thumbsUp';
                if (faceData.current.recognizedGesture === 'Open_Palm') desiredGesture = 'hello';
                // Add more mappings here if needed (e.g., 'Closed_Fist', 'Pointing_Up')
            }
            // 4. Idle fallback when NO face is detected
            else if (faceData.current && !faceData.current.hasFace) {
                noFaceTimerRef.current += delta;
                if (noFaceTimerRef.current > nextIdleWaitTimeRef.current) {
                    if (prevFaceDetectedRef.current === true || idleRefreshTriggerRef.current > lastIdleRefreshTriggerRef.current) {
                        lastIdleRefreshTriggerRef.current = idleRefreshTriggerRef.current;
                        const idles = ['idle_0', 'idle_1', 'idle_2', 'idle_3', 'idle_4'];
                        
                        let nextIdle = activeIdleAnimationRef.current;
                        while (nextIdle === activeIdleAnimationRef.current) {
                            nextIdle = idles[Math.floor(Math.random() * idles.length)];
                        }
                        activeIdleAnimationRef.current = nextIdle;
                        // Calculate next random wait time
                        nextIdleWaitTimeRef.current = 20 + Math.random() * 10;
                    }
                    desiredGesture = activeIdleAnimationRef.current;
                } else {
                    desiredGesture = 'none';
                }
            }

            if (faceData.current) {
                if (faceData.current.hasFace) {
                    noFaceTimerRef.current = 0;
                }
                prevFaceDetectedRef.current = faceData.current.hasFace;
            }

            // Detect edge change to trigger AnimationMixer transitions
            if (desiredGesture !== prevGestureRef.current) {
                console.log(`Gesture transitioning from ${prevGestureRef.current} to ${desiredGesture}`);
                
                // Fade out previous
                if (prevGestureRef.current !== 'none' && actionsRef.current[prevGestureRef.current]) {
                    actionsRef.current[prevGestureRef.current].fadeOut(0.5);
                }
                
                // Fade in new
                if (desiredGesture !== 'none' && actionsRef.current[desiredGesture]) {
                    actionsRef.current[desiredGesture].reset().fadeIn(0.5).play();
                }
                
                prevGestureRef.current = desiredGesture;
            }

            // Update Animation Mixer
            mixerRef.current.update(delta);
        }

        // Phase 7: Question behavior slow decay (mState.questionBrow)
        mState.questionBrow = THREE.MathUtils.lerp(mState.questionBrow || 0, 0, 0.05);

        // Phase 6: Network Idle Scaling
        // If we are waiting for the very first chunk from the backend (emotion weights thinking)
        let breathingAmplitude = 0.02;
        if (audioChunksRef.current.length === 0 && emotionWeights.thinking > 0.3) {
            breathingAmplitude = 0.05; // Escalate breathing to show anticipation
        }

        // Calculate continuous breathing motion
        mState.breathing = Math.sin(time * 1.5) * breathingAmplitude;

        // --- PHASE 4/5/6: Update Lip Sync Layer ---
        let currentVisemeLabel = "X"
        let isSpeaking = false;

        // Track how far we are into the CURRENT audio chunk for the 200ms Fade-In
        let chunkElapsedMs = 0;

        // Phase 7: Web Audio Energy
        let audioEnergy = 0;

        if (audioRef.current && !audioRef.current.paused && currentVisemesRef.current.length > 0) {
            isSpeaking = true;
            chunkElapsedMs = performance.now() - audioStartTimeRef.current;
            const elapsedSeconds = chunkElapsedMs / 1000;

            // Find the active phoneme block within the current chunk's timeline
            const currentCue = currentVisemesRef.current.find(v => elapsedSeconds >= v.start && elapsedSeconds <= v.end)
            if (currentCue) {
                currentVisemeLabel = currentCue.viseme;
            }

            // Extract Audio Energy for Emphasis Nod
            if (analyserRef.current && dataArrayRef.current) {
                analyserRef.current.getByteFrequencyData(dataArrayRef.current);
                let sum = 0;
                for (let i = 0; i < dataArrayRef.current.length; i++) {
                    sum += dataArrayRef.current[i];
                }
                audioEnergy = sum / dataArrayRef.current.length / 255.0; // Normalized 0-1
            }
        }

        const headLayer = headLayerRef.current;

        // 2. Idle Head Motion
        headLayer.idle.pitch = Math.sin(time * 1.2) * 0.005;
        headLayer.idle.yaw = Math.sin(time * 0.7) * 0.003;

        // 3. Speech Rhythm & 7. Prosody Emphasis
        if (isSpeaking) {
            headLayer.speech.pitch = Math.sin(time * 5) * 0.015;
            headLayer.speech.yaw = Math.sin(time * 2.5) * 0.008;

            if (audioEnergy > 0.6) {
                headLayer.emphasis.pitch = -0.08; // Quick nod down on loud words
            }
        } else {
            headLayer.speech.pitch = THREE.MathUtils.lerp(headLayer.speech.pitch, 0, 0.1);
            headLayer.speech.yaw = THREE.MathUtils.lerp(headLayer.speech.yaw, 0, 0.1);
        }

        // 4, 5, 6: Decay Layers
        headLayer.emphasis.pitch = THREE.MathUtils.lerp(headLayer.emphasis.pitch, 0, 0.15);
        headLayer.question.pitch = THREE.MathUtils.lerp(headLayer.question.pitch, 0, 0.05);
        headLayer.engagement.pitch = THREE.MathUtils.lerp(headLayer.engagement.pitch, 0, 0.02);

        // --- ATTENTION ENGINE OVERRIDE ---
        let trackingData = faceData.current;
        let isCrowdScanning = false;

        if (attentionState) {
            if (attentionState.state === 'ACTIVE' && attentionState.active_target) {
                trackingData = {
                    hasFace: true,
                    pitch: attentionState.active_target.pitch,
                    yaw: attentionState.active_target.yaw,
                    roll: 0,
                    userX: attentionState.active_target.userX,
                    userY: attentionState.active_target.userY
                };
            } else if (attentionState.state === 'CROWD') {
                isCrowdScanning = true;
                trackingData = { hasFace: false };
            }
            // If ATTRACT or SELECTING or IDLE, trackingData remains faceData.current (instant local snappiness)
        }

        // Crowd scanning behavior
        if (isCrowdScanning) {
            // Fast glancing back and forth
            const scanPhase = (time * 0.8) % (Math.PI * 2);
            // Sharp step function for quick glances
            const glanceAngle = Math.sin(scanPhase) > 0.6 ? 0.35 : (Math.sin(scanPhase) < -0.6 ? -0.35 : 0);
            headLayer.engagement.yaw = THREE.MathUtils.lerp(headLayer.engagement.yaw, glanceAngle, 0.15);
        } else if (isListening) {
            // USER REQUEST: Gentle nod loop instead of Mixamo animation
            const nodFreq = 3.5;
            const nodAmp = 0.035;
            headLayer.engagement.pitch = Math.sin(time * nodFreq) * nodAmp - (nodAmp / 1.5);
            headLayer.engagement.yaw = THREE.MathUtils.lerp(headLayer.engagement.yaw, 0, 0.1);
        } else {
            headLayer.engagement.yaw = THREE.MathUtils.lerp(headLayer.engagement.yaw, 0, 0.1);
        }

        // Calculate Base Positions
        const basePitch = mState.isThinkingBuffer ? -0.05 : 0;
        const baseYaw = 0;

        // Final Clamped Rotation Application
        let targetPitch = basePitch + headLayer.idle.pitch + headLayer.speech.pitch + headLayer.emphasis.pitch + headLayer.question.pitch + headLayer.engagement.pitch;
        let targetYaw = baseYaw + headLayer.idle.yaw + headLayer.speech.yaw + headLayer.engagement.yaw;
        let targetRoll = 0;

        // Apply Micro-Expression Head Rotations
        if (currentMicroType && microExpressions[currentMicroType]) {
            const microRot = microExpressions[currentMicroType].neck;
            if (microRot) {
                if (microRot.pitch) targetPitch += microRot.pitch * currentMicroIntensity * 1.5;
                if (microRot.yaw) targetYaw += microRot.yaw * currentMicroIntensity * 1.5;
                if (microRot.roll) targetRoll += microRot.roll * currentMicroIntensity * 1.5;
            }
        }

        if (trackingData.hasFace) {
            targetPitch += trackingData.pitch * 0.15;
            targetYaw += trackingData.yaw * 0.15;
            targetRoll += (trackingData.roll || 0) * 0.15;
        }

        const head = bonesRef.current.head;
        const neck = bonesRef.current.neck;

        if (head && neck) {
            // Distribute rotation between neck and head
            const neckPitch = targetPitch * 0.4;
            const headPitch = targetPitch * 0.6;
            
            const neckYaw = targetYaw * 0.4;
            const headYaw = targetYaw * 0.6;

            const neckRoll = targetRoll * 0.4;
            const headRoll = targetRoll * 0.6;

            // Eye tracking
            if (bonesRef.current.leftEye && bonesRef.current.rightEye && trackingData.hasFace) {
                // Base eye movement based on user position (inverse of where the face is)
                const eyePitch = -trackingData.userY * 0.15; 
                let eyeYaw = -trackingData.userX * 0.15; 

                // Look at limits for eyes (prevent unnatural white-eye rolling)
                const maxEyeYaw = 0.25;
                const maxEyePitch = 0.2;

                const clampedEyePitch = Math.max(-maxEyePitch, Math.min(maxEyePitch, eyePitch));
                const clampedEyeYaw = Math.max(-maxEyeYaw, Math.min(maxEyeYaw, eyeYaw));

                // Excess eye tracking (how far past the comfortable eye limit the user is)
                const excessYaw = eyeYaw - clampedEyeYaw;
                const excessPitch = eyePitch - clampedEyePitch;

                // Full Body Lean: We smoothly lean the spine towards the user continuously,
                // and then add the excess if they go super far.
                const baseSpineLeanPitch = eyePitch * 0.3; // 30% of the raw look tracking goes to the body
                const baseSpineLeanYaw = eyeYaw * 0.3;
                
                // Distribute across hips, spine, spine1, spine2 (4 joints now)
                const finalHipsPitch = (baseSpineLeanPitch + excessPitch * 0.2) * 0.25;
                const finalSpinePitch = (baseSpineLeanPitch + excessPitch * 0.2) * 0.25;
                const finalSpine1Pitch = (baseSpineLeanPitch + excessPitch * 0.2) * 0.25;
                const finalSpine2Pitch = (baseSpineLeanPitch + excessPitch * 0.2) * 0.25;

                const finalHipsYaw = (baseSpineLeanYaw + excessYaw * 0.2) * 0.25;
                const finalSpineYaw = (baseSpineLeanYaw + excessYaw * 0.2) * 0.25;
                const finalSpine1Yaw = (baseSpineLeanYaw + excessYaw * 0.2) * 0.25;
                const finalSpine2Yaw = (baseSpineLeanYaw + excessYaw * 0.2) * 0.25;

                // Add excess to neck/head too
                const finalNeckPitch = neckPitch + (excessPitch * 0.3);
                const finalHeadPitch = headPitch + (excessPitch * 0.5);

                const finalNeckYaw = neckYaw + (excessYaw * 0.3);
                const finalHeadYaw = headYaw + (excessYaw * 0.5);

                const hips = bonesRef.current.hips;
                const spine = bonesRef.current.spine;
                const spine1 = bonesRef.current.spine1;
                const spine2 = bonesRef.current.spine2;

                if (currentGesture === 'none') {
                    if (hips) {
                        hips.rotation.x = THREE.MathUtils.lerp(hips.rotation.x, finalHipsPitch, 0.15);
                        hips.rotation.y = THREE.MathUtils.lerp(hips.rotation.y, finalHipsYaw, 0.15);
                    }
                    if (spine) {
                        spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, finalSpinePitch, 0.15);
                        spine.rotation.y = THREE.MathUtils.lerp(spine.rotation.y, finalSpineYaw, 0.15);
                    }
                    if (spine1) {
                        spine1.rotation.x = THREE.MathUtils.lerp(spine1.rotation.x, finalSpine1Pitch, 0.15);
                        spine1.rotation.y = THREE.MathUtils.lerp(spine1.rotation.y, finalSpine1Yaw, 0.15);
                    }
                    if (spine2) {
                        spine2.rotation.x = THREE.MathUtils.lerp(spine2.rotation.x, finalSpine2Pitch, 0.15);
                        spine2.rotation.y = THREE.MathUtils.lerp(spine2.rotation.y, finalSpine2Yaw, 0.15);
                    }
                }

                neck.rotation.x = THREE.MathUtils.lerp(neck.rotation.x, finalNeckPitch, 0.15);
                neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, finalNeckYaw, 0.15);
                neck.rotation.z = THREE.MathUtils.lerp(neck.rotation.z, neckRoll, 0.15);

                head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, finalHeadPitch, 0.15);
                head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, finalHeadYaw, 0.15);
                head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, headRoll, 0.15);

                // Finally apply the clamped limits to the eyes
                const leftEye = bonesRef.current.leftEye;
                const rightEye = bonesRef.current.rightEye;

                leftEye.rotation.x = THREE.MathUtils.lerp(leftEye.rotation.x, clampedEyePitch, 0.2);
                leftEye.rotation.y = THREE.MathUtils.lerp(leftEye.rotation.y, clampedEyeYaw, 0.2);
                leftEye.rotation.z = THREE.MathUtils.lerp(leftEye.rotation.z, 0, 0.2); // reset any inherited z

                rightEye.rotation.x = THREE.MathUtils.lerp(rightEye.rotation.x, clampedEyePitch, 0.2);
                rightEye.rotation.y = THREE.MathUtils.lerp(rightEye.rotation.y, clampedEyeYaw, 0.2);
                rightEye.rotation.z = THREE.MathUtils.lerp(rightEye.rotation.z, 0, 0.2);
            } else {
               // Normal head calculation when eyes aren't tracking
               const hips = bonesRef.current.hips;
               const spine = bonesRef.current.spine;
               const spine1 = bonesRef.current.spine1;
               const spine2 = bonesRef.current.spine2;
               
               // Only apply procedural spine overrides if NO animation gesture is playing
               // If an animation is playing, the bone rotations are hijacked by the mixamo clip 
               // and we shouldn't fight it with these lerps.
               if (currentGesture === 'none') {
                   if (hips) {
                       hips.rotation.x = THREE.MathUtils.lerp(hips.rotation.x, 0, 0.15);
                       hips.rotation.y = THREE.MathUtils.lerp(hips.rotation.y, 0, 0.15);
                   }
                   if (spine) {
                       spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, 0, 0.15);
                       spine.rotation.y = THREE.MathUtils.lerp(spine.rotation.y, 0, 0.15);
                   }
                   if (spine1) {
                       spine1.rotation.x = THREE.MathUtils.lerp(spine1.rotation.x, 0, 0.15);
                       spine1.rotation.y = THREE.MathUtils.lerp(spine1.rotation.y, 0, 0.15);
                   }
                   if (spine2) {
                       spine2.rotation.x = THREE.MathUtils.lerp(spine2.rotation.x, 0, 0.15);
                       spine2.rotation.y = THREE.MathUtils.lerp(spine2.rotation.y, 0, 0.15);
                   }
               }

               neck.rotation.x = THREE.MathUtils.lerp(neck.rotation.x, neckPitch, 0.15);
               neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, neckYaw, 0.15);
               neck.rotation.z = THREE.MathUtils.lerp(neck.rotation.z, neckRoll, 0.15);
   
               head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, headPitch, 0.15);
               head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, headYaw, 0.15);
               head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, headRoll, 0.15);

               const leftEye = bonesRef.current.leftEye;
               const rightEye = bonesRef.current.rightEye;
               if (leftEye && rightEye) {
                   leftEye.rotation.x = THREE.MathUtils.lerp(leftEye.rotation.x, 0, 0.15);
                   leftEye.rotation.y = THREE.MathUtils.lerp(leftEye.rotation.y, 0, 0.15);
                   leftEye.rotation.z = THREE.MathUtils.lerp(leftEye.rotation.z, 0, 0.15);

                   rightEye.rotation.x = THREE.MathUtils.lerp(rightEye.rotation.x, 0, 0.15);
                   rightEye.rotation.y = THREE.MathUtils.lerp(rightEye.rotation.y, 0, 0.15);
                   rightEye.rotation.z = THREE.MathUtils.lerp(rightEye.rotation.z, 0, 0.15);
               }
            }
        } else {
            scene.rotation.x = THREE.MathUtils.lerp(
                scene.rotation.x,
                Math.max(-0.2, Math.min(0.2, targetPitch)),
                0.15
            );
            scene.rotation.y = THREE.MathUtils.lerp(
                scene.rotation.y,
                Math.max(-0.2, Math.min(0.2, targetYaw)),
                0.15
            );
        }

        const targetVisemeMap = visemeMap[currentVisemeLabel] || visemeMap.X;

        // Phase 6: Soft Lip Fade-In
        // Scale the lip shape globally based on whether we just started playing the chunk
        // If elapsed is < 200ms, lerp intensity up to 1.0 to prevent explosive 1-frame snapping
        let lipIntensity = 1.0;
        if (isSpeaking && chunkElapsedMs < 200) {
            lipIntensity = THREE.MathUtils.lerp(0.0, 1.0, chunkElapsedMs / 200);
        } else if (!isSpeaking) {
            lipIntensity = 0.0;
        }

        // Smooth out the lip movements into the lipLayer object
        const lipLayer = lipLayerRef.current;
        Object.keys(visemeMap).forEach(vis => {
            const visObj = visemeMap[vis];
            Object.keys(visObj).forEach(muscle => {
                const targetValue = (targetVisemeMap[muscle] || 0) * lipIntensity;
                lipLayer[muscle] = THREE.MathUtils.lerp(
                    lipLayer[muscle] || 0,
                    targetValue,
                    0.4 // Quick snappy interpolation for lips
                )
            })
        })

        morphMeshesRef.current.forEach((mesh) => {
            const dict = mesh.morphTargetDictionary
            const influences = mesh.morphTargetInfluences

            // Lerp all blendshapes towards their finalized targets (base + micro layer)
            Object.keys(dict).forEach((shapeName) => {
                const index = dict[shapeName]

                // Aggregate Base Emotion Value across all active emotion weights passed via WebSocket
                let aggregatedTargetValue = 0.0

                // e.g. emotionWeights = { happy: 0.72, nervous: 0.08 }
                for (const [emotionName, weight] of Object.entries(emotionWeights)) {
                    if (emotionMap[emotionName] && emotionMap[emotionName][shapeName]) {

                        // User Suggestion 3: Emotion-Aware Lip Scaling
                        // If they are happy AND speaking, increase jawOpen amplitude naturally
                        let multiplier = 1.0;
                        if (isSpeaking && emotionName === 'happy' && shapeName === 'jawOpen') multiplier = 1.2;
                        if (isSpeaking && emotionName === 'sad' && shapeName === 'jawOpen') multiplier = 0.8;

                        // Blend them together. 
                        aggregatedTargetValue += emotionMap[emotionName][shapeName] * weight * multiplier;
                    }
                }

                let targetValue = aggregatedTargetValue;

                // Additive Layer from explicitly fired Micro Expressions
                if (currentMicroType && microExpressions[currentMicroType]) {
                    const microBlendshapes = microExpressions[currentMicroType].blendshapes;
                    if (microBlendshapes && microBlendshapes[shapeName]) {
                        targetValue += microBlendshapes[shapeName] * currentMicroIntensity;
                    }
                }

                // Additive Micro-expression offsets
                // User Suggestion 2: Reduce blinking during speech mathematically
                const activeBlink = isSpeaking ? mState.blink * 0.5 : mState.blink;

                if (shapeName === 'eyeBlinkLeft' || shapeName === 'eyeBlinkRight') {
                    targetValue = targetValue + activeBlink;
                } else if (shapeName === 'jawOpen') {
                    targetValue = targetValue + Math.max(0, mState.breathing);
                } else if (shapeName === 'cheekPuff') {
                    targetValue = targetValue + Math.max(0, mState.breathing * 0.5);
                } else if (shapeName === 'browInnerUp') {
                    targetValue = targetValue + (mState.questionBrow || 0);
                } else if (shapeName === 'browOuterUpLeft' || shapeName === 'browOuterUpRight') {
                    targetValue = targetValue + mState.brow;
                } else if ((shapeName === 'eyeWideLeft' || shapeName === 'eyeWideRight') && isSpeaking) {
                    // Phase 7: Focus during speech
                    targetValue = targetValue + 0.1;
                }

                // Additive Lip Sync offset
                targetValue = targetValue + (lipLayer[shapeName] || 0)

                // Clamp final value against mesh distortion limits (max 1.0)
                targetValue = Math.min(1.0, targetValue);

                if (customBlendshapeOverrides && customBlendshapeOverrides[shapeName] !== undefined) {
                    targetValue = customBlendshapeOverrides[shapeName];
                }

                // Emotional + Phoneme Momentum smoothing. Lerp to target instead of snapping.
                influences[index] = THREE.MathUtils.lerp(
                    influences[index] || 0,
                    targetValue,
                    0.2 // interpolation pulled up to 0.2 to handle faster syllable snaps
                )
            })
        })

        // ==========================================
        // ASL BONE RETARGETING PLAYBACK
        // ==========================================
        if (aslEnabled) {
            const isCurrentLetter = aslPlayingRef.current && aslIndexRef.current >= 0 && aslQueueRef.current[aslIndexRef.current]?.type === 'letter';
            const targetLerpWeight = isCurrentLetter ? 1.0 : 0.0;
            aslLerpWeightRef.current = THREE.MathUtils.lerp(aslLerpWeightRef.current, targetLerpWeight, delta * 15);

            if (activeMixerRef.current) {
                activeMixerRef.current.update(delta);
            }

            if (aslLerpWeightRef.current > 0.001 && activeFbxRef.current) {
                const sourceBones = activeFbxRef.current.userData.bones || {};
                
                // Copy rotations from explicit boneMap (ONLY right arm/shoulder bones!)
                for (const sourceName in boneMap) {
                    const targetName = boneMap[sourceName];
                    
                    // Filter: Only right-side bones!
                    if (!targetName.startsWith('Right')) continue;

                    const sourceBone = sourceBones[sourceName];
                    const targetBone = avatarBonesRef.current[targetName];

                    if (sourceBone && targetBone) {
                        targetBone.quaternion.slerp(sourceBone.quaternion, aslLerpWeightRef.current);
                    }
                }

                // Dynamically copy right finger bones from the active FBX to the Ready Player Me model
                for (const sourceName in sourceBones) {
                    if (sourceName.startsWith('mixamorig') && !boneMap[sourceName]) {
                        const targetName = sourceName.replace('mixamorig', '');
                        
                        // Filter: Only RightHand finger bones!
                        if (!targetName.startsWith('RightHand')) continue;

                        const sourceBone = sourceBones[sourceName];
                        const targetBone = avatarBonesRef.current[targetName];

                        if (sourceBone && targetBone) {
                            targetBone.quaternion.slerp(sourceBone.quaternion, aslLerpWeightRef.current);
                        }
                    }
                }
            }
        }

        // Apply arm spacing translation offset (broaden shoulder width to prevent chest collision)
        const leftArm = avatarBonesRef.current['LeftArm'];
        const rightArm = avatarBonesRef.current['RightArm'];

        if (leftArm && initialPositions.current['LeftArm']) {
            // Restore left arm strictly to its default rest/pose position
            leftArm.position.copy(initialPositions.current['LeftArm']);
        }
        if (rightArm && initialPositions.current['RightArm']) {
            const initX = initialPositions.current['RightArm'].x;
            // Shift right arm outward relative to center (initX > 0 goes more positive, initX < 0 goes more negative)
            rightArm.position.x = initX > 0 ? (initX + armSpacingOffset) : (initX - armSpacingOffset);
        }

        // Guarantee scale is kept at 1.0 (no distortion/stretching of arms)
        if (leftArm) leftArm.scale.setScalar(1.0);
        if (rightArm) rightArm.scale.setScalar(1.0);
        const leftForeArm = avatarBonesRef.current['LeftForeArm'];
        const rightForeArm = avatarBonesRef.current['RightForeArm'];
        if (leftForeArm) leftForeArm.scale.setScalar(1.0);
        if (rightForeArm) rightForeArm.scale.setScalar(1.0);
    })

    // Adjust avatar position to center the face
    return <primitive object={scene} position={[0, -1.6, 0]} {...props} />
}

// Ensure you preload the model so it loads instantly on refresh if it's large
// useGLTF.preload('/model.glb')
