Because Mixamo requires an Adobe Login, I cannot download these files automatically for you.
Please follow these quick steps to get perfect animations:

1. Go to https://www.mixamo.com/ and log in with your Adobe account.
2. In the "Characters" tab, search for "Y Bot" or any basic humanoid and select it (this ensures a clean rig).
3. In the "Animations" tab, search for:
   - "Waving" -> Download as "Wave.glb" (or download as FBX and convert to GLB).
   - "Thumbs Up" -> Download as "ThumbsUp.glb".
   - "Praying" -> Download as "ThankYou.glb".
4. When downloading, choose "Format: glTF (.glb)" if available. If Mixamo only offers FBX, use a free online FBX to GLB converter or export it through Blender.
5. Place these three exact files: `Wave.glb`, `ThumbsUp.glb`, and `ThankYou.glb` inside this folder (`public/animations/`).

The codebase is already fully wired up with THREE.AnimationMixer to play them instantly when the UI buttons are clicked!
