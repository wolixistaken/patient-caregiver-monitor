// src/screens/patient/PatientHomeScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, StatusBar 
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
  
  // GEÇMİŞ VERİLER (Son 5 dakika - Sabitlenmiş)
  const [historyData, setHistoryData] = useState([70, 72, 71, 73, 72]); 
  
  // ŞİMDİKİ DAKİKA (Canlı değişen son nokta)
  const [currentMinuteAvg, setCurrentMinuteAvg] = useState(72);

  const [patientData, setPatientData] = useState(null);
  const [lastAlertTime, setLastAlertTime] = useState(0);

  // Veri Havuzu
  const minuteBuffer = useRef([]); 

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
        const data = await authService.getPatientData(currentUser.uid);
        if (data) setPatientData(data);
    }
  };

  useEffect(() => {
    const initBluetooth = async () => {
      const permission = await BleService.requestPermissions();
      if (permission) {
        BleService.scanAndConnect(
          (data) => handleSensorData(data),
          (error) => console.log("BLE Hatası:", error)
        );
      }
    };
    initBluetooth();
    // Sayfa kapanırsa bağlantıyı kes
    return () => BleService.disconnect();
  }, [patientData]);

  const handleSensorData = (rawData) => {
    setIsConnected(true);
    try {
      const parts = rawData.split(',');
      let currentHr = heartRate;
      let fall = false;

      parts.forEach(part => {
        if (part.includes('HR:')) {
            currentHr = parseInt(part.split(':')[1]);
            setHeartRate(currentHr);
            processChartData(currentHr); // <-- Grafik işlemini çağır
        }
        if (part.includes('STEPS:')) setSteps(parseInt(part.split(':')[1]));
        if (part.includes('F:1')) {
            fall = true;
            setStatus('DÜŞME TESPİT EDİLDİ!');
        } else if (part.includes('F:0')) {
             if (currentHr > (patientData?.thresholds?.maxHeartRate || 120)) setStatus('Yüksek Nabız');
             else if (currentHr < (patientData?.thresholds?.minHeartRate || 50) && currentHr > 0) setStatus('Düşük Nabız');
             else setStatus('Normal');
        }
      });

      checkAndSendAutoSMS(currentHr, fall);

    } catch (e) {
      console.log("Parse Hatası", e);
    }
  };

  const processChartData = (hrValue) => {
    // 1. Gelen veriyi havuza ekle
    minuteBuffer.current.push(hrValue);

    // 2. CANLI HESAPLAMA: Havuzdaki verilerin o anki ortalamasını al
    const sum = minuteBuffer.current.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / minuteBuffer.current.length);
    
    // 3. Son noktayı (Şimdi) anlık olarak güncelle
    setCurrentMinuteAvg(avg);

    // 4. DAKİKA DOLDU MU? (60 veri = 60 saniye)
    if (minuteBuffer.current.length >= 60) {
        console.log("Dakika tamamlandı. Geçmişe atılıyor:", avg);
        
        // Geçmiş verileri kaydır, yeni hesaplanan dakikayı sona ekle
        setHistoryData(prev => [...prev.slice(1), avg]);
        
        // Havuzu sıfırla
        minuteBuffer.current = [];
        // Yeni dakika başlangıç değeri olarak son değeri ata ki grafik çakılmasın
        setCurrentMinuteAvg(hrValue); 
    }
  };

  const checkAndSendAutoSMS = (currentHr, isFall) => {
    if (!patientData || !patientData.emergencyContacts || patientData.emergencyContacts.length === 0) return;
    const { minHeartRate, maxHeartRate } = patientData.thresholds || { minHeartRate: 50, maxHeartRate: 120 };
    const now = Date.now();
    if (now - lastAlertTime < 60000) return; 

    let message = '';
    let shouldSend = false;

    if (isFall) {
        message = `⚠️ ACİL DURUM: Düşme Algılandı! Nabız: ${currentHr}.`;
        shouldSend = true;
    } 
    else if (currentHr > maxHeartRate) {
        message = `⚠️ UYARI: Yüksek Nabız (${currentHr} BPM)! Sınır: ${maxHeartRate}.`;
        shouldSend = true;
    } 
    else if (currentHr < minHeartRate && currentHr > 10) {
        message = `⚠️ UYARI: Düşük Nabız (${currentHr} BPM)! Sınır: ${minHeartRate}.`;
        shouldSend = true;
    }

    if (shouldSend) {
      patientData.emergencyContacts.forEach(contact => {
          sendEmergencySms(contact.phone, message);
      });
      setLastAlertTime(now);
      Alert.alert("GÜVENLİK UYARISI", `Riskli durum! Bakıcınıza mesaj gönderildi.`);
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

  // GRAFİK VERİSİ BİRLEŞTİRME: Geçmiş 5 veri + Şu anki canlı veri
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
                { 
                  // 1. GERÇEK VERİ SETİ
                  data: combinedChartData 
                },
                {
                  // 2. GÖRÜNMEZ SABİTLEYİCİ VERİ SETİ (Y-Ekseni Kilitlemek İçin)
                  // Bu veriler 50 ve 130 olarak ayarlandı ki nabız 80'i geçerse grafik bozulmasın
                  // Amaç: Grafiğin yüksekliğini 50-130 arasına sabitlemek.
                  data: [50, 90], 
                  color: () => 'transparent', 
                  strokeWidth: 0,
                  withDots: false,
                }
              ]
            }}
            
            width={screenWidth - 64} // Ekran genişliğinden paddingleri çıkar
            height={220}
            yAxisInterval={1} 
            fromZero={false}
            segments={4} // 50, 70, 90, 110, 130 şeklinde aralıklar oluşturur
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
            style={{ marginTop: 20, borderRadius: 16,alignItems:'center', marginLeft:-20 }}
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
  sosSubText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginTop: 2 }
});

export default PatientHomeScreen;