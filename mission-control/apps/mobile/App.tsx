import React from 'react';
import { MissionControlUITest } from './MissionControlUITest';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <MissionControlUITest />
    </>
  );
}