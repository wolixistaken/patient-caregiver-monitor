import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { authService } from '../../services/authService';

// BİLEŞEN ADINI DEĞİŞTİRDİK: RegisterScreen -> SignUpScreen
const SignUpScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('patient'); 
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password || !name) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
      return;
    }
    
    setLoading(true);
    try {
      // Kayıt fonksiyonu
      await authService.register(email, password, role, name, "5550000000");
      Alert.alert("Başarılı", "Hesap oluşturuldu!");
    } catch (error) {
      Alert.alert("Kayıt Hatası", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kayıt Ol</Text>

      <TextInput style={styles.input} placeholder="Ad Soyad" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Şifre" value={password} onChangeText={setPassword} secureTextEntry />

      <View style={styles.roleContainer}>
        <TouchableOpacity style={[styles.roleButton, role === 'patient' && styles.roleButtonActive]} onPress={() => setRole('patient')}>
            <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>Hasta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.roleButton, role === 'caregiver' && styles.roleButtonActive]} onPress={() => setRole('caregiver')}>
            <Text style={[styles.roleText, role === 'caregiver' && styles.roleTextActive]}>Bakıcı</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSignUp} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kayıt Ol</Text>}
      </TouchableOpacity>

      {/* Login'e Dönüş */}
      <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{marginTop: 20}}>
        <Text style={styles.linkText}>Zaten hesabın var mı? Giriş Yap</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#333' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16 },
  button: { backgroundColor: '#3B82F6', padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkText: { color: '#3B82F6', textAlign: 'center', fontSize: 16 },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  roleButton: { flex: 1, padding: 10, borderWidth: 1, borderColor: '#3B82F6', alignItems: 'center', marginHorizontal: 5, borderRadius: 8 },
  roleButtonActive: { backgroundColor: '#3B82F6' },
  roleText: { color: '#3B82F6', fontWeight: 'bold' },
  roleTextActive: { color: '#fff' }
});

export default SignUpScreen;