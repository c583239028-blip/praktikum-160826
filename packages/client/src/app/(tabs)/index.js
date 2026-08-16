import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import FeedScreen from '../../screens/FeedScreen';
import ModeratorScreen from '../../screens/ModeratorScreen';
  import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import DevPreviewScreen from '../../screens/DevPreviewScreen'

export default function HomeScreen() {
  // const { isLoading } = useAuth();

  // if (isLoading) {
  //   return (
  //     <View
  //       style={{
  //         flex: 1,
  //         backgroundColor: '#1a1a1a',
  //         justifyContent: 'center',
  //         alignItems: 'center',
  //       }}
  //     >
  //       <ActivityIndicator color="#06b6d4" />
  //     </View>
  //   );
  // }

  // Home is the entry point for everyone (SPEC §3). Guests and authenticated
  // users both land on the feed; FeedScreen gates stream entry / protected
  // actions behind useAuthGuard (Lazy Auth). Role-based routing happens at the
  // LIVE/in-game entry (game_screen.js), not on the landing screen.
  // return <FeedScreen />;
return <DevPreviewScreen/>

}
