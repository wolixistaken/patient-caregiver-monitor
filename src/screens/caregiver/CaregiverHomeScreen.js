// src/screens/caregiver/CaregiverHomeScreen.js
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth'; // Auth import edildi
import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Icon seti eklendi (yüklü değilse eklenmeli)
import { authService } from '../../services/authService';

const CaregiverHomeScreen = ({ navigation }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [emailToAdd, setEmailToAdd] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchPatients = async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
        setLoading(true);
        const data = await authService.getPatientsForCaregiver(currentUser.uid);
        setPatients(data);
        setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPatients();
    }, [])
  );

  const handleAddPatient = async () => {
    if (!emailToAdd.trim()) {
        Alert.alert("Uyarı", "Lütfen bir e-posta adresi girin.");
        return;
    }

    setAdding(true);
    const currentUser = auth().currentUser;
    if (!currentUser) { 
        Alert.alert("Hata", "Oturum hatası.");
        setAdding(false); 
        return; 
    }

    const result = await authService.assignPatientToCaregiver(currentUser.uid, emailToAdd.trim().toLowerCase());
    
    setAdding(false);
    
    if (result.success) {
        Alert.alert("Başarılı", "Hasta listenize eklendi.");
        setModalVisible(false);
        setEmailToAdd('');
        fetchPatients(); // Listeyi yenile
    } else {
        Alert.alert("Hata", result.message);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('PatientDetail', { patient: item })}
    >
      <Image source={{ uri: item.avatar || 'https://via.placeholder.com/50' }} style={styles.avatar} />
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.status}>{item.statusText}</Text>
      </View>
      <Icon name="chevron-right" size={24} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Hastalarım</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
              <Icon name="plus" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Ekle</Text>
          </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={{flex:1}} />
      ) : (
        <FlatList 
            data={patients} 
            renderItem={renderItem} 
            keyExtractor={item => item.id} 
            ListEmptyComponent={<Text style={styles.emptyText}>Henüz kayıtlı hastanız yok.</Text>}
        />
      )}

      {/* HASTA EKLEME MODALI */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Yeni Hasta Ekle</Text>
                <Text style={styles.modalSubTitle}>Eklemek istediğiniz hastanın sisteme kayıtlı e-posta adresini giriniz.</Text>
                
                <TextInput 
                    style={styles.input}
                    placeholder="ornek@hasta.com"
                    value={emailToAdd}
                    onChangeText={setEmailToAdd}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                        <Text style={styles.cancelText}>İptal</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.confirmBtn} onPress={handleAddPatient} disabled={adding}>
                        {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Ekle</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,marginTop:40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  
  addButton: { flexDirection:'row', alignItems:'center', backgroundColor: '#4F46E5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#fff', marginLeft: 4, fontWeight: 'bold' },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 16, backgroundColor:'#ddd' },
  infoContainer: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  status: { color: '#6B7280' },
  emptyText: { textAlign:'center', marginTop: 20, color:'#999' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  modalSubTitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, padding: 12, alignItems: 'center', marginRight: 10, backgroundColor: '#f3f4f6', borderRadius: 8 },
  confirmBtn: { flex: 1, padding: 12, alignItems: 'center', marginLeft: 10, backgroundColor: '#4F46E5', borderRadius: 8 },
  cancelText: { color: '#333', fontWeight: 'bold' },
  confirmText: { color: '#fff', fontWeight: 'bold' }
});

export default CaregiverHomeScreen;