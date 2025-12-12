// src/navigation/PatientTabs.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// --- ÖNEMLİ: Dosya yollarının doğru olduğundan emin ol ---
import PatientHomeScreen from '../screens/patient/PatientHomeScreen';
import CaregiverManagementScreen from '../screens/patient/CaregiverManagementScreen';

const Tab = createBottomTabNavigator();

const PatientTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3B82F6', // Mavi (Aktif)
        tabBarInactiveTintColor: '#9CA3AF', // Gri (Pasif)
        tabBarStyle: { height: 60, paddingBottom: 10, paddingTop: 10 }
      }}
    >
      {/* 1. SEKME: DURUMUM */}
      <Tab.Screen 
        name="Durumum" 
        component={PatientHomeScreen} 
        options={{
          tabBarLabel: 'Durumum',
          tabBarIcon: ({ color, size }) => (
            <Icon name="pulse" size={size} color={color} />
          )
        }}
      />

      {/* 2. SEKME: BAKICIM (Lütfen buranın ekli olduğunu kontrol et) */}
      <Tab.Screen 
        name="Bakıcım" 
        component={CaregiverManagementScreen} 
        options={{
          tabBarLabel: 'Bakıcım',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account-heart" size={size} color={color} />
          )
        }}
      />
    </Tab.Navigator>
  );
};

export default PatientTabs;