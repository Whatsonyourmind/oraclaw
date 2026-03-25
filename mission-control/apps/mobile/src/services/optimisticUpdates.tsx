/**
 * ORACLE Optimistic Updates System
 * Story rt-4 - Handle optimistic UI updates with rollback support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export type OptimisticOperationType = 'create' | 'update' | 'delete';

export type OptimisticStatus = 'pending' | 'synced' | 'failed' | 'conflict';

export interface OptimisticOperation<T = any> {
  id: string;
  entityType: string;
  entityId: string;
  operationType: OptimisticOperationType;
  timestamp: number;
  status: OptimisticStatus;
  data: T;
  previousData?: T;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface ConflictResolution<T = any> {
  strategy: 'local_wins' | 'server_wins' | 'merge' | 'manual';
  localData: T;
  serverData: T;
  resolvedData?: T;
  resolvedBy?: 'auto' | 'user';
}

export interface OptimisticState<T = any> {
  entities: Map<string, T>;
  operations: Map<string, OptimisticOperation<T>>;
  conflicts: Map<string, ConflictResolution<T>>;
}

export interface PendingIndicator {
  entityId: string;
  isPending: boolean;
  operationType: OptimisticOperationType;
  timestamp: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY_PREFIX = 'oracle_optimistic_';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 10000]; // Exponential backoff

// ============================================================================
// OPTIMISTIC OPERATION MANAGER
// ============================================================================

export class OptimisticOperationManager<T extends { id: string }> {
  private entityType: string;
  private operations: Map<string, OptimisticOperation<T>> = new Map();
  private listeners: Set<(operations: OptimisticOperation<T>[]) => void> = new Set();

  constructor(entityType: string) {
    this.entityType = entityType;
    this.loadPersistedOperations();
  }

  // ==========================================
  // OPERATION CREATION
  // ==========================================

  /**
   * Create an optimistic operation for a new entity
   */
  createOptimistic(data: T, apply: () => void): OptimisticOperation<T> {
    const operation: OptimisticOperation<T> = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityType: this.entityType,
      entityId: data.id,
      operationType: 'create',
      timestamp: Date.now(),
      status: 'pending',
      data,
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    };

    // Apply optimistic update immediately
    apply();

    this.operations.set(operation.id, operation);
    this.notifyListeners();
    this.persistOperations();

    return operation;
  }

  /**
   * Create an optimistic update operation
   */
  updateOptimistic(
    entityId: string,
    newData: Partial<T>,
    previousData: T,
    apply: () => void
  ): OptimisticOperation<T> {
    const operation: OptimisticOperation<T> = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityType: this.entityType,
      entityId,
      operationType: 'update',
      timestamp: Date.now(),
      status: 'pending',
      data: { ...previousData, ...newData } as T,
      previousData,
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    };

    // Apply optimistic update immediately
    apply();

    this.operations.set(operation.id, operation);
    this.notifyListeners();
    this.persistOperations();

    return operation;
  }

  /**
   * Create an optimistic delete operation
   */
  deleteOptimistic(
    entityId: string,
    previousData: T,
    apply: () => void
  ): OptimisticOperation<T> {
    const operation: OptimisticOperation<T> = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityType: this.entityType,
      entityId,
      operationType: 'delete',
      timestamp: Date.now(),
      status: 'pending',
      data: previousData,
      previousData,
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    };

    // Apply optimistic delete immediately
    apply();

    this.operations.set(operation.id, operation);
    this.notifyListeners();
    this.persistOperations();

    return operation;
  }

  // ==========================================
  // OPERATION RESOLUTION
  // ==========================================

  /**
   * Mark an operation as successfully synced with the server
   */
  confirmOperation(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (operation) {
      operation.status = 'synced';
      this.operations.delete(operationId);
      this.notifyListeners();
      this.persistOperations();
    }
  }

  /**
   * Mark an operation as failed and optionally rollback
   */
  rejectOperation(
    operationId: string,
    error: string,
    rollback: (previousData: T) => void
  ): void {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    operation.status = 'failed';
    operation.error = error;

    // Check if we should retry
    if (operation.retryCount < operation.maxRetries) {
      operation.retryCount++;
      operation.status = 'pending';
      // Schedule retry with exponential backoff
      const delay = RETRY_DELAYS[Math.min(operation.retryCount - 1, RETRY_DELAYS.length - 1)];
      setTimeout(() => this.notifyListeners(), delay);
    } else {
      // Max retries exceeded, rollback
      if (operation.previousData && operation.operationType !== 'create') {
        rollback(operation.previousData);
      }
      this.operations.delete(operationId);
    }

    this.notifyListeners();
    this.persistOperations();
  }

  // ==========================================
  // CONFLICT HANDLING
  // ==========================================

  /**
   * Handle a conflict between local and server data
   */
  handleConflict(
    operationId: string,
    serverData: T,
    strategy: ConflictResolution<T>['strategy'] = 'server_wins'
  ): { resolved: T; resolution: ConflictResolution<T> } {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const localData = operation.data;
    let resolvedData: T;

    const resolution: ConflictResolution<T> = {
      strategy,
      localData,
      serverData,
      resolvedBy: 'auto',
    };

    switch (strategy) {
      case 'local_wins':
        resolvedData = localData;
        break;
      case 'server_wins':
        resolvedData = serverData;
        break;
      case 'merge':
        resolvedData = this.mergeData(localData, serverData, operation.previousData);
        break;
      case 'manual':
        // Return both for manual resolution
        operation.status = 'conflict';
        this.notifyListeners();
        throw new Error('Manual resolution required');
      default:
        resolvedData = serverData;
    }

    resolution.resolvedData = resolvedData;
    operation.status = 'synced';
    this.operations.delete(operationId);
    this.notifyListeners();
    this.persistOperations();

    return { resolved: resolvedData, resolution };
  }

  /**
   * Merge local and server data based on timestamps and changes
   */
  private mergeData(localData: T, serverData: T, baseData?: T): T {
    if (!baseData) {
      // Without base data, prefer server for non-conflicting fields
      return { ...serverData, ...localData };
    }

    const merged = { ...serverData } as T;
    const localKeys = Object.keys(localData) as Array<keyof T>;

    for (const key of localKeys) {
      const localValue = localData[key];
      const serverValue = serverData[key];
      const baseValue = baseData[key];

      // If local changed but server didn't, use local
      if (localValue !== baseValue && serverValue === baseValue) {
        merged[key] = localValue;
      }
      // If both changed, prefer server (or implement more sophisticated merge)
      // For now, server wins on true conflicts
    }

    return merged;
  }

  /**
   * Resolve a conflict manually with user-provided data
   */
  resolveConflictManually(operationId: string, resolvedData: T): void {
    const operation = this.operations.get(operationId);
    if (operation && operation.status === 'conflict') {
      operation.data = resolvedData;
      operation.status = 'synced';
      this.operations.delete(operationId);
      this.notifyListeners();
      this.persistOperations();
    }
  }

  // ==========================================
  // QUERY METHODS
  // ==========================================

  /**
   * Get all pending operations
   */
  getPendingOperations(): OptimisticOperation<T>[] {
    return Array.from(this.operations.values()).filter(op => op.status === 'pending');
  }

  /**
   * Get all failed operations
   */
  getFailedOperations(): OptimisticOperation<T>[] {
    return Array.from(this.operations.values()).filter(op => op.status === 'failed');
  }

  /**
   * Get all operations with conflicts
   */
  getConflicts(): OptimisticOperation<T>[] {
    return Array.from(this.operations.values()).filter(op => op.status === 'conflict');
  }

  /**
   * Check if an entity has pending operations
   */
  hasPendingOperations(entityId: string): boolean {
    return Array.from(this.operations.values()).some(
      op => op.entityId === entityId && op.status === 'pending'
    );
  }

  /**
   * Get pending indicator for an entity
   */
  getPendingIndicator(entityId: string): PendingIndicator | null {
    const operation = Array.from(this.operations.values()).find(
      op => op.entityId === entityId && op.status === 'pending'
    );

    if (!operation) return null;

    return {
      entityId,
      isPending: true,
      operationType: operation.operationType,
      timestamp: operation.timestamp,
    };
  }

  /**
   * Get all pending indicators
   */
  getAllPendingIndicators(): PendingIndicator[] {
    return Array.from(this.operations.values())
      .filter(op => op.status === 'pending')
      .map(op => ({
        entityId: op.entityId,
        isPending: true,
        operationType: op.operationType,
        timestamp: op.timestamp,
      }));
  }

  // ==========================================
  // PERSISTENCE
  // ==========================================

  private async loadPersistedOperations(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${this.entityType}`);
      if (stored) {
        const operations = JSON.parse(stored) as OptimisticOperation<T>[];
        operations.forEach(op => this.operations.set(op.id, op));
        this.notifyListeners();
      }
    } catch (error) {
      console.warn('Failed to load persisted optimistic operations:', error);
    }
  }

  private async persistOperations(): Promise<void> {
    try {
      const operations = Array.from(this.operations.values());
      await AsyncStorage.setItem(
        `${STORAGE_KEY_PREFIX}${this.entityType}`,
        JSON.stringify(operations)
      );
    } catch (error) {
      console.warn('Failed to persist optimistic operations:', error);
    }
  }

  // ==========================================
  // LISTENERS
  // ==========================================

  /**
   * Subscribe to operation changes
   */
  subscribe(listener: (operations: OptimisticOperation<T>[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const operations = Array.from(this.operations.values());
    this.listeners.forEach(listener => listener(operations));
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  /**
   * Clear all operations (use with caution)
   */
  clearAll(): void {
    this.operations.clear();
    this.notifyListeners();
    this.persistOperations();
  }

  /**
   * Retry all failed operations
   */
  retryAllFailed(): void {
    const failed = this.getFailedOperations();
    failed.forEach(op => {
      op.status = 'pending';
      op.retryCount = 0;
      op.error = undefined;
    });
    this.notifyListeners();
  }
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Hook to use optimistic updates for a specific entity type
 */
export function useOptimisticUpdates<T extends { id: string }>(entityType: string) {
  const manager = useMemo(() => new OptimisticOperationManager<T>(entityType), [entityType]);
  const [pendingIndicators, setPendingIndicators] = useState<PendingIndicator[]>([]);
  const [hasPending, setHasPending] = useState(false);
  const [hasConflicts, setHasConflicts] = useState(false);

  useEffect(() => {
    const unsubscribe = manager.subscribe((operations) => {
      setPendingIndicators(manager.getAllPendingIndicators());
      setHasPending(operations.some(op => op.status === 'pending'));
      setHasConflicts(operations.some(op => op.status === 'conflict'));
    });

    return unsubscribe;
  }, [manager]);

  const createOptimistic = useCallback(
    (data: T, apply: () => void) => manager.createOptimistic(data, apply),
    [manager]
  );

  const updateOptimistic = useCallback(
    (entityId: string, newData: Partial<T>, previousData: T, apply: () => void) =>
      manager.updateOptimistic(entityId, newData, previousData, apply),
    [manager]
  );

  const deleteOptimistic = useCallback(
    (entityId: string, previousData: T, apply: () => void) =>
      manager.deleteOptimistic(entityId, previousData, apply),
    [manager]
  );

  const confirmOperation = useCallback(
    (operationId: string) => manager.confirmOperation(operationId),
    [manager]
  );

  const rejectOperation = useCallback(
    (operationId: string, error: string, rollback: (previousData: T) => void) =>
      manager.rejectOperation(operationId, error, rollback),
    [manager]
  );

  const handleConflict = useCallback(
    (operationId: string, serverData: T, strategy?: ConflictResolution<T>['strategy']) =>
      manager.handleConflict(operationId, serverData, strategy),
    [manager]
  );

  const isPending = useCallback(
    (entityId: string) => manager.hasPendingOperations(entityId),
    [manager]
  );

  const getPendingIndicator = useCallback(
    (entityId: string) => manager.getPendingIndicator(entityId),
    [manager]
  );

  return {
    // Operations
    createOptimistic,
    updateOptimistic,
    deleteOptimistic,
    confirmOperation,
    rejectOperation,
    handleConflict,
    // State
    pendingIndicators,
    hasPending,
    hasConflicts,
    // Helpers
    isPending,
    getPendingIndicator,
    getPendingOperations: () => manager.getPendingOperations(),
    getFailedOperations: () => manager.getFailedOperations(),
    getConflicts: () => manager.getConflicts(),
    retryAllFailed: () => manager.retryAllFailed(),
    clearAll: () => manager.clearAll(),
  };
}

// ============================================================================
// PENDING STATE INDICATOR COMPONENT
// ============================================================================

import React from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PendingStateIndicatorProps {
  indicator: PendingIndicator | null;
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

export function PendingStateIndicator({
  indicator,
  size = 'small',
  showLabel = false,
}: PendingStateIndicatorProps) {
  const pulseAnim = React.useRef(new Animated.Value(0.5)).current;

  React.useEffect(() => {
    if (indicator?.isPending) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [indicator?.isPending, pulseAnim]);

  if (!indicator) return null;

  const iconSize = size === 'small' ? 14 : 18;

  const getOperationIcon = () => {
    switch (indicator.operationType) {
      case 'create':
        return 'add-circle-outline';
      case 'update':
        return 'create-outline';
      case 'delete':
        return 'trash-outline';
      default:
        return 'sync-outline';
    }
  };

  return (
    <Animated.View style={[styles.pendingIndicator, { opacity: pulseAnim }]}>
      <ActivityIndicator size="small" color="#FFD700" style={styles.pendingSpinner} />
      <Ionicons name={getOperationIcon()} size={iconSize} color="#FFD700" />
      {showLabel && (
        <Text style={styles.pendingLabel}>
          {indicator.operationType === 'create' ? 'Creating' :
           indicator.operationType === 'update' ? 'Updating' : 'Deleting'}...
        </Text>
      )}
    </Animated.View>
  );
}

// ============================================================================
// CONFLICT RESOLUTION MODAL
// ============================================================================

import { Modal, TouchableOpacity, ScrollView } from 'react-native';

interface ConflictResolutionModalProps<T> {
  visible: boolean;
  conflict: ConflictResolution<T> | null;
  renderData: (data: T, label: string) => React.ReactNode;
  onResolve: (strategy: ConflictResolution<T>['strategy']) => void;
  onCancel: () => void;
}

export function ConflictResolutionModal<T>({
  visible,
  conflict,
  renderData,
  onResolve,
  onCancel,
}: ConflictResolutionModalProps<T>) {
  if (!conflict) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.conflictModal}>
        <View style={styles.conflictHeader}>
          <Ionicons name="warning" size={32} color="#FFD700" />
          <Text style={styles.conflictTitle}>Sync Conflict</Text>
          <Text style={styles.conflictSubtitle}>
            Changes were made both locally and on the server
          </Text>
        </View>

        <ScrollView style={styles.conflictContent}>
          <View style={styles.conflictSection}>
            <Text style={styles.conflictSectionTitle}>Your Changes</Text>
            {renderData(conflict.localData, 'local')}
          </View>

          <View style={styles.conflictSection}>
            <Text style={styles.conflictSectionTitle}>Server Version</Text>
            {renderData(conflict.serverData, 'server')}
          </View>
        </ScrollView>

        <View style={styles.conflictActions}>
          <TouchableOpacity
            style={[styles.conflictButton, styles.conflictButtonSecondary]}
            onPress={() => onResolve('server_wins')}
          >
            <Ionicons name="cloud-download" size={20} color="#00BFFF" />
            <Text style={[styles.conflictButtonText, { color: '#00BFFF' }]}>
              Use Server
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.conflictButton, styles.conflictButtonPrimary]}
            onPress={() => onResolve('local_wins')}
          >
            <Ionicons name="phone-portrait" size={20} color="#000" />
            <Text style={[styles.conflictButtonText, { color: '#000' }]}>
              Keep Mine
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.conflictButton, styles.conflictButtonMerge]}
            onPress={() => onResolve('merge')}
          >
            <Ionicons name="git-merge" size={20} color="#00FF88" />
            <Text style={[styles.conflictButtonText, { color: '#00FF88' }]}>
              Merge
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.conflictCancel} onPress={onCancel}>
          <Text style={styles.conflictCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
  },
  pendingSpinner: {
    marginRight: 6,
    transform: [{ scale: 0.7 }],
  },
  pendingLabel: {
    color: '#FFD700',
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '500',
  },

  // Conflict Modal
  conflictModal: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    paddingTop: 60,
  },
  conflictHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  conflictTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  conflictSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  conflictContent: {
    flex: 1,
    padding: 24,
  },
  conflictSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  conflictSectionTitle: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  conflictActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  conflictButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  conflictButtonPrimary: {
    backgroundColor: '#FFD700',
  },
  conflictButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00BFFF',
  },
  conflictButtonMerge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#00FF88',
  },
  conflictButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  conflictCancel: {
    padding: 16,
    alignItems: 'center',
  },
  conflictCancelText: {
    color: '#666',
    fontSize: 14,
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  OptimisticOperationManager,
  useOptimisticUpdates,
  PendingStateIndicator,
  ConflictResolutionModal,
};
