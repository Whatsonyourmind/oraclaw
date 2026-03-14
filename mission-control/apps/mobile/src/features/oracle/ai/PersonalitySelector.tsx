/**
 * Personality Selector
 * Story ai-tune-5 - UI for selecting and customizing AI personality
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AIPersonality, AIIndustry } from '@mission-control/shared-types';
import { ORACLE_COLORS } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Mock personality data
const mockPersonalities: AIPersonality[] = [
  {
    id: '1',
    user_id: 'system',
    name: 'Professional',
    description: 'Balanced professional tone suitable for most business contexts',
    icon: 'briefcase',
    formality: 60,
    detail_level: 50,
    risk_tolerance: 50,
    empathy: 50,
    proactivity: 50,
    industry: 'general',
    domain_keywords: [],
    response_style_hints: {},
    sample_responses: [
      { prompt: 'Analyze this deadline risk', response: 'Based on my analysis, there is a moderate risk of missing the deadline...' },
    ],
    is_default: true,
    is_public: true,
    is_system: true,
    usage_count: 1500,
    avg_satisfaction: 4.2,
    is_active: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    user_id: 'system',
    name: 'Concise Executive',
    description: 'Brief, to-the-point responses for busy executives',
    icon: 'flash',
    formality: 70,
    detail_level: 20,
    risk_tolerance: 60,
    empathy: 30,
    proactivity: 70,
    industry: 'general',
    domain_keywords: [],
    response_style_hints: {},
    sample_responses: [
      { prompt: 'Analyze this deadline risk', response: 'High risk. Key factors: resource constraints, dependency delays. Action: reallocate team.' },
    ],
    is_default: false,
    is_public: true,
    is_system: true,
    usage_count: 890,
    avg_satisfaction: 4.5,
    is_active: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    user_id: 'system',
    name: 'Detailed Analyst',
    description: 'Thorough analysis with comprehensive explanations',
    icon: 'analytics',
    formality: 60,
    detail_level: 90,
    risk_tolerance: 40,
    empathy: 40,
    proactivity: 40,
    industry: 'general',
    domain_keywords: [],
    response_style_hints: {},
    sample_responses: [
      { prompt: 'Analyze this deadline risk', response: 'Let me provide a comprehensive analysis of the deadline risk. First, examining the current resource allocation...' },
    ],
    is_default: false,
    is_public: true,
    is_system: true,
    usage_count: 620,
    avg_satisfaction: 4.3,
    is_active: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    user_id: 'system',
    name: 'Bold Strategist',
    description: 'Confident recommendations focusing on opportunities',
    icon: 'rocket',
    formality: 50,
    detail_level: 50,
    risk_tolerance: 80,
    empathy: 50,
    proactivity: 80,
    industry: 'general',
    domain_keywords: [],
    response_style_hints: {},
    sample_responses: [
      { prompt: 'Analyze this deadline risk', response: 'This is an opportunity in disguise. By pushing harder now, you can exceed expectations...' },
    ],
    is_default: false,
    is_public: true,
    is_system: true,
    usage_count: 340,
    avg_satisfaction: 4.1,
    is_active: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Industry presets
const INDUSTRY_PRESETS: { value: AIIndustry; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: 'globe' },
  { value: 'legal', label: 'Legal', icon: 'document-text' },
  { value: 'medical', label: 'Medical', icon: 'medkit' },
  { value: 'tech', label: 'Technology', icon: 'code-slash' },
  { value: 'finance', label: 'Finance', icon: 'cash' },
];

// Trait definitions
const TRAIT_DEFINITIONS = {
  formality: {
    label: 'Formality',
    lowLabel: 'Casual',
    highLabel: 'Formal',
    description: 'Tone and language style',
  },
  detail_level: {
    label: 'Detail Level',
    lowLabel: 'Concise',
    highLabel: 'Detailed',
    description: 'Response length and depth',
  },
  risk_tolerance: {
    label: 'Risk Tolerance',
    lowLabel: 'Cautious',
    highLabel: 'Bold',
    description: 'Approach to uncertainty',
  },
  empathy: {
    label: 'Empathy',
    lowLabel: 'Analytical',
    highLabel: 'Empathetic',
    description: 'Emotional consideration',
  },
  proactivity: {
    label: 'Proactivity',
    lowLabel: 'Reactive',
    highLabel: 'Proactive',
    description: 'Initiative in suggestions',
  },
};

interface PersonalityCardProps {
  personality: AIPersonality;
  isSelected: boolean;
  onSelect: () => void;
}

function PersonalityCard({ personality, isSelected, onSelect }: PersonalityCardProps) {
  return (
    <TouchableOpacity
      style={[styles.personalityCard, isSelected && styles.personalityCardSelected]}
      onPress={onSelect}
    >
      <View style={styles.personalityHeader}>
        <View style={[styles.personalityIcon, { backgroundColor: ORACLE_COLORS.observe + '22' }]}>
          <Ionicons name={personality.icon as any || 'person'} size={24} color={ORACLE_COLORS.observe} />
        </View>
        {personality.is_default && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        )}
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={ORACLE_COLORS.observe} />
        )}
      </View>
      <Text style={styles.personalityName}>{personality.name}</Text>
      <Text style={styles.personalityDesc} numberOfLines={2}>
        {personality.description}
      </Text>
      <View style={styles.personalityStats}>
        <View style={styles.personalityStat}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.personalityStatText}>
            {personality.avg_satisfaction?.toFixed(1) || '-'}
          </Text>
        </View>
        <View style={styles.personalityStat}>
          <Ionicons name="people-outline" size={14} color="#888" />
          <Text style={styles.personalityStatText}>{personality.usage_count}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface TraitSliderProps {
  trait: keyof typeof TRAIT_DEFINITIONS;
  value: number;
  onChange: (value: number) => void;
}

function TraitSlider({ trait, value, onChange }: TraitSliderProps) {
  const def = TRAIT_DEFINITIONS[trait];
  return (
    <View style={styles.traitSlider}>
      <View style={styles.traitHeader}>
        <Text style={styles.traitLabel}>{def.label}</Text>
        <Text style={styles.traitValue}>{value}</Text>
      </View>
      <View style={styles.traitLabelsRow}>
        <Text style={styles.traitEndLabel}>{def.lowLabel}</Text>
        <Text style={styles.traitEndLabel}>{def.highLabel}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={100}
        step={5}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={ORACLE_COLORS.observe}
        maximumTrackTintColor="#333"
        thumbTintColor={ORACLE_COLORS.observe}
      />
    </View>
  );
}

interface PreviewModalProps {
  visible: boolean;
  onClose: () => void;
  personality: AIPersonality | null;
  customTraits?: Partial<AIPersonality>;
}

function PreviewModal({ visible, onClose, personality, customTraits }: PreviewModalProps) {
  if (!personality) return null;

  const traits = customTraits || personality;
  const sampleResponse = personality.sample_responses?.[0];

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Preview Response</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {sampleResponse && (
            <>
              <View style={styles.previewPrompt}>
                <Text style={styles.previewLabel}>Sample Prompt:</Text>
                <Text style={styles.previewPromptText}>{sampleResponse.prompt}</Text>
              </View>
              <View style={styles.previewResponse}>
                <Text style={styles.previewLabel}>Response:</Text>
                <Text style={styles.previewResponseText}>{sampleResponse.response}</Text>
              </View>
            </>
          )}

          <View style={styles.traitEffects}>
            <Text style={styles.previewLabel}>Trait Effects:</Text>
            {Object.entries(TRAIT_DEFINITIONS).map(([key, def]) => {
              const traitValue = (traits as any)[key] as number;
              const effect = traitValue < 40 ? def.lowLabel : traitValue > 60 ? def.highLabel : 'Balanced';
              return (
                <View key={key} style={styles.traitEffect}>
                  <Text style={styles.traitEffectLabel}>{def.label}:</Text>
                  <Text style={styles.traitEffectValue}>{effect}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface Props {
  navigation: any;
}

export function PersonalitySelector({ navigation }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('1');
  const [customizing, setCustomizing] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Custom trait values
  const [customTraits, setCustomTraits] = useState({
    formality: 50,
    detail_level: 50,
    risk_tolerance: 50,
    empathy: 50,
    proactivity: 50,
  });

  const [selectedIndustry, setSelectedIndustry] = useState<AIIndustry>('general');

  const selectedPersonality = mockPersonalities.find(p => p.id === selectedId);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleSave = () => {
    // In production, save to API
    navigation.goBack();
  };

  const handleSelectPersonality = (id: string) => {
    setSelectedId(id);
    const personality = mockPersonalities.find(p => p.id === id);
    if (personality) {
      setCustomTraits({
        formality: personality.formality,
        detail_level: personality.detail_level,
        risk_tolerance: personality.risk_tolerance,
        empathy: personality.empathy,
        proactivity: personality.proactivity,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>AI Personality</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ORACLE_COLORS.observe}
          />
        }
      >
        {/* Preset Personalities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose a Personality</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.personalityScroll}>
            {mockPersonalities.map(personality => (
              <PersonalityCard
                key={personality.id}
                personality={personality}
                isSelected={selectedId === personality.id}
                onSelect={() => handleSelectPersonality(personality.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Industry Presets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Industry Preset</Text>
          <View style={styles.industryGrid}>
            {INDUSTRY_PRESETS.map(industry => (
              <TouchableOpacity
                key={industry.value}
                style={[
                  styles.industryOption,
                  selectedIndustry === industry.value && styles.industryOptionSelected,
                ]}
                onPress={() => setSelectedIndustry(industry.value)}
              >
                <Ionicons
                  name={industry.icon as any}
                  size={24}
                  color={selectedIndustry === industry.value ? ORACLE_COLORS.observe : '#666'}
                />
                <Text
                  style={[
                    styles.industryLabel,
                    selectedIndustry === industry.value && styles.industryLabelSelected,
                  ]}
                >
                  {industry.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Traits */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fine-tune Traits</Text>
            <TouchableOpacity
              style={styles.previewButton}
              onPress={() => setPreviewVisible(true)}
            >
              <Ionicons name="eye" size={16} color={ORACLE_COLORS.observe} />
              <Text style={styles.previewButtonText}>Preview</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.traitsCard}>
            {(Object.keys(TRAIT_DEFINITIONS) as (keyof typeof TRAIT_DEFINITIONS)[]).map(trait => (
              <TraitSlider
                key={trait}
                trait={trait}
                value={customTraits[trait]}
                onChange={(value) => setCustomTraits(prev => ({ ...prev, [trait]: value }))}
              />
            ))}
          </View>
        </View>

        {/* Sample Preview */}
        {selectedPersonality?.sample_responses?.[0] && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sample Response</Text>
            <View style={styles.sampleCard}>
              <View style={styles.samplePrompt}>
                <Text style={styles.sampleLabel}>Prompt:</Text>
                <Text style={styles.sampleText}>
                  {selectedPersonality.sample_responses[0].prompt}
                </Text>
              </View>
              <View style={styles.sampleResponse}>
                <Text style={styles.sampleLabel}>Response:</Text>
                <Text style={styles.sampleText}>
                  {selectedPersonality.sample_responses[0].response}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <PreviewModal
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        personality={selectedPersonality || null}
        customTraits={customTraits}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  personalityScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  personalityCard: {
    width: SCREEN_WIDTH * 0.6,
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#222',
  },
  personalityCardSelected: {
    borderColor: ORACLE_COLORS.observe,
  },
  personalityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  personalityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  defaultBadge: {
    flex: 1,
    alignItems: 'flex-start',
  },
  defaultBadgeText: {
    fontSize: 10,
    color: ORACLE_COLORS.observe,
    backgroundColor: ORACLE_COLORS.observe + '22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  personalityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  personalityDesc: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 12,
  },
  personalityStats: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  personalityStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  personalityStatText: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  industryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  industryOption: {
    width: (SCREEN_WIDTH - 56) / 3,
    alignItems: 'center',
    padding: 16,
    margin: 6,
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#222',
  },
  industryOptionSelected: {
    borderColor: ORACLE_COLORS.observe,
    backgroundColor: ORACLE_COLORS.observe + '11',
  },
  industryLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  industryLabelSelected: {
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: ORACLE_COLORS.observe + '22',
    borderRadius: 6,
  },
  previewButtonText: {
    fontSize: 12,
    color: ORACLE_COLORS.observe,
    marginLeft: 4,
  },
  traitsCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
  },
  traitSlider: {
    marginBottom: 20,
  },
  traitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  traitLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  traitValue: {
    fontSize: 14,
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  traitLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  traitEndLabel: {
    fontSize: 11,
    color: '#666',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sampleCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
  },
  samplePrompt: {
    marginBottom: 12,
  },
  sampleResponse: {},
  sampleLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  sampleText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  previewPrompt: {
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  previewPromptText: {
    fontSize: 14,
    color: '#ccc',
    fontStyle: 'italic',
  },
  previewResponse: {
    marginBottom: 16,
  },
  previewResponseText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 22,
  },
  traitEffects: {
    borderTopWidth: 1,
    borderTopColor: '#222',
    paddingTop: 16,
  },
  traitEffect: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  traitEffectLabel: {
    fontSize: 13,
    color: '#888',
  },
  traitEffectValue: {
    fontSize: 13,
    color: ORACLE_COLORS.observe,
  },
});

export default PersonalitySelector;
