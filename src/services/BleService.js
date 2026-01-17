import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

class BleService {
  constructor() {
    this.manager = new BleManager();
    this.device = null;
    this.subscription = null;
    this.buffer = ""; 
    
    this.onHeartRateUpdate = null;
    this.onMotionUpdate = null;
    
    // Son okunan verileri saklayalım
    this.lastMotion = { x: 0, y: 0, z: 0, E: 0 };
  }

  // İzinler
  async requestPermissions() {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return (
        granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return true;
  }

  // Bağlanma
  scanAndConnect(deviceName, onConnected) {
    console.log("BLE: Cihaz aranıyor...");
    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log("BLE Tarama Hatası:", error);
        return;
      }

      if (device && (device.name === deviceName || device.localName === deviceName)) {
        console.log("BLE: Cihaz bulundu:", device.name);
        this.manager.stopDeviceScan();
        
        device.connect()
          .then(async (device) => {
            console.log('BLE: Bağlantı Kuruldu.');
            if (Platform.OS === 'android') {
                try {
                    const mtu = await device.requestMTU(512);
                    console.log(`✅ BLE: MTU Artırıldı: ${mtu}`);
                } catch (e) { }
            }
            return device.discoverAllServicesAndCharacteristics();
          })
          .then((device) => {
            console.log("BLE: Veri akışı başlatılıyor...");
            this.device = device;
            onConnected(device);
            this.monitorData(device);
          })
          .catch((error) => {
            console.log('BLE Bağlantı Hatası:', error);
          });
      }
    });
  }

  // Veri Dinleme
  monitorData(device) {
    const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"; 
    const CHARACTERISTIC_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

    this.subscription = device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          // Logları minimize ettik
          // console.log('BLE Okuma Hatası:', error.message);
          return;
        }
        if (characteristic && characteristic.value) {
            this.handleData(characteristic.value);
        }
      }
    );
  }

  // Veri İşleme
  handleData(base64Value) {
    try {
        const decodedString = this.decodeBase64(base64Value);
        this.buffer += decodedString;
        
        const parts = this.buffer.split(/[|\r\n]+/);

        if (this.buffer.length > 2000) this.buffer = "";
        else this.buffer = parts.pop() || "";

        for (const part of parts) {
            const cleanLine = part.trim();
            if (cleanLine.length > 0) {
                this.parseLine(cleanLine);
            }
        }
    } catch (e) {
        // Hata logunu kaldırdık (production için)
    }
  }

  // --- PARSING KISMI ---
  parseLine(line) {
    // 1. Nabız (P)
    if (line.includes('P:')) {
        const match = line.match(/P:(\d+)/);
        if (match && match[1]) {
            const heartRate = parseInt(match[1], 10);
            if (!isNaN(heartRate) && this.onHeartRateUpdate) {
                this.onHeartRateUpdate(heartRate);
            }
        }
    }

    // 2. Hareket (A)
    if (line.includes('A:')) {
        try {
            // "A:1030,-1304,16102"
            const dataStr = line.split('A:')[1].split('|')[0].trim(); 
            const values = dataStr.split(',').map(v => parseFloat(v));

            if (values.length >= 3) {
                this.lastMotion.x = values[0];
                this.lastMotion.y = values[1];
                this.lastMotion.z = values[2];
                
                // UI güncellemesi
                if (this.onMotionUpdate) {
                    this.onMotionUpdate(this.lastMotion);
                }
            }
        } catch (err) { }
    }

    // 3. Acil Durum (E)
    if (line.includes('E:')) {
        try {
            const match = line.match(/E:(\d+)/);
            if (match && match[1]) {
                const eVal = parseInt(match[1], 10);
                this.lastMotion.E = eVal;

                if (this.onMotionUpdate) {
                    this.onMotionUpdate(this.lastMotion);
                }
            }
        } catch (err) { }
    }
  }

  setDataListeners(onHeartRate, onMotion) {
    this.onHeartRateUpdate = onHeartRate;
    this.onMotionUpdate = onMotion;
  }

  disconnect() {
    if (this.subscription) this.subscription.remove();
    if (this.device) {
        this.device.cancelConnection().catch(() => {});
    }
  }

  decodeBase64(str) {
    if (typeof atob === 'function') return atob(str);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    str = String(str).replace(/=+$/, '');
    for (let bc = 0, bs = 0, buffer, i = 0;
        buffer = str.charAt(i++);
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
        bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
        buffer = chars.indexOf(buffer);
    }
    return output;
  }
}

export default new BleService();