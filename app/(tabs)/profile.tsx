import { useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Polyline } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Colors, Font, Spacing, Radius, TAB_BAR_HEIGHT, MINI_PLAYER_HEIGHT } from '../../constants/theme';
import { useAuth } from '../../store';
import { logout } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();

  const handleLogout = useCallback(() => {
    Alert.alert('Выход', 'Выйти из аккаунта?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти', style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
          router.replace('/auth');
        },
      },
    ]);
  }, []);

  if (!user) return null;

  const initials = (user.username || user.email).slice(0, 2).toUpperCase();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.md, paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Профиль</Text>

      <Animated.View entering={FadeIn.duration(500)} style={styles.avatarCard}>
        <LinearGradient colors={['#1e1e1e', '#141414']} style={styles.avatarCardGrad}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <Text style={styles.displayName}>{user.username || 'Пользователь'}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={[styles.planBadge, user.plan !== 'free' && styles.planBadgePro]}>
            <Text style={[styles.planText, user.plan !== 'free' && styles.planTextPro]}>
              {user.plan === 'free' ? 'Free' : 'Pro'}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
        <Text style={styles.sectionLabel}>Аккаунт</Text>
        <InfoRow label="Email"    value={user.email} />
        <InfoRow label="Никнейм" value={user.username || '—'} />
        <InfoRow label="Тариф"   value={user.plan === 'free' ? 'Бесплатный' : 'Pro'} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200)}>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={Colors.red} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            <Polyline points="16,17 21,12 16,7" stroke={Colors.red} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M21 12H9" stroke={Colors.red} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </Pressable>
      </Animated.View>

      <Animated.Text entering={FadeInDown.delay(300)} style={styles.version}>
        Burmalda Music · v1.0.0 · by NodeShift
      </Animated.Text>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll:            { flex: 1, backgroundColor: Colors.bg },
  content:           { paddingHorizontal: Spacing.md },
  pageTitle:         { color: Colors.text, fontSize: Font.xxl, fontWeight: '800', letterSpacing: -0.5, marginBottom: Spacing.lg },
  avatarCard:        { borderRadius: Radius.xl, overflow: 'hidden', marginBottom: Spacing.xl },
  avatarCardGrad:    { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  avatar:            { width: 88, height: 88, borderRadius: 44, marginBottom: Spacing.sm },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  avatarInitials:    { color: Colors.text, fontSize: Font.xxl, fontWeight: '800' },
  displayName:       { color: Colors.text, fontSize: Font.xl, fontWeight: '700' },
  email:             { color: Colors.text2, fontSize: Font.sm },
  planBadge:         { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.elevated, marginTop: 4 },
  planBadgePro:      { backgroundColor: Colors.accent + '22', borderWidth: 1, borderColor: Colors.accent + '44' },
  planText:          { color: Colors.text2, fontSize: Font.xs, fontWeight: '700' },
  planTextPro:       { color: Colors.accent },
  section:           { marginBottom: Spacing.lg },
  sectionLabel:      { color: Colors.text3, fontSize: Font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  infoRow:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  infoLabel:         { color: Colors.text2, fontSize: Font.md },
  infoValue:         { color: Colors.text, fontSize: Font.md, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },
  logoutBtn:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.lg },
  logoutText:        { color: Colors.red, fontSize: Font.md, fontWeight: '600' },
  version:           { color: Colors.text3, fontSize: Font.xs, textAlign: 'center' },
});
