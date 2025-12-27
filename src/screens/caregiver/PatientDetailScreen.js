// src/screens/caregiver/PatientDetailScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { authService } from '../../services/authService';

const PatientDetailScreen = ({ route, navigation }) => {
  const { patient } = route.params;

  const [minHr, setMinHr] = useState(patient.thresholds?.minHeartRate?.toString() || '50');
  const [maxHr, setMaxHr] = useState(patient.thresholds?.maxHeartRate?.toString() || '120');
  const [loading, setLoading] = useState(false);
  
  // Acil Durum Geçmişi için State
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
        setHistoryLoading(true);
        // Hastanın UID'sini kullanarak geçmişi çek
        const data = await authService.getEmergencyHistory(patient.uid);
        setHistory(data);
        setHistoryLoading(false);
    };
    fetchHistory();
  }, [patient.uid]);

  const handleSave = async () => {
    setLoading(true);
    // Düzeltme: patient.name yerine patient.uid kullanıldı.
    const result = await authService.updateThresholds(patient.uid, minHr, maxHr);
    setLoading(false);
    
    if (result.success) {
      Alert.alert("Başarılı", "Eşik değerleri güncellendi. Hasta bu değerlerin dışına çıkarsa otomatik mesaj alacaksınız.");
    } else {
      Alert.alert("Hata", "Güncelleme yapılamadı.");
    }
  };

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyItem}>
        <View style={styles.historyIconContainer}>
            <Icon name="alert-circle" size={24} color="#EF4444" />
        </View>
        <View style={{flex:1}}>
            <Text style={styles.historyText}>{item.message || 'Acil durum uyarısı'}</Text>
            <Text style={styles.historyDate}>
                {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleString('tr-TR') : 'Tarih yok'}
            </Text>
        </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
             <Icon name="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Hasta Detayları</Text>
          <View style={{width: 24}} />
        </View>

        <View style={styles.profileCard}>
          <Image source={{ uri: patient.avatar || 'https://via.placeholder.com/80' }} style={styles.avatar} />
          <Text style={styles.name}>{patient.name}</Text>
          <Text style={styles.status}>{patient.statusText}</Text>
        </View>

        {/* Eşik Değeri Ayarları */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Otomatik Uyarı Sınırları</Text>
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

        {/* Acil Durum Geçmişi */}
        <View style={[styles.sectionContainer, {marginTop: 20, marginBottom: 40}]}>
            <Text style={styles.sectionTitle}>Acil Durum Geçmişi</Text>
            {historyLoading ? (
                <ActivityIndicator size="small" style={{marginTop:10}} />
            ) : history.length === 0 ? (
                <Text style={styles.noHistory}>Henüz kaydedilmiş bir acil durum yok.</Text>
            ) : (
                <View style={{marginTop: 10}}>
                    {history.map((item, index) => (
                        <View key={item.id || index} style={{marginBottom: 10}}>
                           {renderHistoryItem({item})}
                        </View>
                    ))}
                </View>
            )}
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
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 10, backgroundColor: '#ddd' },
  name: { fontSize: 20, fontWeight: 'bold' },
  status: { color: '#666' },

  sectionContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2 },
  sectionTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  subText: { color:'#666', fontSize: 12, marginBottom: 15 },
  
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  inputWrapper: { width: '45%' },
  label: { marginBottom: 5, fontWeight:'600' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16, textAlign:'center', color:'#000' },
  
  saveButton: { backgroundColor: '#10B981', padding: 15, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // History Styles
  noHistory: { color: '#999', fontStyle: 'italic', marginTop: 10 },
  historyItem: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5' },
  historyIconContainer: { marginRight: 10 },
  historyText: { color: '#7F1D1D', fontWeight: 'bold' },
  historyDate: { color: '#991B1B', fontSize: 12 }
});

export default PatientDetailScreen;