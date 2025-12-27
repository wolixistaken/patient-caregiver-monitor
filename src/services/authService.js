// src/services/authService.js
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export const authService = {

  // 1. KAYIT OLMA (REGISTER)
  register: async (email, password, name, role) => {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      await firestore().collection('Users').doc(uid).set({
        email: email,
        name: name,
        role: role,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      if (role === 'patient') {
        await firestore().collection('Patients').add({
          uid: uid,
          caregiverId: null,
          name: name,
          age: 0,
          statusText: 'Durum stabil',
          avatar: 'https://randomuser.me/api/portraits/lego/1.jpg',
          thresholds: { minHeartRate: 50, maxHeartRate: 120 },
          emergencyContacts: []
        });
      }

      return { success: true, user: { email, role, uid } };

    } catch (error) {
      console.error("Kayıt Hatası:", error);
      let msg = 'Kayıt başarısız.';
      if (error.code === 'auth/email-already-in-use') msg = 'Bu e-posta zaten kullanımda.';
      if (error.code === 'auth/weak-password') msg = 'Şifre çok zayıf (en az 6 karakter).';
      if (error.code === 'auth/invalid-email') msg = 'Geçersiz e-posta adresi.';
      return { success: false, message: msg };
    }
  },

  // 2. GİRİŞ YAPMA (LOGIN)
  login: async (email, password) => {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      const userDoc = await firestore().collection('Users').doc(uid).get();

      if (userDoc.exists) {
        return { success: true, user: { ...userDoc.data(), uid } };
      } else {
        return { success: false, message: 'Kullanıcı verisi bulunamadı.' };
      }
    } catch (error) {
      console.error("Giriş Hatası:", error);
      return { success: false, message: 'Giriş yapılamadı. Bilgileri kontrol edin.' };
    }
  },

  // 3. BAKICI İÇİN HASTALARI LİSTELE
  getPatientsForCaregiver: async (caregiverUid) => {
    try {
      const snapshot = await firestore()
        .collection('Patients')
        .where('caregiverId', '==', caregiverUid)
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  // 4. TEK HASTA VERİSİNİ ÇEK (UID İLE)
  getPatientData: async (patientUid) => {
    try {
      const snapshot = await firestore()
        .collection('Patients')
        .where('uid', '==', patientUid)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  // 5. KİŞİ EKLEME (UID İLE)
  addContact: async (patientUid, newContact) => {
    try {
      const snapshot = await firestore().collection('Patients').where('uid', '==', patientUid).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const currentContacts = doc.data().emergencyContacts || [];

        await firestore().collection('Patients').doc(doc.id).update({
          emergencyContacts: [...currentContacts, newContact]
        });

        return { success: true, contacts: [...currentContacts, newContact] };
      }
      return { success: false, message: 'Hasta profili bulunamadı' };
    } catch (error) {
      console.error("Kişi Ekleme Hatası:", error);
      return { success: false };
    }
  },

  // 6. KİŞİ SİLME (UID İLE)
  removeContact: async (patientUid, contactId) => {
    try {
      const snapshot = await firestore().collection('Patients').where('uid', '==', patientUid).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const currentContacts = doc.data().emergencyContacts || [];
        const updatedContacts = currentContacts.filter(c => c.id !== contactId);

        await firestore().collection('Patients').doc(doc.id).update({
          emergencyContacts: updatedContacts
        });

        return { success: true, contacts: updatedContacts };
      }
      return { success: false };
    } catch (error) {
      console.error(error);
      return { success: false };
    }
  },

  // 7. EŞİK DEĞERLERİNİ GÜNCELLEME (UID İLE)
  updateThresholds: async (patientUid, min, max) => {
    try {
      const snapshot = await firestore().collection('Patients').where('uid', '==', patientUid).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        await firestore().collection('Patients').doc(doc.id).update({
          thresholds: {
            minHeartRate: parseInt(min),
            maxHeartRate: parseInt(max)
          }
        });
        return { success: true };
      }
      return { success: false, message: 'Hasta bulunamadı' };
    } catch (error) {
      console.error(error);
      return { success: false };
    }
  },

  // ---------------------------------------------------------
  // 8. HASTA EŞLEŞTİRME (YENİ EKLENDİ)
  // ---------------------------------------------------------
  assignPatientToCaregiver: async (caregiverUid, patientEmail) => {
    try {
      // 1. Users tablosunda bu maile sahip bir 'patient' var mı?
      const userSnap = await firestore()
        .collection('Users')
        .where('email', '==', patientEmail)
        .where('role', '==', 'patient')
        .limit(1)
        .get();

      if (userSnap.empty) {
        return { success: false, message: 'Bu e-posta adresine kayıtlı bir hasta bulunamadı.' };
      }

      const patientUserDoc = userSnap.docs[0];
      const patientUid = patientUserDoc.id;

      // 2. Patients tablosunda bu UID'ye sahip dökümanı bul ve caregiverId güncelle
      const patientSnap = await firestore()
        .collection('Patients')
        .where('uid', '==', patientUid)
        .limit(1)
        .get();

      if (patientSnap.empty) {
        return { success: false, message: 'Hasta profili oluşturulmamış.' };
      }

      const patientDocId = patientSnap.docs[0].id;

      await firestore().collection('Patients').doc(patientDocId).update({
        caregiverId: caregiverUid
      });

      return { success: true, message: 'Hasta başarıyla eklendi.' };

    } catch (error) {
      console.error("Hasta Ekleme Hatası:", error);
      return { success: false, message: 'Bir hata oluştu.' };
    }
  },

  // ---------------------------------------------------------
  // 9. ACİL DURUM GEÇMİŞİ (YENİ EKLENDİ)
  // ---------------------------------------------------------
  getEmergencyHistory: async (patientUid) => {
    try {
      // İndeks hatasını önlemek için orderBy'ı sorgudan kaldırdık.
      const snapshot = await firestore()
        .collection('EmergencyAlerts')
        .where('patientUid', '==', patientUid)
        .get();

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sıralamayı burada (Client-side) yapıyoruz
      // Yeniden eskiye doğru (Büyük tarihten küçüğe)
      data.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return timeB - timeA;
      });

      return data;
    } catch (error) {
      console.error("Geçmiş Getirme Hatası Detayı:", error);
      return [];
    }
  }
};