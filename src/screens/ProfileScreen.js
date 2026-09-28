import React, { useEffect, useState } from 'react';
import { Platform, View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, createThemedStyles, LAYOUT, TYPOGRAPHY, WEB_FOCUS } from '../utils/constants';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Button from '../components/Button';
import IconButton from '../components/IconButton';
import { LotusMark } from '../components/BrandMark';
import { preferredDisplayName } from '../utils/displayName';
import appConfig from '../../app.json';
import { useProductTour } from '../components/productTour';
import ProductTourTarget from '../components/productTour/ProductTourTarget';

function ProfileMenuRow({
  icon,
  title,
  subtitle,
  onPress,
  last = false,
  tone = 'default',
  disabled = false,
  busy = false,
  expanded,
  accessory = 'forward',
}) {
  const destructive = tone === 'danger';
  const accessoryIcon = accessory === 'expand'
    ? (expanded ? 'chevron-up' : 'chevron-down')
    : 'chevron-forward';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole='button'
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{
        disabled,
        busy,
        ...(typeof expanded === 'boolean' ? { expanded } : {}),
      }}
      style={({ pressed, hovered, focused }) => [
        styles.menuItem,
        !last && styles.menuItemBorder,
        hovered && !disabled && styles.menuItemHovered,
        focused && styles.menuItemFocused,
        pressed && !disabled && styles.menuItemPressed,
        disabled && styles.disabledItem,
      ]}
    >
      <View style={[styles.menuIcon, destructive && styles.menuIconDanger]} accessible={false}>
        <Icon name={icon} size={21} color={destructive ? COLORS.danger : COLORS.body} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuTitle, destructive && styles.menuTitleDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
      </View>
      {accessory !== 'none' ? (
        <View accessible={false}>
          <Icon name={accessoryIcon} size={19} color={destructive ? COLORS.danger : COLORS.muted} />
        </View>
      ) : null}
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }) {
  const { state, resetAllData, deleteAllAccountData } = useApp();
  const { logOut, deleteAccount } = useAuth();
  const { startIfNeeded } = useProductTour();
  useEffect(() => { startIfNeeded('profile'); }, [startIfNeeded]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [deletingData, setDeletingData] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showAccountDeleteConfirm, setShowAccountDeleteConfirm] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountDeleteError, setAccountDeleteError] = useState('');
  const trackingMode = state.settings?.trackingMode || state.profile?.trackingMode || 'cycle';
  const modeLabel = trackingMode === 'pcos' ? 'PCOS support' : 'Cycle tracking';
  const displayName = preferredDisplayName(state.profile) || 'Your Bloom';
  const isDevelopment = typeof __DEV__ !== 'undefined' && __DEV__;

  const menuSections = [
    {
      title: 'My Bloom',
      tourTargetIds: ['profile-preferences', 'profile-appearance'],
      items: [
        { icon: 'options-outline', title: 'My preferences', subtitle: 'Name, goals, tracking and appearance', route: 'Preferences' },
        { icon: 'notifications-outline', title: 'Reminders', subtitle: 'Choose what Bloom reminds you about', route: 'Reminders' },
      ],
    },
    {
      title: 'Privacy & data',
      tourTargetIds: ['profile-privacy'],
      items: [
        { icon: 'shield-checkmark-outline', title: 'Privacy', subtitle: 'App lock, previews and privacy controls', route: 'PrivacySettings' },
        { icon: 'download-outline', title: 'Export my data', subtitle: 'Save a copy of your Bloom information', route: 'ExportData' },
        { icon: 'medkit-outline', title: 'Doctor summary', subtitle: 'Review a private summary for appointments', route: 'DoctorReport' },
        { icon: 'trash-outline', title: 'Delete tracked data', subtitle: 'Erase your records but keep your account', action: openDeleteDataConfirm, tone: 'danger', expanded: showDeleteConfirm, accessory: 'expand' },
      ],
    },
    {
      title: 'Help & legal',
      items: [
        { icon: 'sparkles-outline', title: 'Learn Bloom', subtitle: 'Replay Bloom’s optional guides', route: 'LearnBloom' },
        { icon: 'chatbubbles-outline', title: 'Help & support', subtitle: 'Get help using Bloom', route: 'Legal', params: { page: 'support' } },
        { icon: 'document-text-outline', title: 'Privacy Policy', route: 'Legal', params: { page: 'privacy' } },
        { icon: 'document-text-outline', title: 'Terms of Use', route: 'Legal', params: { page: 'terms' } },
      ],
    },
  ];

  function openDeleteDataConfirm() {
    setDeleteError('');
    setShowAccountDeleteConfirm(false);
    setAccountPassword('');
    setAccountDeleteError('');
    setShowDeleteConfirm(true);
  }

  function openAccountDeleteConfirm() {
    setShowDeleteConfirm(false);
    setDeleteError('');
    setAccountDeleteError('');
    setShowAccountDeleteConfirm(true);
  }

  async function handleDeleteData() {
    if (deletingData) return;
    setDeletingData(true);
    setDeleteError('');
    try {
      await resetAllData();
      setShowDeleteConfirm(false);
    } catch (error) {
      setDeleteError('Bloom could not delete your tracked data. Please try again.');
    } finally {
      setDeletingData(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError('');
    try {
      await logOut();
    } catch (error) {
      setLogoutError('Bloom could not log out right now. Please try again.');
      setLoggingOut(false);
    }
  }

  async function handleDeleteAccount() {
    if (deletingAccount) return;
    if (!accountPassword) {
      setAccountDeleteError('Enter your password to confirm account deletion.');
      return;
    }
    setDeletingAccount(true);
    setAccountDeleteError('');
    try {
      await deleteAccount({
        password: accountPassword,
        beforeDelete: deleteAllAccountData,
      });
    } catch (error) {
      setAccountDeleteError(error?.message || 'Bloom could not delete your account. Please try again.');
      setDeletingAccount(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.backBar}>
        <IconButton icon='chevron-back' accessibilityLabel='Back to Bloom' onPress={() => navigation.goBack()} />
        <View style={styles.backSpacer} />
      </View>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={Platform.OS === 'web'}
      >
        <View style={styles.inner}>
          <ScreenHeader title='Profile' subtitle='Your preferences, privacy and support in one place.' />

          <View style={styles.profileRow}>
            <View style={styles.avatar} accessible={false}>
              <LotusMark size={30} decorative />
            </View>
            <View style={styles.profileCopy}>
              <Text testID='profile-display-name' style={styles.name}>{displayName}</Text>
              <View style={styles.profileMetaRow}>
                <Icon
                  name={trackingMode === 'pcos' ? 'flower-outline' : 'calendar-outline'}
                  size={15}
                  color={COLORS.brand}
                />
                <Text style={styles.profileMeta}>{modeLabel}</Text>
              </View>
            </View>
          </View>

          {menuSections.map((section) => (
            <View key={section.title} style={styles.menuSection}>
              <Text accessibilityRole='header' style={styles.sectionTitle}>{section.title}</Text>
              <ProductTourTarget ids={section.tourTargetIds}>
                <View style={styles.menuGroup}>
                  {section.items.map((item, index) => (
                    <ProfileMenuRow
                      key={item.title}
                      {...item}
                      onPress={() => item.action ? item.action() : navigation.navigate(item.route, item.params)}
                      last={index === section.items.length - 1}
                    />
                  ))}
                </View>
              </ProductTourTarget>

              {section.title === 'Privacy & data' && showDeleteConfirm ? (
                <Card
                  variant='flat'
                  style={styles.confirmCard}
                >
                  <Text accessibilityRole='header' accessibilityLiveRegion='polite' style={styles.confirmTitle}>Delete tracked data?</Text>
                  <Text style={styles.confirmText}>This permanently removes your check-ins, cycle dates, meals, movement, Meg chats, saved articles and settings. Your sign-in stays active so you can keep using Bloom. This cannot be undone.</Text>
                  {deleteError ? <Text style={styles.logoutError} accessibilityRole='alert'>{deleteError}</Text> : null}
                  <View style={styles.confirmActions}>
                    <Button
                      title='Keep my data'
                      variant='secondary'
                      onPress={() => {
                        setShowDeleteConfirm(false);
                        setDeleteError('');
                      }}
                      disabled={deletingData}
                      style={styles.confirmButton}
                    />
                    <Button
                      title='Delete tracked data'
                      variant='danger'
                      onPress={handleDeleteData}
                      loading={deletingData}
                      disabled={deletingData}
                      style={styles.confirmButton}
                    />
                  </View>
                </Card>
              ) : null}
            </View>
          ))}

          {isDevelopment ? (
            <View style={styles.menuSection}>
              <Text accessibilityRole='header' style={styles.sectionTitle}>Developer preview</Text>
              <View style={styles.menuGroup}>
                <ProfileMenuRow
                  icon='flask-outline'
                  title='Onboarding V3 Preview'
                  subtitle='Preview the isolated first-time flow'
                  onPress={() => navigation.navigate('OnboardingV3Preview')}
                  last
                />
              </View>
              <Text style={styles.developerNote}>Only visible in development builds</Text>
            </View>
          ) : null}

          <ProductTourTarget id='profile-account'>
            <View style={styles.menuSection}>
              <Text accessibilityRole='header' style={styles.sectionTitle}>Account</Text>
              <View style={styles.menuGroup}>
                <ProfileMenuRow
                  icon='log-out-outline'
                  title={loggingOut ? 'Logging out…' : 'Log out'}
                  subtitle='Your Bloom data stays saved to your account'
                  onPress={handleLogout}
                  disabled={loggingOut}
                  busy={loggingOut}
                  accessory='none'
                />
                <ProfileMenuRow
                  icon='person-remove-outline'
                  title='Delete Bloom account'
                  subtitle='Permanently remove your account and Bloom data'
                  onPress={openAccountDeleteConfirm}
                  tone='danger'
                  expanded={showAccountDeleteConfirm}
                  accessory='expand'
                  last
                />
              </View>
              {logoutError ? <Text style={styles.logoutError} accessibilityRole='alert'>{logoutError}</Text> : null}

              {showAccountDeleteConfirm ? (
                <Card
                  variant='flat'
                  style={styles.confirmCard}
                >
                  <Text accessibilityRole='header' accessibilityLiveRegion='polite' style={styles.confirmTitle}>Permanently delete your Bloom account?</Text>
                  <Text style={styles.confirmText}>This removes your sign-in, profile, check-ins, cycle dates, Diet records, Strength sessions, Meg chats and local Bloom data. This cannot be undone.</Text>
                  <Text style={styles.accountPasswordLabel}>Confirm with your password</Text>
                  <TextInput
                    value={accountPassword}
                    onChangeText={(value) => {
                      setAccountPassword(value);
                      setAccountDeleteError('');
                    }}
                    editable={!deletingAccount}
                    secureTextEntry
                    autoCapitalize='none'
                    autoCorrect={false}
                    autoComplete='current-password'
                    textContentType='password'
                    returnKeyType='done'
                    onSubmitEditing={handleDeleteAccount}
                    placeholder='Your Bloom password'
                    placeholderTextColor={COLORS.muted}
                    accessibilityLabel='Password to confirm account deletion'
                    style={styles.accountPasswordInput}
                  />
                  {accountDeleteError ? <Text style={styles.logoutError} accessibilityRole='alert'>{accountDeleteError}</Text> : null}
                  <View style={styles.confirmActions}>
                    <Button
                      title='Keep my account'
                      variant='secondary'
                      onPress={() => {
                        setShowAccountDeleteConfirm(false);
                        setAccountPassword('');
                        setAccountDeleteError('');
                      }}
                      disabled={deletingAccount}
                      style={styles.confirmButton}
                    />
                    <Button
                      title='Delete account'
                      variant='danger'
                      onPress={handleDeleteAccount}
                      loading={deletingAccount}
                      loadingLabel='Deleting account…'
                      disabled={!accountPassword || deletingAccount}
                      style={styles.confirmButton}
                    />
                  </View>
                </Card>
              ) : null}
            </View>
          </ProductTourTarget>

          <View style={styles.trustLine}>
            <View accessible={false}>
              <Icon name='lock-closed-outline' size={16} color={COLORS.sage} />
            </View>
            <Text style={styles.trustText}>Your Bloom information stays with your account. You choose when to export or erase it.</Text>
          </View>
          <Text style={styles.version}>Bloom {appConfig.expo.version} · Private by design</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  backBar: {
    width: '100%',
    maxWidth: LAYOUT.phoneMaxWidth,
    alignSelf: 'center',
    minHeight: 60,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backSpacer: { width: 48 },
  safeArea: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.canvas,
    ...Platform.select({
      web: {
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
      },
      default: {},
    }),
  },
  screen: {
    flex: 1,
    minHeight: 0,
    backgroundColor: COLORS.canvas,
    ...Platform.select({
      web: {
        height: '100%',
        maxHeight: '100%',
        overflowY: 'auto',
      },
      default: {},
    }),
  },
  scrollContent: { paddingBottom: 48 },
  inner: {
    width: '100%',
    maxWidth: LAYOUT.phoneMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: LAYOUT.screenPadding,
    paddingTop: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brandSoft,
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    flexShrink: 1,
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.ink,
  },
  profileMetaRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  profileMeta: {
    flexShrink: 1,
    ...TYPOGRAPHY.supporting,
    color: COLORS.muted,
  },
  menuSection: { marginTop: 28 },
  sectionTitle: {
    marginBottom: 10,
    ...TYPOGRAPHY.supporting,
    fontWeight: '600',
    color: COLORS.ink,
  },
  menuGroup: {
    overflow: 'hidden',
    borderRadius: LAYOUT.cardRadius,
    backgroundColor: COLORS.surfaceSoft,
  },
  menuItem: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surfaceSoft,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.hairline,
  },
  menuItemPressed: { backgroundColor: COLORS.surfaceStrong },
  menuItemHovered: { backgroundColor: COLORS.surfaceStrong },
  menuItemFocused: {
    backgroundColor: COLORS.brandSoft,
    ...Platform.select({ web: WEB_FOCUS, default: {} }),
  },
  disabledItem: { opacity: 0.62 },
  menuIcon: {
    width: 40,
    height: 40,
    flexShrink: 0,
    marginRight: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.canvas,
  },
  menuIconDanger: { backgroundColor: COLORS.dangerSoft },
  menuText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  menuTitle: {
    ...TYPOGRAPHY.componentTitle,
    color: COLORS.ink,
  },
  menuTitleDanger: { color: COLORS.danger },
  menuSubtitle: {
    marginTop: 3,
    ...TYPOGRAPHY.caption,
    color: COLORS.muted,
  },
  logoutError: {
    marginTop: 8,
    ...TYPOGRAPHY.supporting,
    color: COLORS.error,
  },
  confirmCard: {
    marginTop: 12,
    padding: 18,
    borderWidth: 0,
    backgroundColor: COLORS.dangerSoft,
  },
  confirmTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    color: COLORS.ink,
  },
  confirmText: {
    marginTop: 6,
    ...TYPOGRAPHY.supporting,
    color: COLORS.body,
  },
  accountPasswordLabel: {
    marginTop: 16,
    marginBottom: 7,
    ...TYPOGRAPHY.supporting,
    fontWeight: '600',
    color: COLORS.ink,
  },
  accountPasswordInput: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    borderRadius: LAYOUT.controlRadius,
    backgroundColor: COLORS.canvas,
    color: COLORS.ink,
    fontSize: 16,
  },
  confirmActions: {
    marginTop: 18,
    gap: 10,
  },
  confirmButton: { paddingHorizontal: 12 },
  developerNote: {
    marginTop: 7,
    paddingHorizontal: 4,
    ...TYPOGRAPHY.caption,
    color: COLORS.muted,
  },
  trustLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 28,
    paddingHorizontal: 4,
  },
  trustText: {
    flex: 1,
    minWidth: 0,
    ...TYPOGRAPHY.caption,
    color: COLORS.muted,
  },
  version: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
