// App.js
import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Ekranları İçe Aktar
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen'; // <-- YENİ EKLENDİ
import PatientTabs from './src/navigation/PatientTabs'; 
import CaregiverTabs from './src/navigation/CaregiverTabs'; 

const Stack = createStackNavigator();

export default function App() {
  const [userRole, setUserRole] = useState(null); 

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          
          {/* DURUM 1: Giriş Yapılmamışsa */}
          {userRole === null ? (
            <>
              <Stack.Screen name="Login">
                {(props) => <LoginScreen {...props} setUserRole={setUserRole} />}
              </Stack.Screen>
              {/* Kayıt Ekranı Buraya Eklendi */}
              <Stack.Screen name="SignUp" component={SignUpScreen} />
            </>
          ) : 
          
          /* DURUM 2: Hasta Giriş Yapmışsa */
          userRole === 'patient' ? (
            <Stack.Screen name="PatientDashboard" component={PatientTabs} />
          ) : 
          
          /* DURUM 3: Bakıcı Giriş Yapmışsa */
          (
            <Stack.Screen name="CaregiverDashboard" component={CaregiverTabs} />
          )}

        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}