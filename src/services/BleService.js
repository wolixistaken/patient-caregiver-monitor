// src/services/BleService.js
import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

global.Buffer = global.Buffer || require('buffer').Buffer;

const SIMULATION_MODE = true; 

class BleService {
  constructor() {
    if (!SIMULATION_MODE) {
        this.manager = new BleManager();
    }
    this.device = null;
    this.simulationInterval = null;
  }

  async requestPermissions() {
    if (SIMULATION_MODE) return true;
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return granted;
    }
    return true;
  }

  scanAndConnect(onDataReceived, onError) {
    if (SIMULATION_MODE) {
        console.log("🔵 SİMÜLASYON MODU (1 Hz)");
        let hr = 70;
        let steps = 0;
        let isFall = 0;

        // TAM 1 SANİYEDE BİR VERİ GÖNDER
        this.simulationInterval = setInterval(() => {
            // Nabzı hafifçe değiştir
            const change = Math.random() > 0.5 ? 1 : -1;
            hr += change;
            
            // Sınırları koru (Simülasyon çok uçmasın)
            if (hr < 60) hr = 62;
            if (hr > 110) hr = 108;

            steps += 1; // Her saniye 1 adım
            
            const fakeData = `HR:${hr},STEPS:${steps},F:${isFall}`;
            onDataReceived(fakeData);

        }, 1000); // <-- 1000ms = 1 Saniye

        // 60. saniyede DÜŞME TESTİ (İstersen kapatabilirsin)
        setTimeout(() => {
             // onDataReceived(`HR:130,STEPS:${steps},F:1`); 
        }, 60000);

        return;
    }

    // ... (Gerçek Bluetooth kodları aynı kalıyor) ...
    this.manager.startDeviceScan(null, null, (error, device) => {
        if (error) { if(onError) onError(error); return; }
        if (device && (device.name === 'HealthBand' || device.name === 'GuvenlikSensoru')) {
            this.manager.stopDeviceScan();
            device.connect()
                .then((device) => device.discoverAllServicesAndCharacteristics())
                .then((device) => {
                    this.device = device;
                    this.monitorData(device, onDataReceived);
                })
                .catch((err) => { if(onError) onError(err); });
        }
    });
  }

  monitorData(device, onDataReceived) {
    const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"; 
    const CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"; 
    device.monitorCharacteristicForService(SERVICE_UUID, CHAR_UUID, (error, characteristic) => {
        if (error) return;
        const rawData = Buffer.from(characteristic.value, 'base64').toString('ascii');
        onDataReceived(rawData);
    });
  }

  disconnect() {
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    if (this.device) this.device.cancelConnection();
  }
}

export default new BleService();