// src/screens/SignUpScreen.js
import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, 
  ScrollView, KeyboardAvoidingView, Platform, StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { authService } from '../services/authService';

const SignUpScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldurun.");
      return;
    }
    setLoading(true);
    const result = await authService.register(email, password, name, role);
    setLoading(false);

    if (result.success) {
      Alert.alert("Başarılı", "Hesap oluşturuldu! Giriş yapabilirsiniz.", [
        { text: "Tamam", onPress: () => navigation.navigate("Login") }
      ]);
    } else {
      Alert.alert("Kayıt Başarısız", result.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
               <Icon name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>Yeni Hesap Oluştur</Text>
          </View>

          {/* İsim */}
          <View style={styles.inputContainer}>
            <Icon name="account" size={20} color="#666" style={styles.icon} />
            <TextInput 
              style={styles.input} 
              placeholder="Ad Soyad" 
              placeholderTextColor="#999"
              value={name} 
              onChangeText={setName} 
            />
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Icon name="email" size={20} color="#666" style={styles.icon} />
            <TextInput 
              style={styles.input} 
              placeholder="E-posta" 
              placeholderTextColor="#999"
              value={email} 
              onChangeText={setEmail} 
              autoCapitalize="none" 
              keyboardType="email-address"
            />
          </View>

          {/* Şifre */}
          <View style={styles.inputContainer}>
            <Icon name="lock" size={20} color="#666" style={styles.icon} />
            <TextInput 
              style={styles.input} 
              placeholder="Şifre (min 6 karakter)" 
              placeholderTextColor="#999"
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry 
            />
          </View>

          {/* Rol Seçimi */}
          <Text style={styles.label}>Hesap Türü Seçin:</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity 
              style={[styles.roleButton, role === 'patient' && styles.roleActive]} 
              onPress={() => setRole('patient')}
            >
              <Icon name="account-heart" size={24} color={role === 'patient' ? '#fff' : '#666'} />
              <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>Hasta</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.roleButton, role === 'caregiver' && styles.roleActive]} 
              onPress={() => setRole('caregiver')}
            >
              <Icon name="doctor" size={24} color={role === 'caregiver' ? '#fff' : '#666'} />
              <Text style={[styles.roleText, role === 'caregiver' && styles.roleTextActive]}>Bakıcı</Text>
            </TouchableOpacity>
          </View>

          {/* Kayıt Butonu */}
          <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Kaydol</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent:'center' },
  header: { flexDirection:'row', alignItems:'center', marginBottom:30 },
  backButton: { marginRight: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, borderWidth:1, borderColor:'#E5E7EB' },
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#333' },
  label: { fontSize:16, fontWeight:'600', marginBottom:10, marginTop:10, color:'#374151' },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  roleButton: { flex: 0.48, flexDirection:'row', alignItems:'center', justifyContent:'center', padding: 15, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  roleActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  roleText: { marginLeft:8, fontWeight:'600', color:'#666' },
  roleTextActive: { color:'#fff' },
  registerButton: { backgroundColor: '#10B981', padding: 18, borderRadius: 12, alignItems: 'center', elevation:2 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

export default SignUpScreen;