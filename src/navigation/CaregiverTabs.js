// src/navigation/CaregiverTabs.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CaregiverHomeScreen from '../screens/caregiver/CaregiverHomeScreen';
import PatientDetailScreen from '../screens/caregiver/PatientDetailScreen';

const Stack = createStackNavigator();

const CaregiverTabs = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CaregiverHome" component={CaregiverHomeScreen} />
      <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
    </Stack.Navigator>
  );
};

export default CaregiverTabs;