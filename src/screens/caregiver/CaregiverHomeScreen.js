import React, { useState, useCallback } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, StatusBar, ActivityIndicator, RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import { useFocusEffect } from '@react-navigation/native';

// Servisi dahil et
import { authService } from '../../services/authService';

const CaregiverHomeScreen = ({ navigation }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true); // Sayfa yükleniyor mu?
  const [refreshing, setRefreshing] = useState(false); // Listeyi çekince yenileme

  // Modal (Hasta Ekleme) State'leri
  const [isModalVisible, setModalVisible] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [isAdding, setIsAdding] = useState(false); // Ekleme butonu loading'i

  // Sayfa her odağa geldiğinde verileri çek
  useFocusEffect(
    useCallback(() => {
      fetchPatients();
    }, [])
  );

  // Hastaları Veritabanından Çek
  const fetchPatients = async () => {
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        const data = await authService.getMyPatients(currentUser.uid);
        setPatients(data);
      }
    } catch (error) {
      console.log("Hasta çekme hatası:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Listeyi aşağı çekince yenile
  const onRefresh = () => {
    setRefreshing(true);
    fetchPatients();
  };

  // Yeni Hasta Ekle
  const handleAddPatient = async () => {
    if (!emailInput) {
      Alert.alert("Hata", "Lütfen bir mail adresi girin.");
      return;
    }

    setIsAdding(true);
    try {
      const uid = auth().currentUser.uid;
      // Servis fonksiyonunu çağır (Maili küçük harfe çevir)
      await authService.addPatientByEmail(uid, emailInput.trim().toLowerCase());
      
      Alert.alert("Başarılı", "Hasta listenize eklendi!");
      setModalVisible(false);
      setEmailInput('');
      fetchPatients(); // Listeyi hemen güncelle
    } catch (error) {
      Alert.alert("Hata", error.message || "Hasta eklenirken bir sorun oluştu.");
    } finally {
      setIsAdding(false);
    }
  };

  // Çıkış Yap Butonu
  const handleLogout = async () => {
    await authService.signOut();
  };

  // Liste Elemanı Görünümü
  const renderPatientItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => navigation.navigate('PatientDetail', { patient: item })}
    >
      <View style={styles.cardIcon}>
        <Icon name="account-circle" size={50} color="#3B82F6" />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.patientName}>{item.name || 'İsimsiz Hasta'}</Text>
        <Text style={styles.patientEmail}>{item.email}</Text>
        
        {/* Nabız Limit Bilgisi */}
        <View style={styles.limitBadge}>
            <Icon name="heart-pulse" size={12} color="#6B7280" style={{marginRight:4}} />
            <Text style={styles.limitText}>
                {item.thresholds?.minHeartRate || 50} - {item.thresholds?.maxHeartRate || 120} BPM
            </Text>
        </View>
      </View>
      <Icon name="chevron-right" size={30} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>Hastalarım</Text>
            <Text style={styles.headerSubtitle}>Takip Listesi</Text>
        </View>
        <View style={{flexDirection:'row'}}>
             {/* Ekle Butonu */}
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                <Icon name="plus" size={24} color="#fff" />
                <Text style={styles.addButtonText}>Ekle</Text>
            </TouchableOpacity>
            
            {/* Çıkış Butonu */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Icon name="logout" size={24} color="#EF4444" />
            </TouchableOpacity>
        </View>
      </View>

      {/* Liste */}
      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{marginTop: 50}} />
      ) : (
        <FlatList
            data={patients}
            keyExtractor={item => item.id}
            renderItem={renderPatientItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />
            }
            ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Icon name="account-group-outline" size={60} color="#D1D5DB" />
                <Text style={styles.emptyText}>Henüz kayıtlı hastanız yok.</Text>
                <Text style={styles.emptySubText}>Sağ üstten 'Ekle' butonuna basarak başlayın.</Text>
            </View>
            }
        />
      )}

      {/* MODAL: Hasta Ekleme */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Yeni Hasta Takibi</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Icon name="close" size={24} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDesc}>
                Takip etmek istediğiniz hastanın sisteme kayıtlı mail adresini giriniz.
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="ornek@hasta.com"
              value={emailInput}
              onChangeText={setEmailInput}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnTextCancel}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.btnAdd} onPress={handleAddPatient} disabled={isAdding}>
                {isAdding ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <Text style={styles.btnTextAdd}>Ekle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 20 },
  
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6B7280' },
  
  addButton: { flexDirection: 'row', backgroundColor: '#3B82F6', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, alignItems: 'center', marginRight: 10 },
  addButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 5 },
  logoutButton: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 20 },

  // Kart Stilleri
  card: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center', marginBottom: 12, elevation: 2 },
  cardIcon: { marginRight: 15 },
  cardContent: { flex: 1 },
  patientName: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  patientEmail: { fontSize: 14, color: '#6B7280', marginBottom: 6 },
  limitBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  limitText: { fontSize: 12, color: '#4B5563', fontWeight: '600' },

  // Boş Liste
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, color: '#4B5563', marginTop: 10, fontWeight: '600' },
  emptySubText: { fontSize: 14, color: '#9CA3AF', marginTop: 5 },
  
  // Modal Stilleri
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', width: '100%', borderRadius: 20, padding: 20, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalDesc: { color: '#6B7280', marginBottom: 20, fontSize: 14 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 20, color: '#1F2937' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  btnCancel: { padding: 10, marginRight: 10 },
  btnTextCancel: { color: '#6B7280', fontWeight: 'bold' },
  btnAdd: { backgroundColor: '#3B82F6', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 10, minWidth: 80, alignItems: 'center' },
  btnTextAdd: { color: '#fff', fontWeight: 'bold' }
});

export default CaregiverHomeScreen;