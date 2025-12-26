// src/screens/patient/EmergencyContactScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, Linking, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';

const EmergencyContactScreen = () => {
  const [caregiver, setCaregiver] = useState(null); // Profesyonel Bakıcı (Doktor vb.)
  const [contacts, setContacts] = useState([]); // Aile/Yakınlar Listesi (SMS Gidecekler)
  const [loading, setLoading] = useState(true);

  // Modal (Kişi Ekleme)
  const [isModalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      setLoading(true);
      const uid = auth().currentUser.uid;
      const userDoc = await firestore().collection('users').doc(uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        
        // 1. Manuel Eklenen Kişileri Çek (Aile)
        setContacts(userData.emergencyContacts || []);

        // 2. Bakıcı Bağlıysa Onun Bilgilerini Çek (Profesyonel)
        if (userData.caregiverId) {
            const caregiverDoc = await firestore().collection('users').doc(userData.caregiverId).get();
            if (caregiverDoc.exists) {
                setCaregiver(caregiverDoc.data());
            }
        } else {
            setCaregiver(null);
        }
      }
    } catch (error) {
      console.log("Veri çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  // Yeni Kişi Ekle (Firestore'a Kaydet)
  const addContact = async () => {
    if (!newName || !newPhone) {
        Alert.alert("Hata", "İsim ve Numara boş olamaz.");
        return;
    }

    try {
        const uid = auth().currentUser.uid;
        const newContact = { 
            id: Date.now().toString(), // Basit ID
            name: newName, 
            phone: newPhone 
        };

        // Mevcut listeye ekle (arrayUnion)
        await firestore().collection('users').doc(uid).update({
            emergencyContacts: firestore.FieldValue.arrayUnion(newContact)
        });

        Alert.alert("Başarılı", "Kişi listeye eklendi.");
        setModalVisible(false);
        setNewName('');
        setNewPhone('');
        fetchData(); // Listeyi Yenile

    } catch (error) {
        Alert.alert("Hata", "Kişi eklenemedi.");
        console.log(error);
    }
  };

  // Kişi Sil
  const deleteContact = async (contact) => {
    Alert.alert(
        "Sil", 
        `${contact.name} kişisini silmek istiyor musunuz?`,
        [
            { text: "Vazgeç", style: "cancel" },
            { 
                text: "Sil", 
                style: "destructive",
                onPress: async () => {
                    try {
                        const uid = auth().currentUser.uid;
                        await firestore().collection('users').doc(uid).update({
                            emergencyContacts: firestore.FieldValue.arrayRemove(contact)
                        });
                        fetchData();
                    } catch (err) {
                        Alert.alert("Hata", "Silinemedi");
                    }
                }
            }
        ]
    );
  };

  // Telefon Araması Yap
  const makeCall = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const renderContactItem = ({ item }) => (
    <View style={styles.contactCard}>
        <View style={styles.contactIconBg}>
            <Icon name="account-heart" size={30} color="#EF4444" />
        </View>
        <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={styles.contactName}>{item.name}</Text>
            <Text style={styles.contactPhone}>{item.phone}</Text>
        </View>
        
        {/* Arama Butonu */}
        <TouchableOpacity style={styles.actionButton} onPress={() => makeCall(item.phone)}>
            <Icon name="phone" size={24} color="#10B981" />
        </TouchableOpacity>

        {/* Silme Butonu */}
        <TouchableOpacity style={[styles.actionButton, {marginLeft: 10}]} onPress={() => deleteContact(item)}>
            <Icon name="trash-can" size={24} color="#EF4444" />
        </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Acil Durum Kişileri</Text>
        <Text style={styles.headerSubtitle}>SOS durumunda bu kişilere mesaj gider.</Text>
      </View>

      {/* --- BÖLÜM 1: PROFESYONEL BAKICI --- */}
      <Text style={styles.sectionTitle}>Sorumlu Bakıcı / Doktor</Text>
      {loading ? (
        <ActivityIndicator color="#3B82F6" />
      ) : caregiver ? (
        <View style={styles.caregiverCard}>
            <Icon name="doctor" size={50} color="#3B82F6" />
            <View style={{flex:1, marginLeft: 15}}>
                <Text style={styles.cgName}>{caregiver.name || 'Bakıcı'}</Text>
                <Text style={styles.cgEmail}>{caregiver.email}</Text>
                <Text style={styles.cgBadge}>Sistem Yöneticisi</Text>
            </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
            <Icon name="account-off" size={40} color="#9CA3AF" />
            <Text style={styles.emptyText}>Henüz bir bakıcıya bağlı değilsiniz.</Text>
            <Text style={styles.emptySubText}>Bakıcınız sizi mail adresinizle eklemeli.</Text>
        </View>
      )}

      {/* --- BÖLÜM 2: AİLE VE YAKINLAR (SMS LİSTESİ) --- */}
      <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>Yakınlarım (SMS Listesi)</Text>
          <TouchableOpacity style={styles.addBtnSmall} onPress={() => setModalVisible(true)}>
              <Icon name="plus" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Ekle</Text>
          </TouchableOpacity>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={item => item.id}
        renderItem={renderContactItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
            <Text style={styles.emptyListText}>
                Listede kimse yok. Acil durum için lütfen kişi ekleyin.
            </Text>
        }
      />

      {/* MODAL: Kişi Ekle */}
      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Kişi Ekle</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Ad Soyad"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.input}
              placeholder="Telefon (Örn: +90555...)"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnTextCancel}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnAdd} onPress={addContact}>
                <Text style={styles.btnTextAdd}>Kaydet</Text>
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
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 5 },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 10, marginTop: 10 },
  
  // Bakıcı Kartı
  caregiverCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 20, elevation: 2 },
  cgName: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  cgEmail: { fontSize: 14, color: '#6B7280', marginBottom: 5 },
  cgBadge: { backgroundColor: '#DBEAFE', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, color: '#1D4ED8', fontSize: 12, fontWeight: 'bold' },
  
  // Boş Durum
  emptyCard: { backgroundColor: '#E5E7EB', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 20 },
  emptyText: { color: '#4B5563', fontWeight: 'bold', marginTop: 10 },
  emptySubText: { color: '#6B7280', fontSize: 12 },

  // Liste Başlığı
  listHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addBtnSmall: { flexDirection: 'row', backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 4, fontSize: 13 },

  // Kişi Kartı
  contactCard: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 16, alignItems: 'center', marginBottom: 10, elevation: 1 },
  contactIconBg: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  contactName: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  contactPhone: { fontSize: 14, color: '#6B7280' },
  actionButton: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 10 },
  emptyListText: { textAlign: 'center', color: '#9CA3AF', marginTop: 20, fontStyle: 'italic' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { backgroundColor: '#fff', width: '100%', borderRadius: 20, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 15 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 15, color: '#1F2937' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end' },
  btnCancel: { padding: 10, marginRight: 10 },
  btnTextCancel: { color: '#6B7280', fontWeight: 'bold' },
  btnAdd: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  btnTextAdd: { color: '#fff', fontWeight: 'bold' }
});

export default EmergencyContactScreen;