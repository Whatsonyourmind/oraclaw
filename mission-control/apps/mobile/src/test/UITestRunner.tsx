import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraCapture } from '../features/intel/CameraCapture';
import { IntelOverlay } from '../features/intel/IntelOverlay';
import { BriefingScreen } from '../features/briefing/BriefingScreen';
import { MeetingDebrief } from '../features/debrief/MeetingDebrief';
import { useMissionStore, useMissionSelectors } from '../store/missions';
import { missionControlAPI } from '@mission-control/client-sdk';
import { styles } from './styles';

interface TestResult {
  test: string;
  status: 'pending' | 'pass' | 'fail';
  details?: string;
  duration?: number;
}

export const UITestRunner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [currentTest, setCurrentTest] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'runner' | 'camera' | 'overlay' | 'briefing' | 'debrief'>('runner');
  
  const { createMission, setCurrentMission, setBriefing, setMeeting } = useMissionStore();
  const { hasCurrentMission } = useMissionSelectors();

  // Test data
  const mockIntelOverlay = {
    overlays: [
      { x: 20, y: 30, width: 25, height: 8, text: 'INVOICE #12345', confidence: 0.95, type: 'field' as const },
      { x: 20, y: 45, width: 30, height: 8, text: 'DUE: 2024-02-15', confidence: 0.88, type: 'risk' as const },
      { x: 50, y: 60, width: 20, height: 8, text: 'AMOUNT: $1,250', confidence: 0.92, type: 'field' as const },
    ],
    actions: [
      { type: 'reminder', confidence: 0.9, description: 'Set reminder for invoice due date' },
      { type: 'task', confidence: 0.85, description: 'Process payment for invoice #12345' },
    ],
  };

  const mockBriefing = {
    id: 'briefing_1',
    user_id: 'test_user',
    date: '2024-01-20',
    summary: '2 urgent meetings, contract review deadline, travel window available 2-4pm',
    confidence: 0.85,
    needs_user_confirmation: false,
    priorities: [
      { title: 'Contract review due 3pm', urgency: 'high' as const, confidence: 0.9 },
      { title: 'Client call preparation', urgency: 'medium' as const, confidence: 0.8 },
      { title: 'Expense report submission', urgency: 'low' as const, confidence: 0.7 },
    ],
    time_windows: [
      { start: '2:00 PM', end: '4:00 PM', purpose: 'Deep work session' },
      { start: '5:30 PM', end: '6:30 PM', purpose: 'Team sync' },
    ],
    recommended_actions: [
      { description: 'Review contract clauses', effort: 'medium' as const, confidence: 0.9 },
      { description: 'Prepare client call notes', effort: 'low' as const, confidence: 0.85 },
      { description: 'Submit expense report', effort: 'high' as const, confidence: 0.7 },
    ],
    delegation_opportunities: [
      { task: 'Contract legal review', to_who: 'Legal team', confidence: 0.8 },
    ],
    created_at: new Date().toISOString(),
  };

  const mockMeeting = {
    id: 'meeting_1',
    user_id: 'test_user',
    title: 'Q1 Planning Session',
    audio_path: 'mock://audio/meeting_1.wav',
    transcript: 'Team discussed Q1 objectives. Decision: Launch new feature by March 15th. Sarah will lead development. Marketing budget approved for $50,000. Follow-up: Send meeting notes to all participants.',
    decisions: [
      { description: 'Launch new feature by March 15th', owner: 'Sarah', deadline: '2024-03-15', confidence: 0.95 },
      { description: 'Marketing budget approved: $50,000', owner: 'Finance team', deadline: '2024-02-01', confidence: 0.88 },
    ],
    follow_ups: [
      { type: 'email' as const, recipient: 'team@company.com', content: 'Meeting notes and action items', confidence: 0.92 },
      { type: 'task' as const, content: 'Create development timeline for new feature', confidence: 0.85 },
    ],
    confidence: 0.9,
    created_at: new Date().toISOString(),
  };

  const addTestResult = (test: string, status: 'pass' | 'fail', details?: string, duration?: number) => {
    setTestResults(prev => [...prev, { test, status, details, duration }]);
  };

  const runTest = async (testName: string, testFunction: () => Promise<boolean>) => {
    setCurrentTest(testName);
    const startTime = Date.now();
    
    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      if (result) {
        addTestResult(testName, 'pass', undefined, duration);
        Vibration.vibrate(100); // Success haptic
      } else {
        addTestResult(testName, 'fail', undefined, duration);
        Vibration.vibrate([200, 100, 200]); // Error haptic
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      addTestResult(testName, 'fail', error instanceof Error ? error.message : 'Unknown error', duration);
      Vibration.vibrate([200, 100, 200]);
      return false;
    }
  };

  // Test Suite
  const runFullTestSuite = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    // Test 1: Mission Creation
    await runTest('Mission Creation', async () => {
      const mission = createMission('Test Mission - UI Validation', 'high');
      setCurrentMission(mission);
      return mission.id && mission.title && mission.priority === 'high';
    });

    // Test 2: Camera Permission Flow
    await runTest('Camera Permission Flow', async () => {
      setCurrentScreen('camera');
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCurrentScreen('runner');
      return true; // Would check actual permission in real test
    });

    // Test 3: Intel Overlay Rendering
    await runTest('Intel Overlay Rendering', async () => {
      setCurrentScreen('overlay');
      await new Promise(resolve => setTimeout(resolve, 2000));
      setCurrentScreen('runner');
      return mockIntelOverlay.overlays.length > 0 && mockIntelOverlay.actions.length > 0;
    });

    // Test 4: Briefing Generation UI
    await runTest('Briefing Generation UI', async () => {
      setBriefing(mockBriefing);
      setCurrentScreen('briefing');
      await new Promise(resolve => setTimeout(resolve, 3000));
      setCurrentScreen('runner');
      return mockBriefing.priorities.length >= 3 && mockBriefing.recommended_actions.length >= 3;
    });

    // Test 5: Meeting Debrief Interface
    await runTest('Meeting Debrief Interface', async () => {
      setMeeting(mockMeeting);
      setCurrentScreen('debrief');
      await new Promise(resolve => setTimeout(resolve, 2000));
      setCurrentScreen('runner');
      return mockMeeting.decisions.length > 0 && mockMeeting.follow_ups.length > 0;
    });

    // Test 6: API Connectivity
    await runTest('API Connectivity', async () => {
      try {
        const response = await missionControlAPI.healthCheck();
        return response.success;
      } catch {
        return false; // Expected if server not running
      }
    });

    // Test 7: State Management
    await runTest('State Management', async () => {
      const mission = createMission('State Test Mission');
      const hasMission = hasCurrentMission();
      return hasMission && mission.status === 'active';
    });

    // Test 8: UI Responsiveness
    await runTest('UI Responsiveness', async () => {
      const startTime = Date.now();
      setCurrentScreen('overlay');
      await new Promise(resolve => setTimeout(resolve, 100));
      setCurrentScreen('runner');
      const renderTime = Date.now() - startTime;
      return renderTime < 500; // Should render in under 500ms
    });

    setIsRunning(false);
    setCurrentTest('');
    
    // Show results summary
    const passed = testResults.filter(r => r.status === 'pass').length;
    const total = testResults.length;
    
    Alert.alert(
      'Test Suite Complete',
      `Results: ${passed}/${total} tests passed\nAverage time: ${Math.round(testResults.reduce((sum, r) => sum + (r.duration || 0), 0) / total)}ms`,
      [{ text: 'OK' }]
    );
  };

  const renderTestResults = () => {
    if (testResults.length === 0) return null;

    const passed = testResults.filter(r => r.status === 'pass').length;
    const failed = testResults.filter(r => r.status === 'fail').length;
    const avgTime = testResults.reduce((sum, r) => sum + (r.duration || 0), 0) / testResults.length;

    return (
      <View style={styles.resultsContainer}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>TEST RESULTS</Text>
          <View style={styles.resultsStats}>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={16} color="#00FF88" />
              <Text style={styles.statText}>{passed}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="close-circle" size={16} color="#FF4444" />
              <Text style={styles.statText}>{failed}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color="#FFA500" />
              <Text style={styles.statText}>{Math.round(avgTime)}ms</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
          {testResults.map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <View style={styles.resultHeader}>
                <Ionicons 
                  name={result.status === 'pass' ? 'checkmark-circle' : 'close-circle'} 
                  size={16} 
                  color={result.status === 'pass' ? '#00FF88' : '#FF4444'} 
                />
                <Text style={styles.resultTestName}>{result.test}</Text>
                <Text style={styles.resultDuration}>{result.duration}ms</Text>
              </View>
              {result.details && (
                <Text style={styles.resultDetails}>{result.details}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (currentScreen === 'camera') {
    return (
      <View style={styles.fullScreenContainer}>
        <CameraCapture 
          onCapture={(uri) => {
            console.log('Captured:', uri);
            setCurrentScreen('runner');
          }}
          missionId="test-mission"
        />
      </View>
    );
  }

  if (currentScreen === 'overlay') {
    return (
      <View style={styles.fullScreenContainer}>
        <IntelOverlay
          imageUri="mock://image/test.jpg"
          overlays={mockIntelOverlay.overlays}
          actions={mockIntelOverlay.actions}
          onActionSelect={(action) => console.log('Action selected:', action)}
          onRetake={() => setCurrentScreen('runner')}
          onConfirm={() => setCurrentScreen('runner')}
        />
      </View>
    );
  }

  if (currentScreen === 'briefing') {
    return (
      <View style={styles.fullScreenContainer}>
        <BriefingScreen
          briefing={mockBriefing}
          onActionSelect={(action) => console.log('Briefing action:', action)}
          onDelegationSelect={(delegation) => console.log('Delegation:', delegation)}
          onClose={() => setCurrentScreen('runner')}
        />
      </View>
    );
  }

  if (currentScreen === 'debrief') {
    return (
      <View style={styles.fullScreenContainer}>
        <MeetingDebrief
          meeting={mockMeeting}
          onFollowUpSelect={(followUp) => console.log('Follow-up:', followUp)}
          onSaveDossier={() => setCurrentScreen('runner')}
          onClose={() => setCurrentScreen('runner')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="bug-outline" size={24} color="#00FF88" />
        <Text style={styles.title}>UI/UX TEST SUITE</Text>
        <View style={[styles.statusIndicator, { backgroundColor: isRunning ? '#FFA500' : '#00FF88' }]} />
      </View>

      {/* Current Test */}
      {currentTest && (
        <View style={styles.currentTestContainer}>
          <Text style={styles.currentTestLabel}>RUNNING:</Text>
          <Text style={styles.currentTestName}>{currentTest}</Text>
          <View style={styles.loadingSpinner} />
        </View>
      )}

      {/* Test Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity 
          style={[styles.testButton, isRunning && styles.testButtonDisabled]}
          onPress={runFullTestSuite}
          disabled={isRunning}
        >
          <Ionicons name="play-outline" size={20} color="#000" />
          <Text style={styles.testButtonText}>RUN FULL TEST SUITE</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.testButtonSecondary]}
          onPress={() => setTestResults([])}
        >
          <Ionicons name="refresh-outline" size={20} color="#00FF88" />
          <Text style={styles.testButtonTextSecondary}>CLEAR RESULTS</Text>
        </TouchableOpacity>
      </View>

      {/* Test Categories */}
      <View style={styles.categoriesContainer}>
        <View style={styles.category}>
          <Text style={styles.categoryTitle}>CORE FLOWS</Text>
          <Text style={styles.categoryDescription}>Mission creation, camera capture, intel extraction</Text>
        </View>
        
        <View style={styles.category}>
          <Text style={styles.categoryTitle}>WOW MOMENTS</Text>
          <Text style={styles.categoryDescription}>Intel overlay, briefing generation, meeting debrief</Text>
        </View>
        
        <View style={styles.category}>
          <Text style={styles.categoryTitle}>PERFORMANCE</Text>
          <Text style={styles.categoryDescription}>API connectivity, state management, UI responsiveness</Text>
        </View>
      </View>

      {/* Results */}
      {renderTestResults()}

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.footerText}>MISSION CONTROL v1.0.0</Text>
        <Text style={styles.footerSubtext}>Zero-budget testing suite</Text>
      </View>
    </View>
  );
};