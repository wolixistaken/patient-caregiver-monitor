# Patient–Caregiver Monitor (ÇDTP)

A cross-platform **React Native** mobile app that connects **patients** and their
**caregivers**. A patient's wearable device streams data over **Bluetooth LE**; the
app visualizes it, lets caregivers monitor their patients remotely, and triggers
**emergency SMS alerts** when needed.

> Turkish project name: *ÇDTP – hasta-bakıcı projesi mobil uygulaması*

## ✨ Features

**Authentication**
- Email/password login & sign-up backed by Firebase Auth

**Patient role**
- Home dashboard with live readings from the connected wearable
- Manage assigned caregivers
- Configure emergency contacts for automatic SMS alerts

**Caregiver role**
- Dashboard listing the patients being monitored
- Per-patient detail view with vitals and history

**Core capabilities**
- 🔵 Bluetooth LE wearable integration (`react-native-ble-plx`)
- 🚨 Emergency SMS notifications (`react-native-direct-sms`)
- 📊 Health-data charts (`react-native-chart-kit`)
- ☁️ Firebase backend — Auth, Firestore, Storage

## 🛠️ Tech Stack

`React Native 0.82` · `React Navigation (stack + bottom tabs)` · `Firebase (@react-native-firebase)` · `react-native-ble-plx` · `react-native-direct-sms` · `react-native-chart-kit` · `AsyncStorage`

## 📁 Project Structure

```
src/
├── navigation/
│   ├── PatientTabs.js          # Bottom-tab navigator for the patient role
│   └── CaregiverTabs.js        # Bottom-tab navigator for the caregiver role
├── screens/
│   ├── LoginScreen.js
│   ├── SignUpScreen.js
│   ├── patient/
│   │   ├── PatientHomeScreen.js
│   │   ├── CaregiverManagementScreen.js
│   │   └── EmergencyContactScreen.js
│   └── caregiver/
│       ├── CaregiverHomeScreen.js
│       └── PatientDetailScreen.js
├── services/
│   ├── BleService.js           # Bluetooth LE connection & data handling
│   └── authService.js          # Firebase authentication
└── utils/
    └── SmsHelper.js            # Emergency SMS helper
```

## 🚀 Getting Started

> Complete the [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment) first.

```sh
# 1) Install dependencies
npm install

# iOS only: install CocoaPods deps
bundle install && bundle exec pod install

# 2) Start Metro
npm start

# 3) Run the app (in a second terminal)
npm run android   # Android
npm run ios       # iOS
```

### Firebase configuration

This app requires a Firebase project. Add your own config files (these are **not**
committed):

- Android: `android/app/google-services.json`
- iOS: `ios/<App>/GoogleService-Info.plist`

Enable **Authentication**, **Firestore**, and **Storage** in the Firebase console.

## 📝 Notes

- BLE and SMS features require a physical device and the relevant runtime
  permissions (Bluetooth, Location, SMS) granted on Android.
- Developed as a university term project.
