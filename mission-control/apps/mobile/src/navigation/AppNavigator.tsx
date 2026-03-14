import React from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { UITestRunner } from '../test/UITestRunner';
import { CameraCapture } from '../features/intel/CameraCapture';
import { IntelOverlay } from '../features/intel/IntelOverlay';
import { BriefingScreen } from '../features/briefing/BriefingScreen';
import { MeetingDebrief } from '../features/debrief/MeetingDebrief';

// ORACLE Navigation (Story post-4)
import { OracleNavigator, oracleTabConfig, oracleLinkingConfig } from './OracleNavigator';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Deep linking configuration (Story 8.4, updated post-4)
const linking: LinkingOptions<any> = {
  prefixes: ['mission-control://', 'https://missioncontrol.app'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Oracle: {
            screens: oracleLinkingConfig,
          },
        },
      },
    },
  },
};

// Main Tab Navigator
const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#333333',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#00FF88',
        tabBarInactiveTintColor: '#666666',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Oracle"
        component={OracleNavigator}
        options={oracleTabConfig}
      />
      <Tab.Screen
        name="Intel"
        component={CameraCapture}
        options={{
          tabBarLabel: 'INTEL',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Briefing"
        component={BriefingScreen as any}
        options={{
          tabBarLabel: 'BRIEFING',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Tests"
        component={UITestRunner}
        options={{
          tabBarLabel: 'TESTS',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flask-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#000000',
            borderBottomWidth: 1,
            borderBottomColor: '#333333',
          },
          headerTintColor: '#00FF88',
          headerTitleStyle: {
            fontWeight: 'bold',
            letterSpacing: 1,
          },
          contentStyle: {
            backgroundColor: '#000000',
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="TestRunner"
          component={UITestRunner}
          options={{ title: 'MISSION CONTROL TESTS' }}
        />
        <Stack.Screen
          name="CameraCapture"
          component={CameraCapture}
          options={{ title: 'INTEL CAPTURE', headerShown: false }}
        />
        <Stack.Screen
          name="IntelOverlay"
          component={IntelOverlay}
          options={{ title: 'INTELLIGENCE ANALYSIS', headerShown: false }}
        />
        <Stack.Screen
          name="BriefingScreen"
          component={BriefingScreen as any}
          options={{ title: 'BRIEFING', headerShown: false }}
        />
        <Stack.Screen
          name="MeetingDebrief"
          component={MeetingDebrief}
          options={{ title: 'DEBRIEF', headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};