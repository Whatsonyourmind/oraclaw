/**
 * MultimodalUpload Component
 * Unified upload UI with drag-drop, camera, mic support
 *
 * Features:
 * - File picker for documents, images
 * - Camera capture for photos
 * - Voice recording for audio
 * - URL input for web content
 * - Drag and drop support
 * - Upload progress tracking
 *
 * @module features/oracle/multimodal/MultimodalUpload
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Animated,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { ORACLE_COLORS, ORACLE_TIMING, oracleStyles, getPhaseColor } from '../theme';

// ============================================================================
// Types
// ============================================================================

/**
 * Content type for upload
 */
type ContentType = 'image' | 'document' | 'audio' | 'video' | 'url';

/**
 * Upload item
 */
interface UploadItem {
  id: string;
  type: ContentType;
  name: string;
  uri?: string;
  url?: string;
  mimeType?: string;
  size?: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

/**
 * Props for MultimodalUpload
 */
interface MultimodalUploadProps {
  onUpload: (items: UploadItem[]) => Promise<void>;
  onProcessingComplete?: (results: any[]) => void;
  acceptedTypes?: ContentType[];
  maxFiles?: number;
  maxFileSize?: number; // bytes
  showUrlInput?: boolean;
  showCamera?: boolean;
  showMicrophone?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const MultimodalUpload: React.FC<MultimodalUploadProps> = ({
  onUpload,
  onProcessingComplete,
  acceptedTypes = ['image', 'document', 'audio', 'video', 'url'],
  maxFiles = 10,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  showUrlInput = true,
  showCamera = true,
  showMicrophone = true,
}) => {
  // State
  const [items, setItems] = useState<UploadItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'files' | 'camera' | 'voice' | 'url'>('files');

  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Recording pulse animation
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRecording]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // ==========================================================================
  // File Picking
  // ==========================================================================

  /**
   * Pick documents
   */
  const pickDocuments = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/*',
          'image/*',
          'audio/*',
          'video/*',
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const newItems: UploadItem[] = result.assets.map((asset) => ({
        id: generateId(),
        type: detectContentType(asset.mimeType || ''),
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType,
        size: asset.size,
        status: 'pending',
        progress: 0,
      }));

      addItems(newItems);
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick documents');
    }
  }, []);

  /**
   * Pick images from library
   */
  const pickImages = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const newItems: UploadItem[] = result.assets.map((asset) => ({
        id: generateId(),
        type: asset.type === 'video' ? 'video' : 'image',
        name: asset.fileName || `${asset.type}_${Date.now()}`,
        uri: asset.uri,
        mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        status: 'pending',
        progress: 0,
      }));

