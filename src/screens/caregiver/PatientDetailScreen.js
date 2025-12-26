import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator 
} from 'react-native';
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { authService } from '../../services/authService';

const PatientDetailScreen = ({ route, navigation }) => {
  const { patient } = route.params;

  const [minHr, setMinHr] = useState(patient.thresholds?.minHeartRate || 50);
  const [maxHr, setMaxHr] = useState(patient.thresholds?.maxHeartRate || 120);
  const [isSaving, setIsSaving] = useState(false);
  
  // ALARM LİSTESİ (Başlangıçta boş)
  const [alertHistory, setAlertHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Sayfa açılınca alarmları çek
  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    const alerts = await authService.getPatientAlerts(patient.id);
    setAlertHistory(alerts);
    setIsLoadingHistory(false);
  };

  const saveSettings = async () => {
    if (minHr >= maxHr) {
      Alert.alert("Hata", "Min değer, Max değerden büyük olamaz.");
      return;
    }
    
    setIsSaving(true);
    try {
      await authService.updatePatientThresholds(patient.id, minHr, maxHr);
      Alert.alert("Başarılı", "Limitler güncellendi!");
    } catch (error) {
      Alert.alert("Hata", "Güncelleme yapılamadı.");
    } finally {
      setIsSaving(false);
    }
  };

  // Tarih Formatlayıcı
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    // Firestore Timestamp -> JS Date -> String
    const date = timestamp.toDate(); 
    return date.toLocaleString('tr-TR', { 
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' 
    });
  };

  return (
    <ScrollView style={styles.container}>
      
      {/* Profil Kartı */}
      <View style={styles.profileCard}>
        <Icon name="account-circle" size={80} color="#3B82F6" />
        <Text style={styles.name}>{patient.name || 'İsimsiz Hasta'}</Text>
        <Text style={styles.email}>{patient.email}</Text>
        <View style={styles.statusRow}>
            <Icon name="circle" size={12} color="#10B981" />
            <Text style={styles.statusText}>Sistem Aktif</Text>
        </View>
      </View>

      {/* Ayarlar (Slider) */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
            <Icon name="heart-pulse" size={24} color="#EF4444" />
            <Text style={styles.cardTitle}>Nabız Alarm Limitleri</Text>
        </View>
        <Text style={styles.cardDesc}>Hasta bu değerlerin dışına çıkarsa size SMS gelir.</Text>

        <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelRow}>
                <Text style={styles.label}>Alt Limit</Text>
                <Text style={styles.valueText}>{minHr} BPM</Text>
            </View>
            <Slider
                style={{width: '100%', height: 40}}
                minimumValue={30} maximumValue={100} step={1}
                value={minHr} onValueChange={setMinHr}
                minimumTrackTintColor="#3B82F6" thumbTintColor="#3B82F6"
            />
        </View>

        <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelRow}>
                <Text style={styles.label}>Üst Limit</Text>
                <Text style={styles.valueText}>{maxHr} BPM</Text>
            </View>
            <Slider
                style={{width: '100%', height: 40}}
                minimumValue={100} maximumValue={200} step={1}
                value={maxHr} onValueChange={setMaxHr}
                minimumTrackTintColor="#EF4444" thumbTintColor="#EF4444"
            />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={saveSettings} disabled={isSaving}>
            <Text style={styles.saveButtonText}>{isSaving ? 'Kaydediliyor...' : 'AYARLARI KAYDET'}</Text>
        </TouchableOpacity>
      </View>

      {/* Geçmiş Alarmlar (GERÇEK VERİ) */}
      <View style={styles.sectionCard}>
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
            <View style={styles.cardHeader}>
                <Icon name="history" size={24} color="#6B7280" />
                <Text style={styles.cardTitle}>Acil Durum Geçmişi</Text>
            </View>
            <TouchableOpacity onPress={fetchAlerts}>
                <Icon name="refresh" size={24} color="#3B82F6" />
            </TouchableOpacity>
        </View>
        
        {isLoadingHistory ? (
            <ActivityIndicator size="small" color="#3B82F6" style={{marginTop:20}} />
        ) : alertHistory.length === 0 ? (
            <Text style={styles.emptyText}>Henüz kayıtlı bir alarm yok.</Text>
        ) : (
            alertHistory.map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                    <View style={[styles.alertIcon, { 
                        backgroundColor: alert.type === 'fall' ? '#FEE2E2' : 
                                         alert.type === 'sos' ? '#FEE2E2' : '#FEF3C7' 
                    }]}>
                        <Icon 
                            name={alert.type === 'fall' ? 'alert-octagram' : 
                                  alert.type === 'sos' ? 'alarm-light' : 'heart-broken'} 
                            size={20} 
                            color={alert.type === 'fall' || alert.type === 'sos' ? '#DC2626' : '#D97706'} 
                        />
                    </View>
                    <View style={{flex:1}}>
                        <Text style={styles.alertMessage}>{alert.message}</Text>
                        <Text style={styles.alertTime}>{formatDate(alert.timestamp)}</Text>
                    </View>
                </View>
            ))
        )}
      </View>

      <View style={{height: 40}} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 20 },
  profileCard: { alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, elevation: 2 },
  name: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginTop: 10 },
  email: { fontSize: 16, color: '#6B7280', marginBottom: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusText: { marginLeft: 5, color: '#10B981', fontWeight: '600' },
  sectionCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginLeft: 10 },
  cardDesc: { color: '#9CA3AF', marginBottom: 20, fontSize: 13 },
  sliderContainer: { marginBottom: 20 },
  sliderLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#4B5563' },
  valueText: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  saveButton: { backgroundColor: '#111827', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  alertItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 12 },
  alertIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  alertMessage: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  alertTime: { fontSize: 12, color: '#9CA3AF' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 10, fontStyle: 'italic' }
});

export default PatientDetailScreen;