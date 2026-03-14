import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Vibration } from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { styles } from './styles';

interface CameraCaptureProps {
  onCapture: (imageUri: string) => void;
  missionId: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, missionId }) => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permissions, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // FREE TIER: On-device OCR fallback
  const performOnDeviceOCR = async (imageUri: string) => {
    try {
      // Compress image for faster processing
      const processedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Basic OCR using Expo's built-in capabilities (free)
      // For production, you'd want ML Kit Text Recognition
      const ocrResult = {
        text: "DETECTED TEXT", // Mock - implement real OCR
        confidence: 0.8,
        bounds: [{ x: 100, y: 50, width: 200, height: 30 }]
      };

      return ocrResult;
    } catch (error) {
      console.error('OCR failed:', error);
      return null;
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || isProcessing) return;

    setIsProcessing(true);
    
    try {
      // Haptic feedback for "spy feel"
      Vibration.vibrate(100);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo.uri) {
        onCapture(photo.uri);
      }
    } catch (error) {
      console.error('Camera capture failed:', error);
      Alert.alert('Errore', 'Impossibile catturare l\'immagine');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const requestCameraPermission = async () => {
    const granted = await requestPermission();
    if (!granted) {
      Alert.alert(
        'Permesso Richiesto',
        'La fotocamera è necessaria per estrarre l\'intelligenza dai documenti',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'OK', onPress: requestPermission }
        ]
      );
    }
  };

  if (!permissions) {
    return <View style={styles.container} />;
  }

  if (!permissions.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color="#00FF88" />
        <Text style={styles.permissionText}>Permesso Fotocamera Richiesto</Text>
        <Text style={styles.permissionSubtext}>
          Abilita l'accesso alla fotocamera per catturare documenti
        </Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={requestCameraPermission}
        >
          <Text style={styles.permissionButtonText}>Concedi Permesso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView 
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="picture"
        zoom={0}
      >
        {/* Scanning overlay for "spy feel" */}
        <View style={styles.overlayContainer}>
          <View style={styles.scanLine} />
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity 
            style={styles.flipButton} 
            onPress={toggleCameraFacing}
          >
            <Ionicons name="camera-reverse-outline" size={24} color="#00FF88" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
            onPress={takePicture}
            disabled={isProcessing}
          >
            <View style={styles.captureButtonInner}>
              {isProcessing ? (
                <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
              ) : (
                <Ionicons name="camera" size={32} color="#000" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.flashButton}>
            <Ionicons name="flash-off-outline" size={24} color="#00FF88" />
          </TouchableOpacity>
        </View>

        {/* Mission indicator */}
        <View style={styles.missionIndicator}>
          <Text style={styles.missionText}>MISSION: {missionId?.slice(-8).toUpperCase()}</Text>
        </View>
      </CameraView>
    </View>
  );
};