      addItems(newItems);
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  }, []);

  /**
   * Take photo with camera
   */
  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera access');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const newItem: UploadItem = {
        id: generateId(),
        type: asset.type === 'video' ? 'video' : 'image',
        name: `camera_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
        uri: asset.uri,
        mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
        status: 'pending',
        progress: 0,
      };

      addItems([newItem]);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to capture photo');
    }
  }, []);

  // ==========================================================================
  // Audio Recording
  // ==========================================================================

  /**
   * Start audio recording
   */
  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone access');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Recording start error:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  }, []);

  /**
   * Stop audio recording
   */
  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      if (uri) {
        const newItem: UploadItem = {
          id: generateId(),
          type: 'audio',
          name: `recording_${Date.now()}.m4a`,
          uri,
          mimeType: 'audio/m4a',
          status: 'pending',
          progress: 0,
        };

        addItems([newItem]);
      }

      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
    } catch (error) {
      console.error('Recording stop error:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  }, []);

  // ==========================================================================
  // URL Input
  // ==========================================================================

  /**
   * Add URL
   */
  const addUrl = useCallback(() => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;

    // Validate URL
    try {
      new URL(trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`);
    } catch {
      Alert.alert('Invalid URL', 'Please enter a valid URL');
      return;
    }

    const fullUrl = trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`;

    const newItem: UploadItem = {
      id: generateId(),
      type: 'url',
      name: new URL(fullUrl).hostname,
      url: fullUrl,
      status: 'pending',
      progress: 0,
    };

    addItems([newItem]);
    setUrlInput('');
  }, [urlInput]);

  // ==========================================================================
  // Item Management
  // ==========================================================================

  /**
   * Add items to list
   */
  const addItems = useCallback((newItems: UploadItem[]) => {
    setItems((prev) => {
      const combined = [...prev, ...newItems];
      if (combined.length > maxFiles) {
        Alert.alert('Limit Reached', `Maximum ${maxFiles} files allowed`);
        return prev;
      }
      return combined;
    });
  }, [maxFiles]);

  /**
   * Remove item
   */
  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /**
   * Start upload
   */
  const handleUpload = useCallback(async () => {
    if (items.length === 0) return;

    // Update all items to uploading
    setItems((prev) =>
      prev.map((item) => ({ ...item, status: 'uploading' as const }))
    );

    try {
      await onUpload(items);

      // Mark as completed
      setItems((prev) =>
        prev.map((item) => ({ ...item, status: 'completed' as const, progress: 100 }))
      );
    } catch (error) {
      // Mark as failed
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          status: 'failed' as const,
          error: error instanceof Error ? error.message : 'Upload failed',
        }))
      );
    }
  }, [items, onUpload]);

  /**
   * Clear all items
   */
  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  // ==========================================================================
  // Render
  // ==========================================================================

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const hasItems = items.length > 0;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="cloud-upload-outline" size={24} color={ORACLE_COLORS.observe} />
          <Text style={styles.headerTitle}>Multimodal Upload</Text>
          {hasItems && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{items.length}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#888888"
        />
      </TouchableOpacity>

      {isExpanded && (
        <>
          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'files' && styles.tabActive]}
              onPress={() => setActiveTab('files')}
            >
              <Ionicons
                name="document-outline"
                size={20}
                color={activeTab === 'files' ? ORACLE_COLORS.observe : '#666666'}
              />
              <Text style={[styles.tabText, activeTab === 'files' && styles.tabTextActive]}>
                Files
              </Text>
            </TouchableOpacity>

            {showCamera && (
              <TouchableOpacity
                style={[styles.tab, activeTab === 'camera' && styles.tabActive]}
                onPress={() => setActiveTab('camera')}
              >
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={activeTab === 'camera' ? ORACLE_COLORS.observe : '#666666'}
                />
                <Text style={[styles.tabText, activeTab === 'camera' && styles.tabTextActive]}>
                  Camera
                </Text>
              </TouchableOpacity>
            )}

            {showMicrophone && (
              <TouchableOpacity
                style={[styles.tab, activeTab === 'voice' && styles.tabActive]}
                onPress={() => setActiveTab('voice')}
              >
                <Ionicons
                  name="mic-outline"
                  size={20}
                  color={activeTab === 'voice' ? ORACLE_COLORS.observe : '#666666'}
                />
                <Text style={[styles.tabText, activeTab === 'voice' && styles.tabTextActive]}>
                  Voice
                </Text>
              </TouchableOpacity>
            )}

            {showUrlInput && (
              <TouchableOpacity
                style={[styles.tab, activeTab === 'url' && styles.tabActive]}
                onPress={() => setActiveTab('url')}
              >
                <Ionicons
                  name="link-outline"
                  size={20}
                  color={activeTab === 'url' ? ORACLE_COLORS.observe : '#666666'}
                />
                <Text style={[styles.tabText, activeTab === 'url' && styles.tabTextActive]}>
                  URL
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {/* Files Tab */}
            {activeTab === 'files' && (
              <View style={styles.filesTab}>
                <TouchableOpacity style={styles.uploadArea} onPress={pickDocuments}>
                  <Ionicons name="folder-open-outline" size={48} color={ORACLE_COLORS.observe} />
                  <Text style={styles.uploadAreaText}>Tap to browse files</Text>
                  <Text style={styles.uploadAreaSubtext}>
                    PDF, Word, Excel, Images, Audio, Video
                  </Text>
                </TouchableOpacity>

                <View style={styles.quickActions}>
                  <TouchableOpacity style={styles.quickAction} onPress={pickImages}>
                    <Ionicons name="images-outline" size={24} color={ORACLE_COLORS.observe} />
                    <Text style={styles.quickActionText}>Photos</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.quickAction} onPress={pickDocuments}>
                    <Ionicons name="document-text-outline" size={24} color={ORACLE_COLORS.orient} />
                    <Text style={styles.quickActionText}>Documents</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Camera Tab */}
            {activeTab === 'camera' && (
              <View style={styles.cameraTab}>
                <TouchableOpacity style={styles.cameraButton} onPress={takePhoto}>
                  <View style={styles.cameraButtonInner}>
                    <Ionicons name="camera" size={48} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.cameraText}>Tap to capture photo or video</Text>
              </View>
            )}

            {/* Voice Tab */}
            {activeTab === 'voice' && (
              <View style={styles.voiceTab}>
                <Animated.View
                  style={[
                    styles.recordButton,
                    isRecording && styles.recordButtonActive,
                    { transform: [{ scale: isRecording ? pulseAnim : 1 }] },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.recordButtonInner}
                    onPress={isRecording ? stopRecording : startRecording}
                  >
                    <Ionicons
                      name={isRecording ? 'stop' : 'mic'}
                      size={48}
                      color={isRecording ? '#FF4444' : '#FFFFFF'}
                    />
                  </TouchableOpacity>
                </Animated.View>

                {isRecording && (
                  <View style={styles.recordingInfo}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>
                      Recording: {formatDuration(recordingDuration)}
                    </Text>
                  </View>
                )}

                <Text style={styles.voiceText}>
                  {isRecording ? 'Tap to stop' : 'Tap to start recording'}
                </Text>
              </View>
            )}

            {/* URL Tab */}
            {activeTab === 'url' && (
              <View style={styles.urlTab}>
                <View style={styles.urlInputContainer}>
                  <Ionicons name="globe-outline" size={20} color="#666666" />
                  <TextInput
                    style={styles.urlInput}
                    placeholder="Enter URL to analyze..."
                    placeholderTextColor="#666666"
                    value={urlInput}
                    onChangeText={setUrlInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onSubmitEditing={addUrl}
                  />
                  {urlInput.length > 0 && (
                    <TouchableOpacity onPress={addUrl}>
                      <Ionicons name="add-circle" size={24} color={ORACLE_COLORS.observe} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.urlHint}>
                  Add articles, social posts, or any web content
                </Text>
              </View>
            )}
          </View>

          {/* Items List */}
          {hasItems && (
            <View style={styles.itemsList}>
              <View style={styles.itemsHeader}>
                <Text style={styles.itemsTitle}>Queue ({items.length})</Text>
                <TouchableOpacity onPress={clearAll}>
                  <Text style={styles.clearButton}>Clear All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.itemsScroll} nestedScrollEnabled>
                {items.map((item) => (
                  <UploadItemRow key={item.id} item={item} onRemove={removeItem} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Upload Button */}
          {pendingCount > 0 && (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handleUpload}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload" size={20} color="#000000" />
              <Text style={styles.uploadButtonText}>
                Process {pendingCount} {pendingCount === 1 ? 'item' : 'items'}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </Animated.View>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Upload item row
 */
const UploadItemRow: React.FC<{
  item: UploadItem;
  onRemove: (id: string) => void;
}> = ({ item, onRemove }) => {
  const getIcon = () => {
    switch (item.type) {
      case 'image':
        return 'image-outline';
      case 'document':
        return 'document-text-outline';
      case 'audio':
        return 'musical-notes-outline';
      case 'video':
        return 'videocam-outline';
      case 'url':
        return 'link-outline';
      default:
        return 'document-outline';
    }
  };

  const getStatusColor = () => {
    switch (item.status) {
      case 'completed':
        return ORACLE_COLORS.act;
      case 'failed':
        return '#FF4444';
      case 'uploading':
      case 'processing':
        return ORACLE_COLORS.observe;
      default:
        return '#666666';
    }
  };

  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemIcon, { backgroundColor: `${getStatusColor()}20` }]}>
        <Ionicons name={getIcon() as any} size={18} color={getStatusColor()} />
      </View>

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.itemMeta}>
          <Text style={[styles.itemStatus, { color: getStatusColor() }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
          {item.size && (
            <Text style={styles.itemSize}>{formatFileSize(item.size)}</Text>
          )}
        </View>
        {(item.status === 'uploading' || item.status === 'processing') && (
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${item.progress}%` }]}
            />
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemove(item.id)}
      >
        <Ionicons name="close-circle" size={20} color="#666666" />
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// Helpers
// ============================================================================

