import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, StatusBar, Modal, TextInput, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native'; 
import auth from '@react-native-firebase/auth';
import { launchImageLibrary } from 'react-native-image-picker'; // EKLENDİ
import AsyncStorage from '@react-native-async-storage/async-storage'; // EKLENDİ

import BleService from '../../services/BleService';
import { authService } from '../../services/authService';
import { sendEmergencySms } from '../../utils/SmsHelper';

const screenWidth = Dimensions.get('window').width;
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 Dakika (Hareketsizlik süresi)

const PatientHomeScreen = ({ navigation }) => {
  // --- STATE TANIMLARI ---
  const [heartRate, setHeartRate] = useState(0);
  const [status, setStatus] = useState('Normal'); 
  const [isConnected, setIsConnected] = useState(false);
  
  // Grafik ve Hasta Verisi
  const [historyData, setHistoryData] = useState([70, 72, 71, 73, 72]); 
  const [currentMinuteAvg, setCurrentMinuteAvg] = useState(72);
  const [patientData, setPatientData] = useState(null);

  // Yerel Resim State'i
  const [localProfileImage, setLocalProfileImage] = useState(null);
  
  // Alarmlar
  const [isFallDetected, setIsFallDetected] = useState(false);
  const [isPanicMode, setIsPanicMode] = useState(false); 
  const [countdown, setCountdown] = useState(10);
  const [isInactivityDetected, setIsInactivityDetected] = useState(false);
  const [lastActivityTimeStr, setLastActivityTimeStr] = useState(new Date().toLocaleTimeString().slice(0,5));

  // --- MODAL (DÜZENLEME) STATE ---
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', // Isim alani eklendi
    age: '',
    bloodType: '',
    minHeartRate: '50',
    maxHeartRate: '120',
    photoUri: null, 
  });

  // --- REFS ---
  const patientDataRef = useRef(null);
  const heartRateRef = useRef(0);
  const isFallDetectedRef = useRef(false);
  const minuteBuffer = useRef([]); 
  
  // SMS Kilitleri (Zamanlayıcılar)
  const lastHeartRateSmsTime = useRef(0);
  const lastMovementTime = useRef(Date.now());
  const lastESmsTime = useRef(0); // YENİ: E sinyali SMS kilidi

  // Ref Senkronizasyonu
  useEffect(() => { patientDataRef.current = patientData; }, [patientData]);
  useEffect(() => { heartRateRef.current = heartRate; }, [heartRate]);
  useEffect(() => { isFallDetectedRef.current = isFallDetected; }, [isFallDetected]);

  // --- VERİ YÜKLEME ---
  const loadSettings = useCallback(async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
        // 1. Veritabanından verileri çek
        const data = await authService.getPatientData(currentUser.uid);
        
        // 2. Telefondan kayıtlı resmi çek
        const savedImage = await AsyncStorage.getItem(`profileImage_${currentUser.uid}`);
        if (savedImage) {
            setLocalProfileImage(savedImage);
        }

        if (data) {
            setPatientData(data);
            setEditForm({
                name: data.name || '', // Isim verisini cek
                age: data.age || '',
                bloodType: data.bloodType || '',
                minHeartRate: data.thresholds?.minHeartRate ? String(data.thresholds.minHeartRate) : '50',
                maxHeartRate: data.thresholds?.maxHeartRate ? String(data.thresholds.maxHeartRate) : '120',
                photoUri: savedImage || null, 
            });
        }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  // --- FOTOĞRAF SEÇME ---
  const handleSelectPhoto = () => {
    const options = { mediaType: 'photo', quality: 0.7 };
    launchImageLibrary(options, (response) => {
      if (response.didCancel) return;
      if (response.errorMessage) {
        Alert.alert("Hata", "Resim seçilemedi.");
        return;
      }
      if (response.assets && response.assets.length > 0) {
        const uri = response.assets[0].uri;
        setEditForm(prev => ({ ...prev, photoUri: uri }));
      }
    });
  };

  // --- AYARLARI KAYDETME ---
  const handleSaveSettings = async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    try {
        if (editForm.photoUri) {
            await AsyncStorage.setItem(`profileImage_${currentUser.uid}`, editForm.photoUri);
            setLocalProfileImage(editForm.photoUri); 
        }

        const updatedData = {
            name: editForm.name, // Isim guncellemesi
            age: editForm.age,
            bloodType: editForm.bloodType,
            thresholds: {
                minHeartRate: parseInt(editForm.minHeartRate) || 50,
                maxHeartRate: parseInt(editForm.maxHeartRate) || 120
            }
        };

        const success = await authService.updatePatientData(currentUser.uid, updatedData);
        if (success) {
            Alert.alert("Başarılı", "Profil bilgileri güncellendi.");
            setEditModalVisible(false);
            loadSettings(); 
        } else {
            Alert.alert("Hata", "Güncelleme yapılamadı.");
        }
    } catch (e) {
        Alert.alert("Hata", "Beklenmedik bir hata oluştu.");
    }
  };

  // --- BLE VE SENSÖR DİNLEYİCİSİ ---
  useEffect(() => {
    let isMounted = true;

    const onHeartRate = (hr) => {
        if (!isMounted) return;
        setHeartRate(hr);
        processChartData(hr);
        checkHeartRateHealth(hr);
    };

    const onMotion = (motion) => {
        if (!isMounted) return;

        // --- YENİ EKLENEN KISIM: E SİNYALİ KONTROLÜ ---
        // Eğer E değeri 1 ise ve son 1 dakika (60000ms) içinde mesaj atılmadıysa
        if ((motion.E === 1 || motion.E === '1') && (Date.now() - lastESmsTime.current > 60000)) {
            console.log("🚨 E Sinyali (1) Algılandı! SMS Gönderiliyor...");
            sendESignalSMS(); // SMS Fonksiyonunu çağır
            lastESmsTime.current = Date.now(); // Zamanlayıcıyı güncelle
        }
        // ------------------------------------------------

        const totalAccel = Math.sqrt(motion.x ** 2 + motion.y ** 2 + motion.z ** 2);
        
        // 1. Düşme Kontrolü (>2.5G)
        if (totalAccel > 25000 && !isFallDetectedRef.current) {
            triggerFallAlarm();
        }

        // 2. Hareket Kontrolü
        if (Math.abs(totalAccel - 16384) > 2000) {
            lastMovementTime.current = Date.now();
            const nowStr = new Date().toLocaleTimeString().slice(0,5);
            setLastActivityTimeStr(prev => (prev !== nowStr ? nowStr : prev));
            
            if (isInactivityDetected) {
                setIsInactivityDetected(false);
                setStatus('Normal');
            }
        }
    };

    const initBle = async () => {
      const permission = await BleService.requestPermissions();
      if (permission && isMounted) {
        BleService.setDataListeners(onHeartRate, onMotion);
        BleService.scanAndConnect('cdtp', (device) => {
            if(isMounted) setIsConnected(true);
        });
      }
    };

    initBle();
    return () => { isMounted = false; BleService.disconnect(); };
  }, [isInactivityDetected]); 

  // --- HAREKETSİZLİK ALARMI ---
  useEffect(() => {
    const interval = setInterval(() => {
        const timeDiff = Date.now() - lastMovementTime.current;
        if (timeDiff > INACTIVITY_LIMIT && !isInactivityDetected && !isFallDetected) {
            setIsInactivityDetected(true);
            setStatus('Hareketsiz');
            Alert.alert("Hareketsizlik", "Uzun süredir hareket etmediniz.",
                [
                    { text: "İyiyim", onPress: () => { lastMovementTime.current = Date.now(); setIsInactivityDetected(false); setStatus('Normal'); }},
                    { text: "Yardım", onPress: () => sendInactivitySMS() }
                ]
            );
        }
    }, 10000); 
    return () => clearInterval(interval);
  }, [isInactivityDetected, isFallDetected]);

  // --- YARDIMCI METODLAR ---

  // YENİ: E Sinyali SMS Gönderme Fonksiyonu
  const sendESignalSMS = useCallback(() => {
    const pData = patientDataRef.current;
    if (pData?.emergencyContacts?.length) {
        pData.emergencyContacts.forEach(c => sendEmergencySms(c.phone, `🚨 ACİL: Cihazdan Acil Durum Sinyali (E) Alındı! Lütfen kontrol edin.`));
    }
    setStatus('Acil Durum (E)!');
    Alert.alert("UYARI", "Cihazdan manuel acil durum sinyali alındı.");
  }, []);

  const checkHeartRateHealth = useCallback((currentHr) => {
    const pData = patientDataRef.current;
    if (!pData || isFallDetectedRef.current) return;
    const { minHeartRate, maxHeartRate } = pData.thresholds || { minHeartRate: 50, maxHeartRate: 120 };
    
    if (currentHr > maxHeartRate || (currentHr < minHeartRate && currentHr > 10)) {
        setStatus(currentHr > maxHeartRate ? 'Yüksek Nabız' : 'Düşük Nabız');
        if (Date.now() - lastHeartRateSmsTime.current > 300000) {
            if (pData.emergencyContacts?.length) {
                pData.emergencyContacts.forEach(c => sendEmergencySms(c.phone, `🚨 ACİL: Nabız kritik (${currentHr} BPM).`));
                lastHeartRateSmsTime.current = Date.now();
            }
        }
    } else if (!isInactivityDetected && status !== 'Acil Durum (E)!') {
        setStatus('Normal');
    }
  }, [isInactivityDetected, status]);

  const sendInactivitySMS = useCallback(() => {
    const pData = patientDataRef.current;
    if (pData?.emergencyContacts?.length) {
        pData.emergencyContacts.forEach(c => sendEmergencySms(c.phone, `⚠️ UYARI: Hasta hareketsiz.`));
    }
  }, []);

  const sendActualFallSMS = useCallback(() => {
    const pData = patientDataRef.current;
    if (pData?.emergencyContacts?.length) {
        pData.emergencyContacts.forEach(c => sendEmergencySms(c.phone, `🚨 DÜŞME ALGILANDI!`));
    }
    setStatus('Yardım Çağrıldı');
  }, []);

  const handleSOS = useCallback(() => {
    setIsPanicMode(true);
    const pData = patientDataRef.current;
    if (pData?.emergencyContacts?.length) {
        pData.emergencyContacts.forEach(c => sendEmergencySms(c.phone, "YARDIM EDİN! Manuel SOS Butonuna Basıldı."));
        Alert.alert("SOS", "Yardım mesajı gönderildi!");
    } else {
        Alert.alert("Hata", "Kişi listesi boş.");
    }
    setTimeout(() => setIsPanicMode(false), 2000);
  }, []);

  const processChartData = useCallback((hrValue) => {
    minuteBuffer.current.push(hrValue);
    if (minuteBuffer.current.length >= 60) {
        const avg = Math.round(minuteBuffer.current.reduce((a, b) => a + b, 0) / 60);
        setHistoryData(prev => [...prev.slice(1), avg]);
        minuteBuffer.current = [];
        setCurrentMinuteAvg(hrValue); 
    } else {
        const currentAvg = Math.round(minuteBuffer.current.reduce((a, b) => a + b, 0) / minuteBuffer.current.length);
        setCurrentMinuteAvg(currentAvg);
    }
  }, []);

  const triggerFallAlarm = useCallback(() => { setStatus('DÜŞME!'); setIsFallDetected(true); setCountdown(10); }, []);
  const resetFallAlarm = useCallback(() => { setIsFallDetected(false); setCountdown(10); setStatus('Normal'); }, []);

  useEffect(() => {
    let interval = null;
    if (isFallDetected) interval = setInterval(() => setCountdown(p => (p <= 1 ? 0 : p - 1)), 1000);
    return () => clearInterval(interval);
  }, [isFallDetected]);

  useEffect(() => { if (isFallDetected && countdown === 0) { sendActualFallSMS(); resetFallAlarm(); } }, [isFallDetected, countdown]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#3b5998' }}> 
      <StatusBar barStyle="light-content" backgroundColor="#3b5998" />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <Icon name="menu" size={30} color="#fff" />
                <Text style={styles.headerTitle}>Patient Monitor</Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#0f0' : '#f00' }]} />
        </View>

        {/* KİŞİ KARTI */}
        <View style={styles.card}>
            <View style={styles.profileRow}>
                <View style={styles.avatarContainer}>
                    {localProfileImage ? (
                        <Image source={{ uri: localProfileImage }} style={styles.avatarImage} />
                    ) : (
                        <Icon name="account" size={40} color="#4A90E2" />
                    )}
                </View>
                <View style={styles.profileInfo}>
                    <Text style={styles.nameText}>{patientData?.name || "Kullanıcı"}</Text>
                    <Text style={styles.subText}>Hasta Profili</Text>
                </View>
                <TouchableOpacity onPress={() => setEditModalVisible(true)} style={{ marginLeft: 'auto', padding: 5 }}>
                    <Icon name="pencil" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                    <Icon name="calendar-clock" size={20} color="#FFD700" />
                    <Text style={styles.infoLabel}>YAŞ</Text>
                    <Text style={styles.infoValue}>{patientData?.age || "--"}</Text>
                </View>
                <View style={styles.infoItem}>
                    <Icon name="water" size={20} color="#FF4444" />
                    <Text style={styles.infoLabel}>KAN GRUBU</Text>
                    <Text style={styles.infoValue}>{patientData?.bloodType || "--"}</Text>
                </View>
            </View>
        </View>

        {/* NABIZ KARTI */}
        <View style={styles.card}>
          <Text style={styles.cardTitleLabel}>HEART RATE</Text>
          <View style={styles.bpmRow}>
             <Text style={styles.bpmText}>{heartRate}</Text>
             <Text style={styles.bpmUnit}>BPM</Text>
             <Icon name="heart" size={50} color={status.includes('Normal') ? "#ff4081" : "red"} style={{marginLeft: 'auto'}} />
          </View>
          <LineChart
            data={{ labels: ["-5", "-4", "-3", "-2", "-1", "0"], datasets: [{ data: [...historyData, currentMinuteAvg] }] }}
            width={screenWidth - 80} height={140}
            chartConfig={{
              backgroundColor: "transparent", backgroundGradientFromOpacity: 0, backgroundGradientToOpacity: 0,
              decimalPlaces: 0, color: (opacity=1) => `rgba(255, 255, 255, ${opacity})`,
              propsForDots: { r: "3", strokeWidth: "1", stroke: "#fff" }
            }}
            bezier style={{ marginTop: 10 }}
          />
        </View>

        {/* DURUM KARTLARI */}
        <View style={styles.statusGrid}>
            <View style={[styles.statusCard, isFallDetected && styles.alarmCardRed]}>
                <Icon name="human-accidental-fall" size={28} color={isFallDetected ? "#fff" : "#ff4081"} />
                <Text style={[styles.statusLabel, isFallDetected && {color:'#fff'}]}>Düşme</Text>
                <Text style={[styles.statusValue, isFallDetected && {color:'#fff'}]}>
                    {isFallDetected ? "TESPİT!" : "Yok"}
                </Text>
            </View>

            <View style={[styles.statusCard, isInactivityDetected && styles.alarmCardOrange]}>
                <Icon name="run" size={28} color={isInactivityDetected ? "#fff" : "#ff4081"} />
                <Text style={[styles.statusLabel, isInactivityDetected && {color:'#fff'}]}>Hareket</Text>
                <Text style={[styles.statusValue, isInactivityDetected && {color:'#fff'}]}>
                    {isInactivityDetected ? "Hareketsiz" : "Aktif"}
                </Text>
                <Text style={[styles.timeText, isInactivityDetected && {color:'#fff'}]}>
                    Son: {lastActivityTimeStr}
                </Text>
            </View>
        </View>

        {/* SOS BUTONU */}
        <View style={styles.sosContainer}>
            <TouchableOpacity 
                style={[styles.sosButton, isPanicMode && { transform: [{scale: 0.95}] }]}
                activeOpacity={0.7}
                onPress={handleSOS}
            >
                <View style={styles.sosInnerCircle}>
                    <Text style={styles.sosText}>SOS</Text>
                    <Icon name="broadcast" size={24} color="#fff" style={{marginTop: 5}}/>
                </View>
            </TouchableOpacity>
            <Text style={styles.sosLabel}>Acil Durum Panik Butonu</Text>
        </View>

        {/* DÜZENLEME MODALI */}
        <Modal visible={isEditModalVisible} animationType="slide" transparent={true} onRequestClose={() => setEditModalVisible(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Bilgileri Düzenle</Text>
                    
                    <View style={{ alignItems: 'center', marginBottom: 20 }}>
                        <TouchableOpacity onPress={handleSelectPhoto} style={styles.editAvatarContainer}>
                            {editForm.photoUri ? (
                                <Image source={{ uri: editForm.photoUri }} style={styles.editAvatarImage} />
                            ) : (
                                <Icon name="camera-plus" size={30} color="#666" />
                            )}
                            <View style={styles.editIconBadge}>
                                <Icon name="pencil" size={14} color="#fff" />
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.changePhotoText}>Fotoğrafı Değiştir</Text>
                    </View>

                    {/* İSİM ALANI EKLENDİ */}
                    <Text style={styles.inputLabel}>İsim Soyisim</Text>
                    <TextInput style={styles.input} value={editForm.name} onChangeText={(t) => setEditForm({...editForm, name: t})}/>

                    <Text style={styles.inputLabel}>Yaş</Text>
                    <TextInput style={styles.input} value={editForm.age} onChangeText={(t) => setEditForm({...editForm, age: t})} keyboardType="numeric"/>
                    
                    <Text style={styles.inputLabel}>Kan Grubu</Text>
                    <TextInput style={styles.input} value={editForm.bloodType} onChangeText={(t) => setEditForm({...editForm, bloodType: t})}/>

                    <View style={styles.dividerGray} />
                    <Text style={styles.sectionHeader}>Alarm Eşik Değerleri</Text>

                    <View style={styles.row}>
                        <View style={{flex:1, marginRight:10}}>
                            <Text style={styles.inputLabel}>Min Nabız</Text>
                            <TextInput style={styles.input} value={editForm.minHeartRate} onChangeText={(t) => setEditForm({...editForm, minHeartRate: t})} keyboardType="numeric"/>
                        </View>
                        <View style={{flex:1}}>
                            <Text style={styles.inputLabel}>Max Nabız</Text>
                            <TextInput style={styles.input} value={editForm.maxHeartRate} onChangeText={(t) => setEditForm({...editForm, maxHeartRate: t})} keyboardType="numeric"/>
                        </View>
                    </View>

                    <View style={styles.modalButtons}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                            <Text style={styles.btnText}>İptal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
                            <Text style={styles.btnText}>Kaydet</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>

        {/* DÜŞME UYARI MODALI */}
        <Modal visible={isFallDetected} transparent={true} animationType="fade">
            <View style={[styles.modalOverlay, {backgroundColor:'rgba(255,0,0,0.8)'}]}>
                <View style={styles.alertBox}>
                    <Icon name="alert" size={60} color="red" />
                    <Text style={styles.alertTitle}>DÜŞME ALGILANDI!</Text>
                    <Text style={styles.countdownText}>{countdown}</Text>
                    <TouchableOpacity style={styles.cancelBtn} onPress={resetFallAlarm}>
                        <Text style={styles.btnText}>İYİYİM</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', marginTop: 10 },
  headerTitle: { fontSize: 20, color: '#fff', fontWeight: 'bold', marginLeft: 10 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  card: { backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 20, marginBottom: 15, borderRadius: 20, padding: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e1e1e1', justifyContent: 'center', alignItems: 'center', marginRight: 15, overflow:'hidden' },
  avatarImage: { width: 50, height: 50 },
  nameText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  subText: { color: '#ddd', fontSize: 12 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 15 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-around' },
  infoItem: { alignItems: 'center' },
  infoLabel: { color: '#ccc', fontSize: 11, marginTop: 5, fontWeight:'bold' },
  infoValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cardTitleLabel: { color: '#ccc', fontSize: 12, marginBottom: 5 },
  bpmRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bpmText: { color: '#fff', fontSize: 48, fontWeight: 'bold', lineHeight: 50 },
  bpmUnit: { color: '#ccc', fontSize: 16, marginLeft: 5, marginBottom: 8 },
  statusGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  statusCard: { backgroundColor: 'rgba(255,255,255,0.15)', width: (screenWidth - 50) / 2, borderRadius: 15, padding: 15, alignItems: 'center', height: 110, justifyContent:'center' },
  statusLabel: { color: '#ccc', marginTop: 5 },
  statusValue: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  timeText: { color: '#ddd', fontSize: 10, marginTop: 2 },
  alarmCardRed: { backgroundColor: '#ff4444' },
  alarmCardOrange: { backgroundColor: '#ffbb33' },
  sosContainer: { alignItems: 'center', marginTop: 5, marginBottom: 40 },
  sosButton: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#ff3333', justifyContent: 'center', alignItems: 'center', elevation: 12, shadowColor: '#ff0000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.6, shadowRadius: 10, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' },
  sosInnerCircle: { width: 86, height: 86, borderRadius: 43, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
  sosText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  sosLabel: { color: '#ccc', marginTop: 12, fontSize: 13, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 20 },
  inputLabel: { fontSize: 13, color: '#666', marginBottom: 6, fontWeight:'600' },
  input: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, marginBottom: 15, color: '#333', borderWidth:1, borderColor:'#ddd' },
  row: { flexDirection: 'row' },
  dividerGray: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
  sectionHeader: { fontSize: 15, color: '#333', fontWeight:'bold', marginBottom: 15 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex:1, backgroundColor: '#9CA3AF', padding: 15, borderRadius: 12, marginRight: 10, alignItems:'center' },
  saveBtn: { flex:1, backgroundColor: '#3b5998', padding: 15, borderRadius: 12, alignItems:'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  editAvatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'visible', borderWidth:1, borderColor:'#ddd' },
  editAvatarImage: { width: 100, height: 100, borderRadius: 50 },
  editIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#4A90E2', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth:2, borderColor:'#fff' },
  changePhotoText: { color: '#4A90E2', fontSize: 14, fontWeight:'600', marginTop: 10 },
  alertBox: { backgroundColor: '#fff', padding: 30, borderRadius: 20, alignItems: 'center', width:'85%' },
  alertTitle: { fontSize: 24, color: 'red', fontWeight: 'bold', marginVertical: 15 },
  countdownText: { fontSize: 70, fontWeight: 'bold', color: 'red' }
});

export default PatientHomeScreen;