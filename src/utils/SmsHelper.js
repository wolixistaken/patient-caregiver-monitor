// src/utils/SmsHelper.js
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import DirectSms from 'react-native-direct-sms';

export const sendEmergencySms = async (phoneNumber, message) => {
  // Sadece rakamları al
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');

  if (Platform.OS === 'android') {
    try {
      // 1. İzin Kontrolü Yap
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
        {
          title: "SMS Gönderme İzni",
          message: "Acil durumda otomatik mesaj atabilmek için SMS izni gerekiyor.",
          buttonNeutral: "Daha Sonra",
          buttonNegative: "İptal",
          buttonPositive: "Tamam"
        }
      );

      // 2. İzin Varsa Direkt Gönder
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        DirectSms.sendDirectSms(cleanPhone, message);
        console.log("✅ SMS Arka Planda Gönderildi!");
        Alert.alert("Bilgi", "Acil durum mesajı otomatik gönderildi.");
      } else {
        Alert.alert("Hata", "SMS izni verilmediği için gönderilemedi.");
      }
    } catch (err) {
      console.warn(err);
    }
  } else {
    // iOS için otomatik gönderim yasaktır, mecburen eski yöntemi kullanırız
    Alert.alert("Uyarı", "iOS'ta otomatik SMS desteklenmemektedir.");
  }
};