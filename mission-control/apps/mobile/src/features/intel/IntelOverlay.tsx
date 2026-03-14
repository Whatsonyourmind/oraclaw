import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OverlayField } from '@mission-control/shared-types';
import { styles } from './styles';

const { width, height } = Dimensions.get('window');

interface IntelOverlayProps {
  imageUri: string;
  overlays: OverlayField[];
  actions: Array<{
    type: string;
    confidence: number;
    description: string;
  }>;
  onActionSelect: (action: any) => void;
  onRetake: () => void;
  onConfirm: () => void;
}

export const IntelOverlay: React.FC<IntelOverlayProps> = ({
  imageUri,
  overlays,
  actions,
  onActionSelect,
  onRetake,
  onConfirm,
}) => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    // Cinematic entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const renderOverlayFields = () => {
    return overlays.map((overlay, index) => {
      const confidence = overlay.confidence;
      const opacity = confidence > 0.8 ? 0.8 : confidence > 0.6 ? 0.6 : 0.4;
      
      return (
        <Animated.View
          key={index}
          style={[
            styles.overlayField,
            {
              left: (overlay.x / 100) * width,
              top: (overlay.y / 100) * height,
              width: (overlay.width / 100) * width,
              height: (overlay.height / 100) * height,
              opacity,
              borderColor: overlay.type === 'risk' ? '#FF4444' : '#00FF88',
              backgroundColor: overlay.type === 'risk' ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 255, 136, 0.1)',
            }
          ]}
        >
          <Text style={styles.overlayText}>
            {overlay.text.length > 20 ? `${overlay.text.slice(0, 20)}...` : overlay.text}
          </Text>
          <Text style={[styles.overlayText, { fontSize: 8 }]}>
            {Math.round(confidence * 100)}%
          </Text>
        </Animated.View>
      );
    });
  };

  const renderActions = () => {
    return actions.map((action, index) => {
      const isSelected = selectedAction === action.type;
      const confidence = action.confidence;
      
      return (
        <TouchableOpacity
          key={index}
          style={[
            styles.actionButton,
            isSelected && styles.actionButtonSelected,
            confidence < 0.7 && styles.actionButtonLowConfidence
          ]}
          onPress={() => setSelectedAction(action.type)}
        >
          <Ionicons 
            name={
              action.type === 'task' ? 'checkmark-circle' :
              action.type === 'reminder' ? 'notifications' :
              action.type === 'event' ? 'calendar' : 'document-text'
            }
            size={16}
            color={isSelected ? '#000' : '#00FF88'}
            style={{ marginRight: 8 }}
          />
          <Text style={[
            styles.actionButtonText,
            isSelected && styles.actionButtonTextSelected
          ]}>
            {action.description}
          </Text>
          <Text style={styles.confidenceText}>
            {Math.round(confidence * 100)}%
          </Text>
        </TouchableOpacity>
      );
    });
  };

  const handleConfirm = () => {
    if (selectedAction) {
      const action = actions.find(a => a.type === selectedAction);
      if (action) {
        onActionSelect(action);
      }
    }
    onConfirm();
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Image with overlay */}
      <View style={styles.imageContainer}>
        {/* This would be an Image component in real implementation */}
        <View style={styles.mockImage}>
          {renderOverlayFields()}
        </View>
      </View>

      {/* Intelligence summary */}
      <Animated.View 
        style={[styles.intelSummary, { transform: [{ scale: scaleAnim }] }]}
      >
        <View style={styles.intelHeader}>
          <Ionicons name="analytics-outline" size={24} color="#00FF88" />
          <Text style={styles.intelTitle}>INTELLIGENCE ANALYSIS</Text>
        </View>
        
        <View style={styles.intelStats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{overlays.length}</Text>
            <Text style={styles.statLabel}>FIELDS</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {overlays.filter(o => o.type === 'risk').length}
            </Text>
            <Text style={styles.statLabel}>RISKS</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {Math.round((overlays.reduce((sum, o) => sum + o.confidence, 0) / overlays.length) * 100)}%
            </Text>
            <Text style={styles.statLabel}>CONFIDENCE</Text>
          </View>
        </View>

        {/* Suggested actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>RECOMMENDED ACTIONS</Text>
          <View style={styles.actionsContainer}>
            {renderActions()}
          </View>
        </View>
      </Animated.View>

      {/* Controls */}
      <View style={styles.overlayControls}>
        <TouchableOpacity 
          style={[styles.controlButton, styles.controlButtonSecondary]} 
          onPress={onRetake}
        >
          <Ionicons name="camera-outline" size={20} color="#00FF88" />
          <Text style={styles.controlButtonTextSecondary}>RIPRENDI</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.controlButton, 
            !selectedAction && styles.controlButtonDisabled
          ]} 
          onPress={handleConfirm}
          disabled={!selectedAction}
        >
          <Ionicons name="checkmark" size={20} color="#000" />
          <Text style={styles.controlButtonText}>CONFERMA MISSIONE</Text>
        </TouchableOpacity>
      </View>

      {/* Confidence warning */}
      {actions.some(a => a.confidence < 0.7) && (
        <View style={styles.confidenceWarning}>
          <Ionicons name="warning-outline" size={16} color="#FFA500" />
          <Text style={styles.confidenceWarningText}>
            Bassa affidabilità rilevata. Verifica manualmente.
          </Text>
        </View>
      )}
    </Animated.View>
  );
};