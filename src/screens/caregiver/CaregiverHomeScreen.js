// src/screens/caregiver/CaregiverHomeScreen.js
//import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { authService } from '../../services/authService';

const CaregiverHomeScreen = ({ navigation }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchPatients = async () => {
        setLoading(true); // Yükleniyor göstergesi
        const data = await authService.getPatientsForCaregiver('u1');
        setPatients(data);
        setLoading(false);
      };
      
      fetchPatients();
    }, [])
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => navigation.navigate('PatientDetail', { patient: item })}
    >
      <Image source={{ uri: item.avatar }} style={styles.avatar} />
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.status}>{item.statusText}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator size="large" style={{flex:1}} />;

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Hastalarım</Text>
      <FlatList data={patients} renderItem={renderItem} keyExtractor={item => item.id} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', padding: 16 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 16 },
  infoContainer: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  status: { color: '#6B7280' }
});

export default CaregiverHomeScreen;