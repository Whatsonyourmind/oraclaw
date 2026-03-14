import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, StyleSheet } from 'react-native';

import {
  OracleDashboard,
  RadarScreen,
  StrategicMindScreen,
  DecisionEngineScreen,
  ExecutionCopilotScreen,
  ORACLE_COLORS,
} from '../features/oracle';

export type OracleStackParamList = {
  OracleDashboard: undefined;
  RadarScreen: { signalId?: string };
  StrategicMindScreen: { contextId?: string; horizon?: string };
  DecisionEngineScreen: { decisionId?: string };
  ExecutionCopilotScreen: { planId?: string; stepId?: string };
  SignalDetailScreen: { signalId: string };
  ContextDetailScreen: { contextId: string };
  DecisionDetailScreen: { decisionId: string };
  PlanDetailScreen: { planId: string };
  SimulationResultsScreen: { simulationId: string };
  CriticalPathScreen: { decisionId: string };
  GhostActionsScreen: undefined;
  CalibrationScreen: undefined;
  EnvironmentScreen: undefined;
};

const Stack = createNativeStackNavigator<OracleStackParamList>();

const defaultScreenOptions = {
  headerStyle: {
    backgroundColor: '#000000',
  },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: {
    fontWeight: 'bold' as const,
    letterSpacing: 1,
  },
  contentStyle: {
    backgroundColor: '#000000',
  },
  animation: 'slide_from_right' as const,
};

interface PhaseHeaderRightProps {
  phase: 'observe' | 'orient' | 'decide' | 'act';
  onPress?: () => void;
}

const PhaseHeaderRight: React.FC<PhaseHeaderRightProps> = ({ phase, onPress }) => {
  const color = ORACLE_COLORS[phase];
  const iconMap = {
    observe: 'radio-outline' as const,
    orient: 'compass-outline' as const,
    decide: 'git-branch-outline' as const,
    act: 'rocket-outline' as const,
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.headerButton}>
      <View style={[styles.phaseIndicator, { backgroundColor: color }]}>
        <Ionicons name={iconMap[phase]} size={16} color="#000000" />
      </View>
    </TouchableOpacity>
  );
};

export const OracleNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="OracleDashboard"
      screenOptions={defaultScreenOptions}
    >
      {/* Main Dashboard */}
      <Stack.Screen
        name="OracleDashboard"
        component={OracleDashboard}
        options={{
          headerShown: false,
          title: 'ORACLE',
        }}
      />

      {/* OBSERVE Phase Screens */}
      <Stack.Screen
        name="RadarScreen"
        component={RadarScreen}
        options={{
          headerShown: false,
          title: 'RADAR',
          headerRight: () => <PhaseHeaderRight phase="observe" />,
        }}
      />

      {/* ORIENT Phase Screens */}
      <Stack.Screen
        name="StrategicMindScreen"
        component={StrategicMindScreen}
        options={{
          headerShown: false,
          title: 'STRATEGIC MIND',
          headerRight: () => <PhaseHeaderRight phase="orient" />,
        }}
      />

      {/* DECIDE Phase Screens */}
      <Stack.Screen
        name="DecisionEngineScreen"
        component={DecisionEngineScreen}
        options={{
          headerShown: false,
          title: 'DECISION ENGINE',
          headerRight: () => <PhaseHeaderRight phase="decide" />,
        }}
      />

      {/* ACT Phase Screens */}
      <Stack.Screen
        name="ExecutionCopilotScreen"
        component={ExecutionCopilotScreen}
        options={{
          headerShown: false,
          title: 'EXECUTION COPILOT',
          headerRight: () => <PhaseHeaderRight phase="act" />,
        }}
      />
    </Stack.Navigator>
  );
};

export const oracleTabConfig = {
  tabBarLabel: 'ORACLE',
  tabBarIcon: ({ color, size }: { color: string; size: number }) => (
    <Ionicons name="aperture-outline" size={size} color={color} />
  ),
  tabBarBadge: undefined as number | string | undefined,
};

export const oracleLinkingConfig = {
  OracleDashboard: 'oracle',
  RadarScreen: 'oracle/radar',
  StrategicMindScreen: 'oracle/orient',
  DecisionEngineScreen: 'oracle/decide',
  ExecutionCopilotScreen: 'oracle/act',
  SignalDetailScreen: 'oracle/signal/:signalId',
  ContextDetailScreen: 'oracle/context/:contextId',
  DecisionDetailScreen: 'oracle/decision/:decisionId',
  PlanDetailScreen: 'oracle/plan/:planId',
  SimulationResultsScreen: 'oracle/simulation/:simulationId',
  CriticalPathScreen: 'oracle/critical-path/:decisionId',
  GhostActionsScreen: 'oracle/ghost-actions',
  CalibrationScreen: 'oracle/calibration',
  EnvironmentScreen: 'oracle/environment',
};

const styles = StyleSheet.create({
  headerButton: {
    marginRight: 16,
  },
  phaseIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OracleNavigator;
