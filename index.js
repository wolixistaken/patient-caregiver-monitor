/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { Buffer } from 'buffer';

AppRegistry.registerComponent(appName, () => App);
global.Buffer = global.Buffer || Buffer;

AppRegistry.registerComponent(appName, () => App);
