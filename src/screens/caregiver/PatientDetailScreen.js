// src/screens/caregiver/PatientDetailScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { authService } from '../../services/authService';

const PatientDetailScreen = ({ route, navigation }) => {
  const { patient } = route.params;

  // State'ler: Mevcut değerleri başlangıç değeri olarak al
  const [minHr, setMinHr] = useState(patient.thresholds?.minHeartRate?.toString() || '50');
  const [maxHr, setMaxHr] = useState(patient.thresholds?.maxHeartRate?.toString() || '120');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    const result = await authService.updateThresholds(patient.name, minHr, maxHr);
    setLoading(false);
    
    if (result.success) {
      Alert.alert("Başarılı", "Eşik değerleri güncellendi. Hasta bu değerlerin dışına çıkarsa otomatik mesaj alacaksınız.");
    } else {
      Alert.alert("Hata", "Güncelleme yapılamadı.");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
             <Icon name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Hasta Ayarları</Text>
          <View style={{width: 24}} />
        </View>

        <View style={styles.profileCard}>
          <Image source={{ uri: patient.avatar }} style={styles.avatar} />
          <Text style={styles.name}>{patient.name}</Text>
          <Text style={styles.status}>{patient.statusText}</Text>
        </View>

        {/* Eşik Değeri Ayarları */}
        <View style={styles.settingsCard}>
          <Text style={styles.cardTitle}>Otomatik Uyarı Sınırları</Text>
          <Text style={styles.subText}>Nabız bu değerlerin dışına çıkarsa otomatik SMS gönderilir.</Text>
          
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Min Nabız</Text>
              <TextInput 
                style={styles.input} 
                value={minHr} 
                onChangeText={setMinHr} 
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Max Nabız</Text>
              <TextInput 
                style={styles.input} 
                value={maxHr} 
                onChangeText={setMaxHr} 
                keyboardType="numeric"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Ayarları Kaydet</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems:'center',marginTop:20 },
  title: { fontSize: 18, fontWeight: 'bold' },
  profileCard: { alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 10 },
  name: { fontSize: 20, fontWeight: 'bold' },
  status: { color: '#666' },
  settingsCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2 },
  cardTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  subText: { color:'#666', fontSize: 12, marginBottom: 15 },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  inputWrapper: { width: '45%' },
  label: { marginBottom: 5, fontWeight:'600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16, textAlign:'center', color:'#000' },
  saveButton: { backgroundColor: '#10B981', padding: 15, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default PatientDetailScreen;