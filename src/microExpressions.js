export const microExpressions = {
// 😊 Positive / Friendly
    slight_smile: {
        blendshapes: { mouthSmileLeft: 0.25, mouthSmileRight: 0.25 },
        duration: 400
    },
    warm_smile: {
        blendshapes: { mouthSmileLeft: 0.45, mouthSmileRight: 0.45, cheekSquintLeft: 0.25, cheekSquintRight: 0.25 },
        duration: 600
    },
    soft_smile: {
        blendshapes: { mouthSmileLeft: 0.2, mouthSmileRight: 0.2, eyeSquintLeft: 0.15, eyeSquintRight: 0.15 },
        duration: 500
    },
    cheek_raise: {
        blendshapes: { cheekSquintLeft: 0.35, cheekSquintRight: 0.35 },
        duration: 300
    },
    eye_soften: {
        blendshapes: { eyeSquintLeft: 0.2, eyeSquintRight: 0.2 },
        duration: 300
    },
    gentle_nod_face: {
        neck: { pitch: -0.05 },
        blendshapes: {},
        duration: 250
    },
    micro_grin: {
        blendshapes: { mouthSmileLeft: 0.35, mouthSmileRight: 0.35, mouthStretchLeft: 0.15, mouthStretchRight: 0.15 },
        duration: 350
    },
    amused_smile: {
        blendshapes: { mouthSmileLeft: 0.4, mouthSmileRight: 0.3, cheekSquintLeft: 0.3, eyeSquintLeft: 0.2 },
        duration: 500
    },

// 😏 Confident / Playful
    smirk: {
        blendshapes: { mouthSmileLeft: 0.45, mouthSmileRight: 0.1, cheekSquintLeft: 0.25 },
        duration: 400
    },
    asymmetric_smile: {
        blendshapes: { mouthSmileLeft: 0.5, mouthSmileRight: 0.2 },
        duration: 450
    },
    confident_smile: {
        blendshapes: { mouthSmileLeft: 0.4, mouthSmileRight: 0.4, browOuterUpLeft: 0.2, browOuterUpRight: 0.2 },
        duration: 600
    },
    knowing_smile: {
        blendshapes: { mouthSmileLeft: 0.35, mouthSmileRight: 0.2, eyeSquintLeft: 0.25 },
        duration: 450
    },
    half_smile: {
        blendshapes: { mouthSmileLeft: 0.4, mouthSmileRight: 0.0 },
        duration: 350
    },
    subtle_pride: {
        blendshapes: { mouthSmileLeft: 0.25, mouthSmileRight: 0.25, browOuterUpLeft: 0.3, browOuterUpRight: 0.3 },
        duration: 600
    },
    playful_squint: {
        blendshapes: { eyeSquintLeft: 0.4, eyeSquintRight: 0.4, mouthSmileLeft: 0.2, mouthSmileRight: 0.2 },
        duration: 400
    },
    teasing_smile: {
        blendshapes: { mouthSmileLeft: 0.5, mouthSmileRight: 0.2, eyeSquintLeft: 0.3 },
        duration: 450
    },

// 🤨 Thinking / Curious
    eyebrow_raise: {
        blendshapes: { browInnerUp: 0.5, browOuterUpLeft: 0.3, browOuterUpRight: 0.3 },
        duration: 350
    },
    one_eyebrow_raise: {
        blendshapes: { browOuterUpLeft: 0.6, browOuterUpRight: 0.1 },
        duration: 350
    },
    brow_furrow_light: {
        blendshapes: { browDownLeft: 0.3, browDownRight: 0.3 },
        duration: 400
    },
    eye_squint_think: {
        blendshapes: { eyeSquintLeft: 0.35, eyeSquintRight: 0.35 },
        duration: 400
    },
    lip_purse: {
        blendshapes: { mouthPucker: 0.4 },
        duration: 400
    },
    slight_head_tension: {
        blendshapes: { jawForward: 0.2, mouthPressLeft: 0.2, mouthPressRight: 0.2 },
        duration: 400
    },
    focused_gaze: {
        blendshapes: { eyeWideLeft: 0.2, eyeWideRight: 0.2 },
        duration: 500
    },
    micro_tilt_face: {
        blendshapes: { eyeLookUpLeft: 0.2, eyeLookUpRight: 0.2 },
        duration: 300
    },
    pondering_lips: {
        blendshapes: { mouthPressLeft: 0.3, mouthPressRight: 0.3 },
        duration: 400
    },
    analytical_squint: {
        blendshapes: { eyeSquintLeft: 0.4, eyeSquintRight: 0.4, browDownLeft: 0.2, browDownRight: 0.2 },
        duration: 450
    },

// 😐 Neutral Enhancers
    blink_fast: {
        blendshapes: { eyeBlinkLeft: 1.0, eyeBlinkRight: 1.0 },
        duration: 120
    },
    blink_slow: {
        blendshapes: { eyeBlinkLeft: 1.0, eyeBlinkRight: 1.0 },
        duration: 250
    },
    eye_shift_left: {
        blendshapes: { eyeLookOutLeft: 0.5, eyeLookInRight: 0.5 },
        duration: 200
    },
    eye_shift_right: {
        blendshapes: { eyeLookInLeft: 0.5, eyeLookOutRight: 0.5 },
        duration: 200
    },
    micro_glance_down: {
        blendshapes: { eyeLookDownLeft: 0.4, eyeLookDownRight: 0.4 },
        duration: 250
    },
    micro_glance_up: {
        blendshapes: { eyeLookUpLeft: 0.4, eyeLookUpRight: 0.4 },
        duration: 250
    },

// 😕 Confusion / Doubt
    confused_brow: {
        blendshapes: { browInnerUp: 0.5, browDownLeft: 0.3, browDownRight: 0.3 },
        duration: 400
    },
    lip_press: {
        blendshapes: { mouthPressLeft: 0.5, mouthPressRight: 0.5 },
        duration: 400
    },
    slight_frown: {
        blendshapes: { mouthFrownLeft: 0.3, mouthFrownRight: 0.3 },
        duration: 400
    },
    asymmetrical_brow_raise: {
        blendshapes: { browOuterUpLeft: 0.6, browDownRight: 0.3 },
        duration: 400
    },
    uncertain_smile: {
        blendshapes: { mouthSmileLeft: 0.2, mouthSmileRight: 0.2, mouthFrownLeft: 0.2, mouthFrownRight: 0.2 },
        duration: 450
    },
    doubt_squint: {
        blendshapes: { eyeSquintLeft: 0.4, eyeSquintRight: 0.4, browDownLeft: 0.3, browDownRight: 0.3 },
        duration: 450
    },

// 😮 Surprise / Reaction
    quick_surprise: {
        blendshapes: { browInnerUp: 0.7, eyeWideLeft: 0.6, eyeWideRight: 0.6, jawOpen: 0.4 },
        duration: 300
    },
    micro_gasp: {
        blendshapes: { jawOpen: 0.5, mouthFunnel: 0.3 },
        duration: 300
    },
    eye_widen: {
        blendshapes: { eyeWideLeft: 0.7, eyeWideRight: 0.7 },
        duration: 250
    },
    brow_jump: {
        blendshapes: { browInnerUp: 0.8 },
        duration: 200
    },
    startled_blink: {
        blendshapes: { eyeBlinkLeft: 1.0, eyeBlinkRight: 1.0, browInnerUp: 0.4 },
        duration: 180
    },
    brief_freeze: {
        blendshapes: {},
        duration: 200
    },

// 😠 Negative / Tension
    micro_frown: {
        blendshapes: { mouthFrownLeft: 0.4, mouthFrownRight: 0.4 },
        duration: 400
    },
    jaw_clench: {
        blendshapes: { jawForward: 0.3, mouthPressLeft: 0.4, mouthPressRight: 0.4 },
        duration: 400
    },
    lip_tighten: {
        blendshapes: { mouthPressLeft: 0.5, mouthPressRight: 0.5 },
        duration: 400
    },
    nostril_flare_light: {
        blendshapes: { noseSneerLeft: 0.3, noseSneerRight: 0.3 },
        duration: 300
    },
    eye_narrow: {
        blendshapes: { eyeSquintLeft: 0.5, eyeSquintRight: 0.5 },
        duration: 400
    },
    tension_hold: {
        blendshapes: { browDownLeft: 0.4, browDownRight: 0.4, mouthPressLeft: 0.3, mouthPressRight: 0.3 },
        duration: 500
    }
};
