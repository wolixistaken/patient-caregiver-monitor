// src/screens/LoginScreen.js
import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, 
  KeyboardAvoidingView, Platform, ScrollView, StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { authService } from '../services/authService';

const LoginScreen = ({ setUserRole, navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
      return;
    }
    setLoading(true);
    try {
      const response = await authService.login(email, password);
      if (response.success) {
        setUserRole(response.user.role);
      } else {
        Alert.alert("Giriş Başarısız", response.message);
      }
    } catch (error) {
      Alert.alert("Hata", "Bir sorun oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          <View style={styles.iconContainer}>
             <Icon name="shield-plus" size={50} color="#fff" />
          </View>
          <Text style={styles.title}>Hoş Geldiniz</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              placeholder="E-posta girin"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Şifre</Text>
            <TextInput
              style={styles.input}
              placeholder="Şifre girin"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, loading && { backgroundColor: '#93C5FD' }]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Giriş Yap</Text>}
          </TouchableOpacity>

          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Hesabınız yok mu? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
              <Text style={styles.signupText}>Hemen Kaydolun</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flexGrow: 1, 
    padding: 24, 
    justifyContent: 'center' 
  },
  iconContainer: { alignSelf: 'center', backgroundColor: '#3B82F6', padding: 15, borderRadius: 50, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 30 },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, padding: 14, fontSize: 16, color: '#333' },
  loginButton: { backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 24 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  footerContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  footerText: { color: '#666', fontSize: 14 },
  signupText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 14 }
});

export default LoginScreen;