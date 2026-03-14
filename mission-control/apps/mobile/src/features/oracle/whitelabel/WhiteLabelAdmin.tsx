/**
 * WhiteLabelAdmin.tsx
 * Story wl-3 - Admin UI for white-label configuration
 *
 * Features:
 * - Color picker for brand colors
 * - Logo upload
 * - Live preview
 * - Domain configuration
 * - Feature flag toggles
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type {
  WhiteLabelConfig,
  ThemeMode,
  WhiteLabelFeatures,
  UpdateWhiteLabelConfigRequest,
} from '@mission-control/shared-types';

// ORACLE phase colors
const ORACLE_COLORS = {
  observe: '#00BFFF',
  orient: '#FFD700',
  decide: '#FF6B6B',
  act: '#00FF88',
};

// Default colors for color picker
const PRESET_COLORS = [
  '#00BFFF', '#FFD700', '#FF6B6B', '#00FF88',
  '#FF6B6B', '#9B59B6', '#3498DB', '#E74C3C',
  '#1ABC9C', '#F39C12', '#2ECC71', '#E91E63',
  '#00BCD4', '#FF5722', '#607D8B', '#795548',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, label }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [customColor, setCustomColor] = useState(value);

  return (
    <View style={styles.colorPickerContainer}>
      <Text style={styles.colorPickerLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.colorSwatch, { backgroundColor: value }]}
        onPress={() => setShowPicker(true)}
      >
        <Text style={styles.colorSwatchText}>{value}</Text>
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.colorPickerModal}>
            <Text style={styles.modalTitle}>Select {label}</Text>

            <View style={styles.presetColors}>
              {PRESET_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.presetColor,
                    { backgroundColor: color },
                    value === color && styles.selectedColor,
                  ]}
                  onPress={() => {
                    onChange(color);
                    setShowPicker(false);
                  }}
                />
              ))}
            </View>

            <View style={styles.customColorRow}>
              <Text style={styles.customColorLabel}>Custom:</Text>
              <TextInput
                style={styles.customColorInput}
                value={customColor}
                onChangeText={setCustomColor}
                placeholder="#FFFFFF"
                placeholderTextColor="#666"
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => {
                  if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
                    onChange(customColor.toUpperCase());
                    setShowPicker(false);
                  } else {
                    Alert.alert('Invalid Color', 'Please enter a valid hex color (e.g., #FF0000)');
                  }
                }}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

interface FeatureToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const FeatureToggle: React.FC<FeatureToggleProps> = ({ label, description, value, onChange }) => (
  <View style={styles.featureToggle}>
    <View style={styles.featureInfo}>
      <Text style={styles.featureLabel}>{label}</Text>
      {description && <Text style={styles.featureDescription}>{description}</Text>}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: '#333', true: ORACLE_COLORS.act }}
      thumbColor={value ? '#fff' : '#888'}
    />
  </View>
);

interface SectionProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}

const Section: React.FC<SectionProps> = ({ title, icon, children, expanded = true, onToggle }) => (
  <View style={styles.section}>
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon} size={20} color={ORACLE_COLORS.orient} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {onToggle && (
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#888"
        />
      )}
    </TouchableOpacity>
    {expanded && <View style={styles.sectionContent}>{children}</View>}
  </View>
);

// Live preview component
interface PreviewProps {
  config: Partial<WhiteLabelConfig>;
}

const LivePreview: React.FC<PreviewProps> = ({ config }) => (
  <View style={[styles.preview, { backgroundColor: config.primary_color || '#00BFFF' }]}>
    <View style={styles.previewHeader}>
      {config.logo_url ? (
        <Image source={{ uri: config.logo_url }} style={styles.previewLogo} />
      ) : (
        <View style={styles.previewLogoPlaceholder}>
          <Ionicons name="image-outline" size={24} color="#fff" />
        </View>
      )}
      <Text style={styles.previewBrandName}>{config.brand_name || 'Brand Name'}</Text>
    </View>

    <View style={styles.previewOODA}>
      <View style={[styles.previewPhase, { backgroundColor: config.observe_color || ORACLE_COLORS.observe }]}>
        <Text style={styles.previewPhaseText}>O</Text>
      </View>
      <View style={[styles.previewPhase, { backgroundColor: config.orient_color || ORACLE_COLORS.orient }]}>
        <Text style={styles.previewPhaseText}>O</Text>
      </View>
      <View style={[styles.previewPhase, { backgroundColor: config.decide_color || ORACLE_COLORS.decide }]}>
        <Text style={styles.previewPhaseText}>D</Text>
      </View>
      <View style={[styles.previewPhase, { backgroundColor: config.act_color || ORACLE_COLORS.act }]}>
        <Text style={styles.previewPhaseText}>A</Text>
      </View>
    </View>

    <View style={styles.previewButtons}>
      <View style={[styles.previewButton, { backgroundColor: config.secondary_color || '#FFD700' }]}>
        <Text style={styles.previewButtonText}>Secondary</Text>
      </View>
      <View style={[styles.previewButton, { backgroundColor: config.accent_color || '#FF6B6B' }]}>
        <Text style={styles.previewButtonText}>Accent</Text>
      </View>
    </View>
  </View>
);

export const WhiteLabelAdmin: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    brand: true,
    colors: true,
    ooda: false,
    typography: false,
    domain: false,
    features: false,
  });

  // Mock initial config - would be loaded from API
  const [config, setConfig] = useState<Partial<WhiteLabelConfig>>({
    brand_name: 'ORACLE',
    brand_tagline: 'Autonomous Intelligence Loop',
    primary_color: '#00BFFF',
    secondary_color: '#FFD700',
    accent_color: '#FF6B6B',
    success_color: '#00FF88',
    warning_color: '#FFA500',
    error_color: '#FF4444',
    observe_color: '#00BFFF',
    orient_color: '#FFD700',
    decide_color: '#FF6B6B',
    act_color: '#00FF88',
    font_family: 'Inter',
    font_scale: 1.0,
    default_theme: 'dark',
    custom_domain: '',
    domain_verified: false,
    features_enabled: {
      oracle: true,
      teams: true,
      analytics: true,
      ai_tuning: true,
      voice: true,
      widgets: true,
      export: true,
    },
  });

  const [showPreview, setShowPreview] = useState(false);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const updateConfig = useCallback((updates: Partial<WhiteLabelConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateFeature = useCallback((feature: keyof WhiteLabelFeatures, enabled: boolean) => {
    setConfig((prev) => ({
      ...prev,
      features_enabled: {
        ...prev.features_enabled,
        [feature]: enabled,
      } as WhiteLabelFeatures,
    }));
  }, []);

  const handleLogoUpload = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please grant access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      updateConfig({ logo_url: result.assets[0].uri });
    }
  }, [updateConfig]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      Alert.alert('Success', 'White-label configuration saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  const handleVerifyDomain = useCallback(async () => {
    if (!config.custom_domain) {
      Alert.alert('Error', 'Please enter a domain first');
      return;
    }
    Alert.alert(
      'Domain Verification',
      `Add the following DNS record:\n\nType: TXT\nName: _oracle-verify\nValue: oracle-verify=${config.org_id || 'demo'}\n\nThen press Verify.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: async () => {
            // Simulate verification
            await new Promise((resolve) => setTimeout(resolve, 1000));
            updateConfig({ domain_verified: true });
            Alert.alert('Success', 'Domain verified successfully!');
          },
        },
      ]
    );
  }, [config.custom_domain, config.org_id, updateConfig]);

  const refreshConfig = useCallback(async () => {
    setIsLoading(true);
    // Simulate API fetch
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>White-Label Admin</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.previewToggle}
            onPress={() => setShowPreview(!showPreview)}
          >
            <Ionicons
              name={showPreview ? 'eye-off-outline' : 'eye-outline'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {showPreview && <LivePreview config={config} />}

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refreshConfig} tintColor="#fff" />
        }
      >
        {/* Brand Identity Section */}
        <Section
          title="Brand Identity"
          icon="business-outline"
          expanded={expandedSections.brand}
          onToggle={() => toggleSection('brand')}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Brand Name</Text>
            <TextInput
              style={styles.textInput}
              value={config.brand_name}
              onChangeText={(text) => updateConfig({ brand_name: text })}
              placeholder="Your Brand Name"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tagline</Text>
            <TextInput
              style={styles.textInput}
              value={config.brand_tagline}
              onChangeText={(text) => updateConfig({ brand_tagline: text })}
              placeholder="Your Brand Tagline"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Logo</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={handleLogoUpload}>
              {config.logo_url ? (
                <Image source={{ uri: config.logo_url }} style={styles.uploadedLogo} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={24} color="#888" />
                  <Text style={styles.uploadButtonText}>Upload Logo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Section>

        {/* Colors Section */}
        <Section
          title="Brand Colors"
          icon="color-palette-outline"
          expanded={expandedSections.colors}
          onToggle={() => toggleSection('colors')}
        >
          <ColorPicker
            label="Primary Color"
            value={config.primary_color || '#00BFFF'}
            onChange={(color) => updateConfig({ primary_color: color })}
          />
          <ColorPicker
            label="Secondary Color"
            value={config.secondary_color || '#FFD700'}
            onChange={(color) => updateConfig({ secondary_color: color })}
          />
          <ColorPicker
            label="Accent Color"
            value={config.accent_color || '#FF6B6B'}
            onChange={(color) => updateConfig({ accent_color: color })}
          />
          <ColorPicker
            label="Success Color"
            value={config.success_color || '#00FF88'}
            onChange={(color) => updateConfig({ success_color: color })}
          />
          <ColorPicker
            label="Warning Color"
            value={config.warning_color || '#FFA500'}
            onChange={(color) => updateConfig({ warning_color: color })}
          />
          <ColorPicker
            label="Error Color"
            value={config.error_color || '#FF4444'}
            onChange={(color) => updateConfig({ error_color: color })}
          />
        </Section>

        {/* OODA Phase Colors Section */}
        <Section
          title="OODA Phase Colors"
          icon="git-branch-outline"
          expanded={expandedSections.ooda}
          onToggle={() => toggleSection('ooda')}
        >
          <ColorPicker
            label="Observe Phase"
            value={config.observe_color || ORACLE_COLORS.observe}
            onChange={(color) => updateConfig({ observe_color: color })}
          />
          <ColorPicker
            label="Orient Phase"
            value={config.orient_color || ORACLE_COLORS.orient}
            onChange={(color) => updateConfig({ orient_color: color })}
          />
          <ColorPicker
            label="Decide Phase"
            value={config.decide_color || ORACLE_COLORS.decide}
            onChange={(color) => updateConfig({ decide_color: color })}
          />
          <ColorPicker
            label="Act Phase"
            value={config.act_color || ORACLE_COLORS.act}
            onChange={(color) => updateConfig({ act_color: color })}
          />
        </Section>

        {/* Typography Section */}
        <Section
          title="Typography"
          icon="text-outline"
          expanded={expandedSections.typography}
          onToggle={() => toggleSection('typography')}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Font Family</Text>
            <TextInput
              style={styles.textInput}
              value={config.font_family}
              onChangeText={(text) => updateConfig({ font_family: text })}
              placeholder="Inter"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Font Scale: {config.font_scale?.toFixed(1)}</Text>
            <View style={styles.scaleRow}>
              <TouchableOpacity
                style={styles.scaleButton}
                onPress={() => updateConfig({ font_scale: Math.max(0.8, (config.font_scale || 1) - 0.1) })}
              >
                <Ionicons name="remove" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={styles.scaleIndicator}>
                <View
                  style={[
                    styles.scaleFill,
                    { width: `${((config.font_scale || 1) - 0.8) / 0.7 * 100}%` },
                  ]}
                />
              </View>
              <TouchableOpacity
                style={styles.scaleButton}
                onPress={() => updateConfig({ font_scale: Math.min(1.5, (config.font_scale || 1) + 0.1) })}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Default Theme</Text>
            <View style={styles.themeSelector}>
              {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.themeOption,
                    config.default_theme === mode && styles.themeOptionSelected,
                  ]}
                  onPress={() => updateConfig({ default_theme: mode })}
                >
                  <Ionicons
                    name={mode === 'light' ? 'sunny' : mode === 'dark' ? 'moon' : 'phone-portrait'}
                    size={18}
                    color={config.default_theme === mode ? '#000' : '#888'}
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      config.default_theme === mode && styles.themeOptionTextSelected,
                    ]}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Section>

        {/* Domain Configuration Section */}
        <Section
          title="Custom Domain"
          icon="globe-outline"
          expanded={expandedSections.domain}
          onToggle={() => toggleSection('domain')}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Domain</Text>
            <View style={styles.domainRow}>
              <TextInput
                style={[styles.textInput, styles.domainInput]}
                value={config.custom_domain}
                onChangeText={(text) => updateConfig({ custom_domain: text })}
                placeholder="app.yourdomain.com"
                placeholderTextColor="#666"
                autoCapitalize="none"
                keyboardType="url"
              />
              {config.domain_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={ORACLE_COLORS.act} />
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.verifyButton, config.domain_verified && styles.verifyButtonVerified]}
            onPress={handleVerifyDomain}
            disabled={config.domain_verified}
          >
            <Text style={styles.verifyButtonText}>
              {config.domain_verified ? 'Verified' : 'Verify Domain'}
            </Text>
          </TouchableOpacity>
        </Section>

        {/* Feature Toggles Section */}
        <Section
          title="Feature Toggles"
          icon="toggle-outline"
          expanded={expandedSections.features}
          onToggle={() => toggleSection('features')}
        >
          <FeatureToggle
            label="ORACLE System"
            description="Core OODA loop functionality"
            value={config.features_enabled?.oracle ?? true}
            onChange={(v) => updateFeature('oracle', v)}
          />
          <FeatureToggle
            label="Teams"
            description="Team collaboration features"
            value={config.features_enabled?.teams ?? true}
            onChange={(v) => updateFeature('teams', v)}
          />
          <FeatureToggle
            label="Analytics"
            description="Dashboard and analytics"
            value={config.features_enabled?.analytics ?? true}
            onChange={(v) => updateFeature('analytics', v)}
          />
          <FeatureToggle
            label="AI Tuning"
            description="Custom prompts and personalities"
            value={config.features_enabled?.ai_tuning ?? true}
            onChange={(v) => updateFeature('ai_tuning', v)}
          />
          <FeatureToggle
            label="Voice Commands"
            description="Voice input and TTS"
            value={config.features_enabled?.voice ?? true}
            onChange={(v) => updateFeature('voice', v)}
          />
          <FeatureToggle
            label="Widgets"
            description="Home screen widgets"
            value={config.features_enabled?.widgets ?? true}
            onChange={(v) => updateFeature('widgets', v)}
          />
          <FeatureToggle
            label="Data Export"
            description="Export data to various formats"
            value={config.features_enabled?.export ?? true}
            onChange={(v) => updateFeature('export', v)}
          />
        </Section>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewToggle: {
    padding: 8,
  },
  saveButton: {
    backgroundColor: ORACLE_COLORS.orient,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },

  // Preview
  preview: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  previewLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBrandName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 12,
  },
  previewOODA: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  previewPhase: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPhaseText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  previewButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  previewButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 12,
  },

  // Sections
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#151515',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sectionContent: {
    padding: 16,
    gap: 16,
  },

  // Inputs
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },

  // Color Picker
  colorPickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorPickerLabel: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
  },
  colorSwatch: {
    width: 100,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  colorSwatchText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  colorPickerModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  presetColors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  presetColor: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#fff',
  },
  customColorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  customColorLabel: {
    color: '#888',
    fontSize: 14,
  },
  customColorInput: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  applyButton: {
    backgroundColor: ORACLE_COLORS.act,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  applyButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 14,
  },

  // Feature Toggle
  featureToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  featureInfo: {
    flex: 1,
    paddingRight: 16,
  },
  featureLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },

  // Upload
  uploadButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: '#888',
    marginTop: 8,
    fontSize: 14,
  },
  uploadedLogo: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },

  // Scale
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scaleButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleIndicator: {
    flex: 1,
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scaleFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.orient,
    borderRadius: 4,
  },

  // Theme Selector
  themeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  themeOptionSelected: {
    backgroundColor: ORACLE_COLORS.orient,
    borderColor: ORACLE_COLORS.orient,
  },
  themeOptionText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  themeOptionTextSelected: {
    color: '#000',
  },

  // Domain
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  domainInput: {
    flex: 1,
  },
  verifiedBadge: {
    marginLeft: 8,
  },
  verifyButton: {
    backgroundColor: ORACLE_COLORS.observe,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyButtonVerified: {
    backgroundColor: ORACLE_COLORS.act,
  },
  verifyButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },

  bottomSpacer: {
    height: 40,
  },
});

export default WhiteLabelAdmin;
