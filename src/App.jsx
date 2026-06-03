import React, { useState } from 'react';
import LandingPage from './LandingPage';

export default function App() {
  const [avatarModel, setAvatarModel] = useState('model.glb');

  return (
    <LandingPage
      navigateTo={() => {}}
      modelPath={avatarModel}
      setModelPath={setAvatarModel}
    />
  );
}
