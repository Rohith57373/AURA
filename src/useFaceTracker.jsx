import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, GestureRecognizer, FilesetResolver } from '@mediapipe/tasks-vision';
import ReconnectingWebSocket from 'reconnecting-websocket';

export function useFaceTracker(enabled = true) {
    const [isLoaded, setIsLoaded] = useState(false);
    const videoRef = useRef(null);
    const faceData = useRef({
        yaw: 0,
        pitch: 0,
        roll: 0,
        userX: 0,
        userY: 0,
        hasFace: false,
        recognizedGesture: 'none',
        landmarks: null
    });
    const crowdData = useRef([]);
    const visionWsRef = useRef(null);

    useEffect(() => {
        if (!enabled) return;
        visionWsRef.current = new ReconnectingWebSocket('ws://localhost:8002/ws/vision');
        return () => {
            if (visionWsRef.current) visionWsRef.current.close();
        };
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;
        let landmarker = null;
        let animationFrameId = null;
        let stream = null;

        const video = document.createElement('video');
        video.style.display = 'none';
        video.autoplay = true;
        video.playsInline = true;
        document.body.appendChild(video);
        videoRef.current = video;

        const initializeMediaPipe = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );

                const faceLandmarkerPromise = FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 5
                });

                const gestureRecognizerPromise = GestureRecognizer.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2
                });

                const [loadedLandmarker, loadedRecognizer] = await Promise.all([
                    faceLandmarkerPromise,
                    gestureRecognizerPromise
                ]);

                landmarker = loadedLandmarker;
                // We'll store recognizer on the window or local var for the loop
                window.gestureRecognizer = loadedRecognizer;

                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 } 
                });
                
                video.srcObject = stream;
                
                video.addEventListener("loadeddata", () => {
                    setIsLoaded(true);
                    predictWebcam();
                });
                
            } catch (err) {
                console.error("Error initializing MediaPipe or Webcam", err);
            }
        };

        const predictWebcam = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
                animationFrameId = requestAnimationFrame(predictWebcam);
                return;
            }

            let lastVideoTime = -1;
            const detectFrame = () => {
                if (!videoRef.current) return;
                
                let startTimeMs = performance.now();
                if (videoRef.current.currentTime !== lastVideoTime) {
                    lastVideoTime = videoRef.current.currentTime;
                    
                    if (landmarker) {
                        const results = landmarker.detectForVideo(videoRef.current, startTimeMs);
                        
                        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                            let currentCrowd = [];
                            
                            for (let i = 0; i < results.faceLandmarks.length; i++) {
                                const landmarks = results.faceLandmarks[i];
                                const nose = landmarks[1];
                                const leftEyeCorner = landmarks[33];
                                const rightEyeCorner = landmarks[263];
                                const chin = landmarks[152];
                                const topHead = landmarks[10];
                                
                                const faceHeight = chin.y - topHead.y;
                                const upperLip = landmarks[13];
                                const lowerLip = landmarks[14];
                                const lipDistance = Math.abs(upperLip.y - lowerLip.y) / faceHeight;

                                const eyeCenterX = (leftEyeCorner.x + rightEyeCorner.x) / 2;
                                const eyeCenterY = (leftEyeCorner.y + rightEyeCorner.y) / 2;

                                const yaw = (nose.x - eyeCenterX) * 3.0; 
                                const pitch = ((nose.y - eyeCenterY) / faceHeight - 0.2) * -3.0;
                                const roll = Math.atan2(rightEyeCorner.y - leftEyeCorner.y, rightEyeCorner.x - leftEyeCorner.x);

                                let gazeX = 0;
                                let gazeY = 0;
                                let eyeOpennessLeft = 1;
                                let eyeOpennessRight = 1;

                                if (landmarks.length > 468) {
                                    const leftEyeTop = landmarks[159];
                                    const leftEyeBot = landmarks[145];
                                    const rightEyeTop = landmarks[386];
                                    const rightEyeBot = landmarks[374];
                                    
                                    const leftEyeHeight = Math.abs(leftEyeTop.y - leftEyeBot.y);
                                    const rightEyeHeight = Math.abs(rightEyeTop.y - rightEyeBot.y);
                                    
                                    eyeOpennessLeft = Math.max(0, Math.min(1, (leftEyeHeight / faceHeight) * 35));
                                    eyeOpennessRight = Math.max(0, Math.min(1, (rightEyeHeight / faceHeight) * 35));

                                    const leftIris = landmarks[468];
                                    const rightIris = landmarks[473];
                                    const leftEyeInner = landmarks[133];
                                    const leftEyeOuter = landmarks[33];
                                    const rightEyeInner = landmarks[362];
                                    const rightEyeOuter = landmarks[263];

                                    const leftEyeWidth = Math.abs(leftEyeInner.x - leftEyeOuter.x);
                                    const rightEyeWidth = Math.abs(rightEyeOuter.x - rightEyeInner.x);
                                    
                                    const leftGazeX = (leftIris.x - leftEyeOuter.x) / leftEyeWidth - 0.45;
                                    const rightGazeX = (rightIris.x - rightEyeInner.x) / rightEyeWidth - 0.45;
                                    gazeX = (leftGazeX + rightGazeX) / 2;
                                    
                                    const leftEyeVerticalRange = Math.abs(leftEyeTop.y - leftEyeBot.y);
                                    gazeY = (leftIris.y - leftEyeTop.y) / leftEyeVerticalRange - 0.45;
                                }

                                let faceEmotions = { happy: 0, sad: 0, angry: 0, surprised: 0, neutral: 1.0 };
                                if (results.faceBlendshapes && results.faceBlendshapes[i]) {
                                    const categories = results.faceBlendshapes[i].categories || [];
                                    const shapes = {};
                                    categories.forEach(c => {
                                        shapes[c.categoryName] = c.score;
                                    });
                                    
                                    const mouthSmileL = shapes['mouthSmileLeft'] || 0;
                                    const mouthSmileR = shapes['mouthSmileRight'] || 0;
                                    const mouthFrownL = shapes['mouthFrownLeft'] || 0;
                                    const mouthFrownR = shapes['mouthFrownRight'] || 0;
                                    const browDownL = shapes['browDownLeft'] || 0;
                                    const browDownR = shapes['browDownRight'] || 0;
                                    const browInnerUpL = shapes['browInnerUpLeft'] || 0;
                                    const browInnerUpR = shapes['browInnerUpRight'] || 0;
                                    const jawOpen = shapes['jawOpen'] || 0;
                                    const mouthPressL = shapes['mouthPressLeft'] || 0;
                                    const mouthPressR = shapes['mouthPressRight'] || 0;
                                    
                                    const happy = (mouthSmileL + mouthSmileR) / 2;
                                    const sad = (mouthFrownL + mouthFrownR + browDownL + browDownR) / 4;
                                    const angry = (browDownL + browDownR + mouthPressL + mouthPressR) / 4;
                                    const surprised = (browInnerUpL + browInnerUpR + jawOpen) / 3;
                                    
                                    const maxScore = Math.max(happy, sad, angry, surprised);
                                    if (maxScore > 0.15) {
                                        faceEmotions = {
                                            happy: Math.round(happy * 100) / 100,
                                            sad: Math.round(sad * 100) / 100,
                                            angry: Math.round(angry * 100) / 100,
                                            surprised: Math.round(surprised * 100) / 100,
                                            neutral: Math.round((1.0 - maxScore) * 100) / 100
                                        };
                                    }
                                }

                                currentCrowd.push({
                                    centerX: nose.x,
                                    centerY: nose.y,
                                    faceHeight: faceHeight,
                                    yaw: yaw,
                                    pitch: pitch,
                                    gazeX: gazeX * -4.0,
                                    gazeY: gazeY * -4.0,
                                    emotions: faceEmotions
                                });

                                // Only update faceData for the primary (first) face to keep Avatar backward compatible
                                if (i === 0) {
                                    faceData.current = {
                                        ...faceData.current,
                                        yaw: yaw,
                                        pitch: pitch,
                                        roll: -roll,
                                        userX: (nose.x - 0.5) * 5,
                                        userY: -(nose.y - 0.5) * 5,
                                        gazeX: gazeX * -4.0,
                                        gazeY: gazeY * -4.0,
                                        eyeOpennessLeft,
                                        eyeOpennessRight,
                                        lipDistance: lipDistance,
                                        hasFace: true,
                                        landmarks: landmarks
                                    };
                                }
                            }
                            crowdData.current = currentCrowd;

                            if (visionWsRef.current && visionWsRef.current.readyState === 1) {
                                visionWsRef.current.send(JSON.stringify({
                                    event: "vision_update",
                                    faces: currentCrowd
                                }));
                            }
                        } else {
                            faceData.current.hasFace = false;
                            faceData.current.landmarks = null;
                            crowdData.current = [];
                            
                            if (visionWsRef.current && visionWsRef.current.readyState === 1) {
                                visionWsRef.current.send(JSON.stringify({
                                    event: "vision_update",
                                    faces: []
                                }));
                            }
                        }

                        // Run Hand Gesture Recognition
                        if (window.gestureRecognizer) {
                            const gestureResults = window.gestureRecognizer.recognizeForVideo(videoRef.current, startTimeMs);
                            if (gestureResults.gestures && gestureResults.gestures.length > 0) {
                                // Prefer specific gestures over "None" if multiple hands detected
                                const activeGesture = gestureResults.gestures.find(g => g[0].categoryName !== "None");
                                if (activeGesture) {
                                    faceData.current.recognizedGesture = activeGesture[0].categoryName;
                                } else {
                                    faceData.current.recognizedGesture = 'none';
                                }
                            } else {
                                faceData.current.recognizedGesture = 'none';
                            }
                        }
                    }
                }
                animationFrameId = requestAnimationFrame(detectFrame);
            }
            detectFrame();
        }

        initializeMediaPipe();

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (stream) stream.getTracks().forEach(track => track.stop());
            if (videoRef.current) {
                videoRef.current.srcObject = null;
                document.body.removeChild(videoRef.current);
            }
            if (landmarker) landmarker.close();
            if (window.gestureRecognizer) {
                window.gestureRecognizer.close();
                window.gestureRecognizer = null;
            }
        };
    }, []);

    return { faceData, crowdData, isLoaded, videoElement: videoRef.current };
}