const generateId = () => `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const detectContentType = (mimeType: string): ContentType => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  badge: {
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: ORACLE_COLORS.observe,
  },
  tabText: {
    fontSize: 12,
    color: '#666666',
  },
  tabTextActive: {
    color: ORACLE_COLORS.observe,
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },
  filesTab: {},
  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderWidth: 2,
    borderColor: '#333333',
    borderStyle: 'dashed',
    borderRadius: 12,
    marginBottom: 16,
  },
  uploadAreaText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 12,
  },
  uploadAreaSubtext: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    gap: 8,
  },
  quickActionText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  cameraTab: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  cameraButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ORACLE_COLORS.observe,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraButtonInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraText: {
    fontSize: 14,
    color: '#888888',
  },
  voiceTab: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordButtonActive: {
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
  },
  recordButtonInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4444',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    color: '#FF4444',
    fontWeight: '600',
  },
  voiceText: {
    fontSize: 14,
    color: '#888888',
  },
  urlTab: {},
  urlInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    color: '#FFFFFF',
  },
  urlHint: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  itemsList: {
    borderTopWidth: 1,
    borderTopColor: '#333333',
    maxHeight: 200,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingBottom: 8,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearButton: {
    fontSize: 12,
    color: ORACLE_COLORS.observe,
  },
  itemsScroll: {
    paddingHorizontal: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  itemStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemSize: {
    fontSize: 11,
    color: '#666666',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#333333',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ORACLE_COLORS.observe,
    borderRadius: 2,
  },
  removeButton: {
    padding: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORACLE_COLORS.act,
    margin: 16,
    marginTop: 0,
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
});

export default MultimodalUpload;
