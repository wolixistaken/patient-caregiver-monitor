// src/screens/patient/CaregiverManagementScreen.js
import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, 
  KeyboardAvoidingView, Platform, StatusBar 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // <-- DÜZELTME BURADA
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import { authService } from '../../services/authService';

const CaregiverManagementScreen = () => {
  const [contacts, setContacts] = useState([]);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const currentUser = auth().currentUser;

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [])
  );

  const loadContacts = async () => {
    if (currentUser) {
      const data = await authService.getPatientData(currentUser.uid);
      if (data && data.emergencyContacts) {
        setContacts(data.emergencyContacts);
      }
    }
  };

  const handleAddContact = async () => {
    if (!newName || !newPhone) {
      Alert.alert("Eksik", "İsim ve numara giriniz.");
      return;
    }
    if (!currentUser) return;

    const newContact = { id: Date.now().toString(), name: newName, phone: newPhone };
    const result = await authService.addContact(currentUser.uid, newContact);
    
    if (result.success) {
      setContacts(result.contacts);
      setNewName('');
      setNewPhone('');
      Alert.alert("Başarılı", "Kişi listeye eklendi.");
    }
  };

  const handleDeleteContact = async (id) => {
    Alert.alert("Sil", "Bu kişiyi silmek istediğine emin misin?", [
      { text: "İptal", style: "cancel" },
      { 
        text: "Sil", 
        style: 'destructive',
        onPress: async () => {
          if (!currentUser) return;
          const result = await authService.removeContact(currentUser.uid, id);
          if (result.success) setContacts(result.contacts);
        }
      }
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.nameText}>{item.name}</Text>
        <Text style={styles.phoneText}>{item.phone}</Text>
      </View>
      <TouchableOpacity onPress={() => handleDeleteContact(item.id)} style={styles.deleteButton}>
        <Icon name="trash-can-outline" size={22} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        {/* Modern Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Acil Durum Kişileri</Text>
          <Text style={styles.headerSubtitle}>Acil durumda ulaşılacak kişileri buradan yönetin</Text>
        </View>

        {/* Liste Alanı */}
        <View style={styles.listContainer}>
          {contacts.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="account-group-outline" size={60} color="#D1D5DB" />
              <Text style={styles.emptyText}>Henüz kimseyi eklemediniz.</Text>
            </View>
          ) : (
            <FlatList 
              data={contacts} 
              renderItem={renderItem} 
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Alt Form Alanı (Sabit) */}
        <View style={styles.footerForm}>
          <Text style={styles.formTitle}>Yeni Kişi Ekle</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <Icon name="account-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput 
                  style={styles.input} 
                  placeholder="İsim" 
                  value={newName} 
                  onChangeText={setNewName} 
                  placeholderTextColor="#9CA3AF"
              />
            </View>
            <View style={[styles.inputContainer, { marginLeft: 10 }]}>
              <Icon name="phone-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput 
                  style={styles.input} 
                  placeholder="Tel No" 
                  value={newPhone} 
                  onChangeText={setNewPhone} 
                  keyboardType="phone-pad" 
                  placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleAddContact}>
              <Icon name="plus" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Listeye Ekle</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffffff' }, 
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  
  header: {
    backgroundColor: '#fdfdfdff',
    padding: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 10
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#000000ff' },
  headerSubtitle: { color: '#606060ff', marginTop: 4 },

  listContainer: { flex: 1, paddingHorizontal: 20 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { color: '#9CA3AF', marginTop: 10, fontSize: 16 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  avatarContainer: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 15
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#3B82F6' },
  infoContainer: { flex: 1 },
  nameText: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  phoneText: { color: '#6B7280', fontSize: 14, marginTop: 2 },
  deleteButton: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },

  footerForm: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10
  },
  formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#374151' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  inputContainer: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', 
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 12 
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 12, color: '#1F2937' },
  addButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 12
  },
  addButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 }
});

export default CaregiverManagementScreen;