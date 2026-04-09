import 'react-native-url-polyfill/auto';
import {AppRegistry} from 'react-native';
import notifee from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';
import {handleBackgroundEvent} from './src/services/notificationHandler';

notifee.onBackgroundEvent(handleBackgroundEvent);

AppRegistry.registerComponent(appName, () => App);
