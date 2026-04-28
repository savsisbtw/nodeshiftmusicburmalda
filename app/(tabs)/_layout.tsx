import { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Tabs, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { Colors, TAB_BAR_HEIGHT } from '../../constants/theme';
import { useAuth, usePlayer } from '../../store';
import MiniPlayer from '../../components/MiniPlayer';
import Player from '../../components/Player';

export default function TabsLayout() {
  const { user, ready } = useAuth();
  const { expanded }    = usePlayer();

  useEffect(() => {
    if (ready && !user) {
      router.replace('/auth');
    }
  }, [user, ready]);

  if (!ready) return (
    <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#1db954" />
    </View>
  );
  if (!user) return null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarBackground: () => (
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          ),
          tabBarActiveTintColor:   Colors.green,
          tabBarInactiveTintColor: Colors.text3,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
          tabBarItemStyle:  { paddingTop: 8 },
        }}
      >
        <Tabs.Screen name="index"   options={{ title: 'Главная',    tabBarIcon: ({ color }) => <HomeIcon color={color} /> }} />
        <Tabs.Screen name="library" options={{ title: 'Библиотека', tabBarIcon: ({ color }) => <LibIcon color={color} /> }} />
        <Tabs.Screen name="search"  options={{ title: 'Поиск',      tabBarIcon: ({ color }) => <SearchIcon color={color} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Профиль',    tabBarIcon: ({ color }) => <ProfileIcon color={color} /> }} />
      </Tabs>

      <MiniPlayer />
      {expanded && <Player />}
    </View>
  );
}

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="9,22 9,12 15,12 15,22" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LibIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18V5l12-2v13" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={6} cy={18} r={3} stroke={color} strokeWidth={1.8} />
      <Circle cx={18} cy={16} r={3} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={8} stroke={color} strokeWidth={1.8} />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Circle cx={12} cy={7} r={4} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position:        'absolute',
    borderTopWidth:  0,
    backgroundColor: 'transparent',
    elevation:       0,
    height:          TAB_BAR_HEIGHT,
  },
});
