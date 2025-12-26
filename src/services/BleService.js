// src/services/BleService.js
import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

global.Buffer = global.Buffer || require('buffer').Buffer;

// UUID'LER (nRF Connect ile AYNI olmalı)
const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"; 
const CHAR_UUID    = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

class BleService {
  constructor() {
    this.manager = null;
    if (!this.manager) {
        this.manager = new BleManager();
    }
    this.device = null;
  }

  async requestPermissions() {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return true;
  }

  scanAndConnect(onDataReceived, onError, onConnected) {
    console.log("🔍 [BLE] Tarama Başlatıldı...");

    this.manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
            console.log("❌ [BLE] Tarama Hatası:", error);
            if (onError) onError(error);
            return;
        }

        if (device && (device.name === 'GuvenlikSensoru' || device.localName === 'GuvenlikSensoru')) {
            console.log("✅ [BLE] Sensör Bulundu! Bağlanılıyor...");
            this.manager.stopDeviceScan();

            device.connect()
                .then((device) => {
                    console.log("🔗 [BLE] Fiziksel Bağlantı Tamam. Servisler aranıyor...");
                    return device.discoverAllServicesAndCharacteristics();
                })
                .then(async (device) => {
                    this.device = device;
                    console.log("📂 [BLE] Servisler Hazır.");

                    // 1. BAĞLANTIYI ONAYLA (Ekran Yeşil Olsun)
                    if (onConnected) onConnected();

                    // 2. İLK VERİYİ ZORLA OKU (Force Read)
                    // Notify beklemeden, o anki değeri hemen alalım
                    try {
                        const characteristic = await device.readCharacteristicForService(SERVICE_UUID, CHAR_UUID);
                        if (characteristic?.value) {
                            const initialData = Buffer.from(characteristic.value, 'base64').toString('ascii');
                            console.log("⚡ [BLE] İlk Zorla Okuma Başarılı:", initialData);
                            onDataReceived(initialData);
                        }
                    } catch (readError) {
                        console.log("⚠️ [BLE] İlk okuma yapılamadı (Notify beklenecek):", readError.message);
                    }

                    // 3. DİNLEMEYİ BAŞLAT (Monitor)
                    this.monitorData(device, onDataReceived);
                })
                .catch((err) => {
                    console.log("💥 [BLE] Bağlantı Hatası:", err);
                    if (onError) onError(err);
                });
        }
    });
  }

  monitorData(device, onDataReceived) {
    console.log("🎧 [BLE] Monitor (Notify) Başlatılıyor...");
    
    // transactionId ekledik ki çakışma olmasın
    device.monitorCharacteristicForService(SERVICE_UUID, CHAR_UUID, (error, characteristic) => {
        if (error) {
            console.log("❌ [BLE] Monitor Hatası:", error.message);
            // Eğer "Notify not enabled" hatası alırsan nRF Connect ayarlarını kontrol etmen gerekir.
            return;
        }
        
        if (characteristic?.value) {
            try {
                const rawData = Buffer.from(characteristic.value, 'base64').toString('ascii');
                console.log("📥 [BLE] Gelen Veri (Notify):", rawData);
                onDataReceived(rawData);
            } catch (e) {
                console.log("Parse Hatası:", e);
            }
        }
    }, 'monitor_transaction');
  }

  disconnect() {
    if (this.device) {
        console.log("🔌 [BLE] Bağlantı kapatılıyor...");
        this.manager.cancelTransaction('monitor_transaction'); // Monitor'ü durdur
        this.device.cancelConnection().catch(() => {});
        this.device = null;
    }
    this.manager.stopDeviceScan();
  }
}

export default new BleService();