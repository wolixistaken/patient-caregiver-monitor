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
  }

  // İzinler (Aynı)
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

  // Bağlanma (GÜNCELLENDİ: MTU İSTEĞİ EKLENDİ)
  scanAndConnect(deviceName, onConnected) {
    console.log("BLE: Cihaz aranıyor...");
    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log("BLE Tarama Hatası:", error);
        return;
      }

      if (device && (device.name === "cdtp" || device.localName === "cdtp")) {
        console.log("BLE: Cihaz bulundu:", device.name);
        this.manager.stopDeviceScan();
        
        device.connect()
          .then(async (device) => {
            console.log('BLE: Bağlantı Kuruldu.');

            // --- MTU ARTIRMA İŞLEMİ ---
            // iOS bunu otomatik yapar, Android için manuel istemek gerekir.
            if (Platform.OS === 'android') {
                try {
                    // 512 Byte isteyelim (Maksimum sınır)
                    const mtu = await device.requestMTU(512);
                    console.log(`✅ BLE: MTU Başarıyla Artırıldı: ${mtu} byte`);
                } catch (e) {
                    console.log("❌ BLE: MTU Artırma başarısız:", e);
                    // Başarısız olsa bile devam et, belki varsayılan yeterlidir.
                }
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
          console.log('BLE Okuma Hatası:', error.message);
          return;
        }
        if (characteristic && characteristic.value) {
            this.handleData(characteristic.value);
        }
      }
    );
  }

  // Veri İşleme (P ve A Kontrolü)
  handleData(base64Value) {
    try {
        const decodedString = this.decodeBase64(base64Value);
        
        // P verisini anında görelim
        if (decodedString.includes('P')) {
             console.log("📡 P GELDİ:", decodedString);
        }

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
        console.log("Parsing Hatası:", e);
    }
  }

  parseLine(line) {
    // Nabız (P)
    if (line.includes('P')) {
        const match = line.match(/P[:\s]?(\d+)/);
        if (match && match[1]) {
            const heartRate = parseInt(match[1], 10);
            console.log(`❤️ NABIZ GRAFİĞE GİDİYOR: ${heartRate}`); 
            if (!isNaN(heartRate) && this.onHeartRateUpdate) {
                this.onHeartRateUpdate(heartRate);
            }
        }
    }

    // Hareket (A)
    if (line.includes('A')) {
        try {
            const dataStr = line.substring(line.indexOf('A') + 1).replace(':', '').trim();
            const values = dataStr.split(',').map(v => parseFloat(v));

            if (values.length >= 3 && this.onMotionUpdate) {
                this.onMotionUpdate({
                    x: values[0],
                    y: values[1],
                    z: values[2],
                });
            }
        } catch (err) {}
    }
  }

  setDataListeners(onHeartRate, onMotion) {
    this.onHeartRateUpdate = onHeartRate;
    this.onMotionUpdate = onMotion;
  }

  disconnect() {
    if (this.subscription) {
      this.subscription.remove();
    }
    if (this.device) {
      this.device.cancelConnection();
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