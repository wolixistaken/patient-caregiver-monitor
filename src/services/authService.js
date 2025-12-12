// src/services/authService.js
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

export const authService = {
  
  // ---------------------------------------------------------
  // 1. KAYIT OLMA (REGISTER)
  // ---------------------------------------------------------
  register: async (email, password, name, role) => {
    try {
      // A. Firebase Authentication ile kullanıcı oluştur
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      // B. 'Users' koleksiyonuna genel bilgileri kaydet
      await firestore().collection('Users').doc(uid).set({
        email: email,
        name: name,
        role: role, // 'patient' veya 'caregiver'
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // C. Eğer kullanıcı HASTA ise, 'Patients' koleksiyonunda da veri kartı oluştur
      if (role === 'patient') {
        await firestore().collection('Patients').add({
            uid: uid,             // Bu ID ile eşleştirme yapacağız
            caregiverId: null,    // İleride eşleştirme yapılınca burası dolacak
            name: name,
            age: 0,               // Profil düzenlemede güncellenebilir
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

  // ---------------------------------------------------------
  // 2. GİRİŞ YAPMA (LOGIN)
  // ---------------------------------------------------------
  login: async (email, password) => {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      const uid = userCredential.user.uid;

      // Rolü öğrenmek için Users tablosuna bak
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

  // ---------------------------------------------------------
  // 3. BAKICI İÇİN HASTALARI LİSTELE
  // ---------------------------------------------------------
  getPatientsForCaregiver: async (caregiverUid) => {
    try {
      // caregiverId alanı, giriş yapan bakıcının UID'sine eşit olanları getir
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

  // ---------------------------------------------------------
  // 4. TEK HASTA VERİSİNİ ÇEK (UID İLE)
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // 5. KİŞİ EKLEME (UID İLE)
  // ---------------------------------------------------------
  addContact: async (patientUid, newContact) => {
    try {
      // Hangi hastaya ekleneceğini UID ile bul
      const snapshot = await firestore().collection('Patients').where('uid', '==', patientUid).get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const currentContacts = doc.data().emergencyContacts || [];
        
        // Firestore güncelle
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

  // ---------------------------------------------------------
  // 6. KİŞİ SİLME (UID İLE)
  // ---------------------------------------------------------
  removeContact: async (patientUid, contactId) => {
    try {
        const snapshot = await firestore().collection('Patients').where('uid', '==', patientUid).get();
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const currentContacts = doc.data().emergencyContacts || [];
            
            // ID'si eşleşmeyenleri tut (eşleşeni sil)
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

  // ---------------------------------------------------------
  // 7. EŞİK DEĞERLERİNİ GÜNCELLEME (UID İLE)
  // ---------------------------------------------------------
  // Not: Bu fonksiyonu Bakıcı çağırır ama değiştireceği hastanın UID'sini parametre olarak gönderir.
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
  }
};