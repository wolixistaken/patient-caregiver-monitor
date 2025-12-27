// src/screens/patient/PatientHomeScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, StatusBar, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native'; 
import auth from '@react-native-firebase/auth';

import BleService from '../../services/BleService';
import { authService } from '../../services/authService';
import { sendEmergencySms } from '../../utils/SmsHelper';

const screenWidth = Dimensions.get('window').width;
const STEP_GOAL = 10000; 

const PatientHomeScreen = ({ navigation }) => {
  const [heartRate, setHeartRate] = useState(0);
  const [steps, setSteps] = useState(0);
  const [status, setStatus] = useState('Normal'); 
  const [isConnected, setIsConnected] = useState(false);
  
  // GEÇMİŞ VERİLER (Son 5 dakika)
  const [historyData, setHistoryData] = useState([70, 72, 71, 73, 72]); 
  
  // ŞİMDİKİ DAKİKA
  const [currentMinuteAvg, setCurrentMinuteAvg] = useState(72);

  const [patientData, setPatientData] = useState(null);
  const [lastAlertTime, setLastAlertTime] = useState(0);

  // --- DÜŞME ALGILAMA STATE'LERİ ---
  const [isFallDetected, setIsFallDetected] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const countdownInterval = useRef(null);

  // Veri Havuzu
  const minuteBuffer = useRef([]); 

  // AYARLARI YÜKLE
  useFocusEffect(
    useCallback(() => {
      const loadSettings = async () => {
        const currentUser = auth().currentUser;
        if (currentUser) {
            const data = await authService.getPatientData(currentUser.uid);
            if (data) setPatientData(data);
        }
      };
      loadSettings();
    }, [])
  );

  // GERİ SAYIM MANTIĞI
  useEffect(() => {
    if (isFallDetected && countdown > 0) {
        countdownInterval.current = setInterval(() => {
            setCountdown((prev) => prev - 1);
        }, 1000);
    } else if (countdown === 0 && isFallDetected) {
        clearInterval(countdownInterval.current);
        sendActualFallSMS();
        setIsFallDetected(false);
        setCountdown(10);
    }
    return () => clearInterval(countdownInterval.current);
  }, [isFallDetected, countdown]);

  // BLUETOOTH BAĞLANTISI
  useEffect(() => {
    let isMounted = true;
    const initBluetooth = async () => {
      const permission = await BleService.requestPermissions();
      if (permission && isMounted) {
        BleService.scanAndConnect(
          (data) => { if(isMounted) handleSensorData(data); },
          (error) => { console.log("BLE Hatası:", error); if(isMounted) setIsConnected(false); },
          () => { if(isMounted) setIsConnected(true); }
        );
      }
    };
    initBluetooth();
    return () => {
        isMounted = false;
        BleService.disconnect();
    };
  }, []);

  const handleSensorData = (rawData) => {
    try {
      const parts = rawData.split(',');
      let currentHr = heartRate;
      let isSensorFall = false;

      parts.forEach(part => {
        if (part.includes('HR:')) {
            currentHr = parseInt(part.split(':')[1]);
            setHeartRate(currentHr);
            processChartData(currentHr);
        }
        if (part.includes('ST:') || part.includes('STEPS:')) {
            setSteps(parseInt(part.split(':')[1]));
        }
        // Düşme Kontrolü (Sensörden F:1 gelirse)
        if (part.includes('F:1')) {
            isSensorFall = true;
        }
      });

      // Eğer sensör düşme dediyse ve biz zaten alarm modunda değilsek -> Alarmı aç
      if (isSensorFall && !isFallDetected) {
         triggerFallAlarm();
      } else {
         checkHeartRateHealth(currentHr);
      }

    } catch (e) {
      console.log("Veri Hatası:", e);
    }
  };

  const processChartData = (hrValue) => {
    minuteBuffer.current.push(hrValue);
    const sum = minuteBuffer.current.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / minuteBuffer.current.length);
    setCurrentMinuteAvg(avg);

    if (minuteBuffer.current.length >= 60) {
        setHistoryData(prev => [...prev.slice(1), avg]);
        minuteBuffer.current = [];
        setCurrentMinuteAvg(hrValue); 
    }
  };

  // --- ALARM FONKSİYONLARI ---
  const triggerFallAlarm = () => {
    setStatus('DÜŞME TESPİT EDİLDİ!');
    setIsFallDetected(true);
    setCountdown(10);
  };

  const cancelFallAlarm = () => {
    setIsFallDetected(false);
    setCountdown(10);
    clearInterval(countdownInterval.current);
    setStatus('Normal');
    Alert.alert("İptal Edildi", "Acil durum mesajı gönderilmedi.");
  };

  const sendActualFallSMS = () => {
    if (!patientData?.emergencyContacts?.length) return;
    const message = `🚨 ACİL DURUM: Hastanız düştü veya baygınlık geçirdi! Nabız: ${heartRate} BPM. Konum bilgisi kontrol ediniz.`;
    patientData.emergencyContacts.forEach(c => sendEmergencySms(c.phone, message));
    Alert.alert("GÖNDERİLDİ", "Acil durum mesajı bakıcınıza iletildi.");
    setStatus('Yardım Çağrıldı');
  };

  const checkHeartRateHealth = (currentHr) => {
    if (!patientData) return;
    const { minHeartRate, maxHeartRate } = patientData.thresholds || { minHeartRate: 50, maxHeartRate: 120 };
    const now = Date.now();
    
    // Spam koruması
    if (now - lastAlertTime < 60000) return;

    if (currentHr > maxHeartRate) {
        setStatus('Yüksek Nabız');
        // İstersen buraya da otomatik SMS ekleyebilirsin
    } else if (currentHr < minHeartRate && currentHr > 10) {
        setStatus('Düşük Nabız');
    } else {
        setStatus('Normal');
    }
  };

  const handleSOS = () => {
    if (patientData && patientData.emergencyContacts && patientData.emergencyContacts.length > 0) {
        patientData.emergencyContacts.forEach(c => sendEmergencySms(c.phone, "YARDIM EDİN! Manuel SOS."));
        Alert.alert("SOS", "Acil durum mesajı gönderildi!");
    } else {
        Alert.alert("Kişi Bulunamadı", "Lütfen önce 'Bakıcım' sekmesinden kişi ekleyin.",
            [{ text: "Tamam" }, { text: "Git", onPress: () => navigation.navigate("Bakıcım") }]
        );
    }
  };

  const progressPercent = Math.min((steps / STEP_GOAL) * 100, 100);
  const combinedChartData = [...historyData, currentMinuteAvg];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(248, 249, 250, 1)' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: isConnected ? '#D1FAE5' : '#FEE2E2' }]}>
            <Icon name={isConnected ? "bluetooth-connect" : "bluetooth-off"} size={16} color={isConnected ? '#059669' : '#DC2626'} />
            <Text style={[styles.statusText, { color: isConnected ? '#059669' : '#DC2626' }]}>
              {isConnected ? ' Sensör Bağlı' : ' Sensör Aranıyor...'}
            </Text>
          </View>
        </View>

        {/* --- NABIZ KARTI --- */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Anlık Kalp Atış Hızı</Text>
            <Icon name="heart" size={24} color="#EF4444" />
          </View>
          
          <View style={styles.bpmContainer}>
            <Text style={[styles.bpmValue, { color: status === 'Normal' ? '#1F2937' : '#EF4444' }]}>
              {heartRate}
            </Text>
            <Text style={styles.bpmUnit}>BPM</Text>
          </View>
          <Text style={styles.subtitle}>Son 5 dakika verileri</Text>
          
          <LineChart
            data={{
              labels: ["-5dk", "-4dk", "-3dk", "-2dk", "-1dk", "Şimdi"],
              datasets: [
                { data: combinedChartData },
                { data: [50, 130], color: () => 'transparent', strokeWidth: 0, withDots: false } 
              ]
            }}
            width={screenWidth - 64}
            height={220}
            yAxisInterval={1} 
            fromZero={false}
            segments={4}
            withInnerLines={true}
            withOuterLines={false}
            withDots={true}
            chartConfig={{
              backgroundColor: "#fff",
              backgroundGradientFrom: "#fff",
              backgroundGradientTo: "#fff",
              fillShadowGradient: '#3B82F6',
              fillShadowGradientOpacity: 0.1,
              decimalPlaces: 0, 
              color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: { r: "4", strokeWidth: "2", stroke: "#3B82F6" }
            }}
            bezier
            style={{ marginTop: 20, borderRadius: 16, alignItems:'center', marginLeft:-20 }}
          />
        </View>

        {/* --- ADIM KARTI --- */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
               <Icon name="walk" size={24} color="#3B82F6" style={{marginRight: 8}}/>
               <Text style={styles.cardTitle}>Günlük Aktivite</Text>
            </View>
            <Text style={styles.stepGoalText}>{steps.toLocaleString()} / {STEP_GOAL.toLocaleString()} Adım</Text>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          
          <Text style={styles.statusSubtitle}>
            Şu anki durum: <Text style={{fontWeight:'bold', color: status === 'Normal' ? '#111827' : '#EF4444'}}>{status}</Text>
          </Text>
        </View>

        {/* SOS Butonu */}
        <TouchableOpacity style={styles.sosContainer} onPress={handleSOS}>
          <View style={styles.sosButtonOuter}>
            <View style={styles.sosButtonInner}>
                <Text style={styles.sosTextLabel}>SOS</Text>
                <Text style={styles.sosSubText}>Acil Yardım</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* --- DÜŞME ALARMI MODALI (YENİ EKLENDİ) --- */}
        <Modal visible={isFallDetected} transparent={true} animationType="slide">
            <View style={styles.modalOverlay}>
                <View style={styles.alertBox}>
                    <Icon name="alert-octagram" size={80} color="#EF4444" />
                    <Text style={styles.alertTitle}>DÜŞME ALGILANDI!</Text>
                    <Text style={styles.alertDesc}>
                        Sensörlerimiz düşme veya baygınlık tespit etti.
                    </Text>
                    
                    <Text style={styles.countdownText}>{countdown}</Text>
                    <Text style={styles.countdownLabel}>saniye içinde yardım çağrılacak</Text>

                    <TouchableOpacity style={styles.cancelButton} onPress={cancelFallAlarm}>
                        <Text style={styles.cancelButtonText}>İYİYİM, İPTAL ET</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { alignItems: 'center', marginBottom: 16, marginTop: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,marginTop:-20 },
  statusText: { fontSize: 14, fontWeight: '600', marginLeft: 5 },
  
  card: { 
    backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 10, 
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: '#6B7280', fontSize: 16, fontWeight: '600' },
  subtitle: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  
  bpmContainer: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 0 },
  bpmValue: { fontSize: 48, fontWeight: 'bold', lineHeight: 50 },
  bpmUnit: { fontSize: 18, color: '#9CA3AF', marginBottom: 8, marginLeft: 8, fontWeight: '500' },

  stepGoalText: { fontWeight: 'bold', color: '#111827' },
  progressBarContainer: { height: 12, backgroundColor: '#E5E7EB', borderRadius: 6, marginTop: 1, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 6 },
  statusSubtitle: { color: '#6B7280', fontSize: 14, marginTop: 15 },

  sosContainer: { alignItems: 'center', marginTop: 0, marginBottom: 20 },
  sosButtonOuter: {
    width: 130, height: 130, borderRadius: 65, backgroundColor: '#FEE2E2', 
    justifyContent: 'center', alignItems: 'center', elevation: 10,
    shadowColor: '#EF4444', shadowOffset: {width:0, height:10}, shadowOpacity: 0.3, shadowRadius: 20
  },
  sosButtonInner: {
    width: 110, height: 110, borderRadius: 55, backgroundColor: '#EF4444', 
    justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#FECACA'
  },
  sosTextLabel: { color: '#fff', fontSize: 32, fontWeight: '900' },
  sosSubText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 2 },

  // --- MODAL STİLLERİ (EKSİKTİ, EKLENDİ) ---
  modalOverlay: { flex: 1, backgroundColor: 'rgba(220, 38, 38, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertBox: { backgroundColor: '#fff', width: '100%', borderRadius: 30, padding: 30, alignItems: 'center', elevation: 20 },
  alertTitle: { fontSize: 26, fontWeight: 'bold', color: '#DC2626', marginTop: 10 },
  alertDesc: { fontSize: 16, color: '#4B5563', textAlign: 'center', marginTop: 5, marginBottom: 20 },
  countdownText: { fontSize: 80, fontWeight: 'bold', color: '#DC2626' },
  countdownLabel: { fontSize: 16, color: '#6B7280', marginBottom: 30 },
  cancelButton: { backgroundColor: '#10B981', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 50, width: '100%', alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
});

export default PatientHomeScreen;