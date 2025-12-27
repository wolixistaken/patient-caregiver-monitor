// src/services/BleService.js
import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

global.Buffer = global.Buffer || require('buffer').Buffer;

// UUID'LER (nRF Connect ile AYNI olmalı)
const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

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


  // src/services/BleService.js içindeki scanAndConnect fonksiyonunu bununla değiştir:

  async scanAndConnect(onDataReceived, onError, onConnected) {
    // 1. Bluetooth Kapalıysa Açmayı Dene
    try {
      const state = await this.manager.state();
      if (state === 'PoweredOff') {
        console.log("⚠️ Bluetooth kapalı, açılıyor...");
        await this.manager.enable();
      }
    } catch (e) {
      console.log("Bluetooth açma izni yok veya hata:", e);
    }

    console.log("🔍 [BLE] Etraftaki TÜM cihazlar taranıyor...");

    // 2. Taramayı Başlat
    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log("❌ [BLE] Tarama Hatası:", error);
        if (onError) onError(error);
        return;
      }

      // --- YENİ EKLENEN KISIM: HER ŞEYİ YAZDIR ---
      // device.name bazen null olabilir, o yüzden 'İsimsiz' yazdıyoruz.
      if (device) {
        console.log(`📡 Cihaz: [${device.name || 'İsimsiz'}] - MacID: ${device.id} - RSSI: ${device.rssi}`);
      }
      // -------------------------------------------

      // Bizim sensörü bulursa bağlan
      if (device && (device.name === 'cdtp' || device.localName === 'cdtp')) {
        console.log("✅ HEDEF BULUNDU! Bağlanılıyor...");

        this.manager.stopDeviceScan(); // Taramayı durdur

        device.connect()
          .then((device) => {
            device.requestMTU(512) // 512 byte'a kadar izin iste
              .then((device) => {
                console.log("MTU artırıldı");
              })
              .catch((error) => {
                console.log("MTU hatası");
              });
            console.log("🔗 Bağlantı kuruldu. Servisler okunuyor...");
            return device.discoverAllServicesAndCharacteristics();
          })
          .then(async (device) => {
            this.device = device;

            // Bağlantı başarılı sinyali
            if (onConnected) onConnected();

            // İlk veriyi zorla oku
            try {
              // UUID'leri sınıfın tepesinden alıyor
              const characteristic = await device.readCharacteristicForService(SERVICE_UUID, CHAR_UUID);
              if (characteristic?.value) {
                const initialData = Buffer.from(characteristic.value, 'base64').toString('ascii');
                console.log("⚡ İlk Veri:", initialData);
                onDataReceived(initialData);
              }
            } catch (e) {
              console.log("İlk okuma atlandı, monitor bekleniyor.");
            }

            // Sürekli dinle
            this.monitorData(device, onDataReceived);
          })
          .catch((err) => {
            console.log("Bağlantı koptu veya hata:", err);
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
      this.device.cancelConnection().catch(() => { });
      this.device = null;
    }
    this.manager.stopDeviceScan();
  }
}

export default new BleService();