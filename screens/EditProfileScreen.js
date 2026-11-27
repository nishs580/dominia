// Figma Edit Profile (plan U16; G5 parity in plan 2026-11-27 U13): "← EDIT
// PROFILE", MY DETAILS, photo with CHANGE PHOTO / REMOVE PHOTO, the NAME
// field with its helper line, and SAVE CHANGES pinned to the bottom.
//
// Photo upload follows ProfileScreen's flow (Clerk CDN via setProfileImage,
// then the URL cached into players.avatar_url with PATCH /me). A denied photo
// permission offers Settings; a failed upload keeps the picked image so RETRY
// re-sends it without picking again. The name uses the onboarding picker's
// rules, availability check and error copy.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import BackTitleHeader from '../components/BackTitleHeader';
import { checkUsernameAvailable, getMe, patchMe } from '../lib/meApi';
import { avatarInitials, avatarThumb } from '../lib/avatar';
import { usernameSaveErrorKey, validateUsername } from '../lib/profile';
import { colors, fonts } from '../lib/theme';

const AVAILABILITY_DEBOUNCE_MS = 400;

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Photo: 'idle' | 'uploading' | 'denied' | 'failed'
  const [photoState, setPhotoState] = useState('idle');
  // Picked-but-not-uploaded image, kept for RETRY. null for a removal retry.
  const [pendingPhoto, setPendingPhoto] = useState(undefined);

  const [name, setName] = useState('');
  // 'idle' | 'checking' | 'available' | 'taken'
  const [nameStatus, setNameStatus] = useState('idle');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const res = await getMe({ clerkGetToken: getToken });
    if (!res.ok || !res.data?.player) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    const player = res.data.player;
    setCurrentName(player.username ?? '');
    setName(player.username ?? '');
    setAvatarUrl(player.avatar_url ?? user?.imageUrl ?? null);
    setLoading(false);
  }, [getToken, user]);

  useEffect(() => {
    load();
    // Load once on mount; `user` changing after an upload must not reset edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmed = name.trim();
  // Debounced, advisory availability check — PATCH /me re-checks on save.
  // Skipped for the player's own current name (case-only changes included).
  useEffect(() => {
    if (validateUsername(name) !== null || trimmed.toLowerCase() === currentName.toLowerCase()) {
      setNameStatus('idle');
      return undefined;
    }
    setNameStatus('checking');
    let cancelled = false;
    const handle = setTimeout(async () => {
      const res = await checkUsernameAvailable({ clerkGetToken: getToken, username: trimmed });
      if (cancelled) return;
      if (res.ok) setNameStatus(res.data.available ? 'available' : 'taken');
      else setNameStatus('idle');
    }, AVAILABILITY_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(handle); };
    // getToken is left out on purpose: Clerk returns a new function each
    // render, which would restart the debounce forever.
  }, [name, currentName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Photo ──────────────────────────────────────────────────────────────

  // Uploads `file` (a data URI) or removes the photo when `file` is null.
  const uploadPhoto = async (file) => {
    if (!user) {
      Toast.show({ type: 'info', text1: t('profile.alertHangOnTitle'), text2: t('profile.alertHangOnBody'), position: 'top' });
      return;
    }
    setPhotoState('uploading');
    setPendingPhoto(file);
    let newUrl;
    try {
      await user.setProfileImage({ file });
      await user.reload();
      newUrl = file === null ? null : user.imageUrl ?? null;
    } catch (err) {
      console.warn('[EditProfile] photo update failed:', err?.message ?? err);
      setPhotoState('failed');
      return;
    }
    setPendingPhoto(undefined);
    setPhotoState('idle');
    setAvatarUrl(newUrl);
    // Clerk holds the image; the cached URL only feeds other players' lists.
    const res = await patchMe({ clerkGetToken: getToken, fields: { avatar_url: newUrl } });
    if (!res.ok) {
      console.warn('[EditProfile] avatar patchMe failed:', res.status, res.error);
      Toast.show({ type: 'info', text1: t('profile.alertAlmostTitle'), text2: t('profile.alertAlmostBody'), position: 'top' });
    }
  };

  const onChangePhoto = async () => {
    if (photoState === 'uploading') return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPhotoState('denied');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) {
        if (photoState === 'denied') setPhotoState('idle');
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Toast.show({ type: 'error', text1: t('profile.alertUploadFailedTitle'), text2: t('profile.alertReadImageBody'), position: 'top' });
        return;
      }
      const mime = asset.mimeType ?? 'image/jpeg';
      await uploadPhoto(`data:${mime};base64,${asset.base64}`);
    } catch (err) {
      console.warn('[EditProfile] photo pick failed:', err?.message ?? err);
      Toast.show({ type: 'error', text1: t('profile.alertUploadFailedTitle'), text2: t('profile.alertUploadGenericBody'), position: 'top' });
    }
  };

  const onRemovePhoto = () => {
    if (photoState === 'uploading' || !avatarUrl) return;
    uploadPhoto(null);
  };

  const onRetryPhoto = () => {
    if (pendingPhoto === undefined) return;
    uploadPhoto(pendingPhoto);
  };

  // ── Name ───────────────────────────────────────────────────────────────

  const onSaveName = async () => {
    const problem = validateUsername(name);
    if (problem) {
      setNameError(t(`username.${problem}`));
      return;
    }
    if (nameStatus === 'taken') {
      setNameError(t('username.errorTaken'));
      return;
    }
    setSavingName(true);
    setNameError('');
    const res = await patchMe({ clerkGetToken: getToken, fields: { username: trimmed } });
    setSavingName(false);
    if (res.ok) {
      setCurrentName(res.data?.player?.username ?? trimmed);
      setNameStatus('idle');
      Toast.show({
        type: 'success',
        text1: t('editProfile.nameSaved', { defaultValue: 'Name updated' }),
        position: 'top',
      });
      return;
    }
    const key = usernameSaveErrorKey(res.status);
    if (key === 'errorTaken') setNameStatus('taken');
    setNameError(t(`username.${key}`));
  };

  const header = (
    <BackTitleHeader
      title={t('editProfile.title', { defaultValue: 'Edit Profile' })}
      onBack={() => navigation.goBack()}
    />
  );

  if (loading || loadError) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.bone} />
          ) : (
            <>
              <Text style={styles.helper}>{t('profile.errCouldNotLoad')}</Text>
              <Pressable
                onPress={load}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>{t('common.retry')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );
  }

  const uploading = photoState === 'uploading';
  const nameUnchanged = trimmed === currentName;
  const saveDisabled = savingName || nameUnchanged || validateUsername(name) !== null || nameStatus === 'taken';

  let nameHint = null;
  if (nameError) nameHint = <Text style={styles.error} accessibilityLiveRegion="polite">{nameError}</Text>;
  else if (nameStatus === 'taken') nameHint = <Text style={styles.error} accessibilityLiveRegion="polite">{t('username.errorTaken')}</Text>;
  else if (nameStatus === 'checking') nameHint = <Text style={styles.helper}>{t('username.checking')}</Text>;
  else if (nameStatus === 'available') nameHint = <Text style={styles.helper}>{t('username.available')}</Text>;
  else {
    nameHint = (
      <Text style={styles.helper}>
        {t('editProfile.nameHelper', { defaultValue: 'This is the name other players see on the map and leaderboards.' })}
      </Text>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel} accessibilityRole="header">
            {t('editProfile.myDetails', { defaultValue: 'My details' })}
          </Text>

          <View style={styles.photoRow}>
            <View>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarThumb(avatarUrl, 96) }}
                  style={styles.avatar}
                  accessibilityLabel={t('editProfile.photoA11y', { defaultValue: 'Your profile photo' })}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitials}>{avatarInitials(currentName)}</Text>
                </View>
              )}
              {uploading ? (
                <View style={styles.avatarBusy}>
                  <ActivityIndicator color={colors.bone} />
                </View>
              ) : null}
            </View>
            <View style={styles.photoActions}>
              <Pressable
                onPress={onChangePhoto}
                disabled={uploading}
                accessibilityRole="button"
                accessibilityLabel={t('editProfile.changePhoto', { defaultValue: 'Change photo' })}
                accessibilityState={{ disabled: uploading }}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, uploading && styles.disabled]}
              >
                <Text style={styles.secondaryButtonText}>
                  {t('editProfile.changePhoto', { defaultValue: 'Change photo' })}
                </Text>
              </Pressable>
              <Pressable
                onPress={onRemovePhoto}
                disabled={uploading || !avatarUrl}
                accessibilityRole="button"
                accessibilityLabel={t('editProfile.removePhoto', { defaultValue: 'Remove photo' })}
                accessibilityState={{ disabled: uploading || !avatarUrl }}
                style={({ pressed }) => [styles.textButton, pressed && styles.pressed, (uploading || !avatarUrl) && styles.disabled]}
              >
                <Text style={[styles.secondaryButtonText, styles.textButtonText]}>
                  {t('editProfile.removePhoto', { defaultValue: 'Remove photo' })}
                </Text>
              </Pressable>
            </View>
          </View>

          {photoState === 'denied' ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.noticeText}>{t('profile.alertPhotoBody')}</Text>
              <Pressable
                onPress={() => Linking.openSettings().catch(() => {})}
                accessibilityRole="button"
                accessibilityLabel={t('editProfile.openSettings', { defaultValue: 'Open settings' })}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>
                  {t('editProfile.openSettings', { defaultValue: 'Open settings' })}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {photoState === 'failed' ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.noticeText}>{t('profile.alertUploadGenericBody')}</Text>
              <Pressable
                onPress={onRetryPhoto}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={[styles.sectionLabel, styles.fieldLabel]} nativeID="editProfileNameLabel">
            {t('editProfile.name', { defaultValue: 'Name' })}
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(v) => { setName(v); setNameError(''); }}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            keyboardAppearance="dark"
            placeholder={t('username.placeholder')}
            placeholderTextColor={colors.slate}
            editable={!savingName}
            returnKeyType="done"
            onSubmitEditing={saveDisabled ? undefined : onSaveName}
            accessibilityLabel={t('editProfile.name', { defaultValue: 'Name' })}
            accessibilityLabelledBy="editProfileNameLabel"
          />
          <View style={styles.hint}>{nameHint}</View>
        </ScrollView>

        {/* G5: SAVE CHANGES sits pinned above the home indicator. */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={onSaveName}
            disabled={saveDisabled}
            accessibilityRole="button"
            accessibilityLabel={t('editProfile.save', { defaultValue: 'Save changes' })}
            accessibilityState={{ disabled: saveDisabled, busy: savingName }}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed, saveDisabled && styles.disabled]}
          >
            {savingName ? (
              <ActivityIndicator color={colors.bone} />
            ) : (
              <Text style={styles.primaryButtonText}>{t('editProfile.save', { defaultValue: 'Save changes' })}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.slate2,
  },
  fieldLabel: {
    marginTop: 24,
    marginBottom: 8,
  },
  photoRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderWidth: 2,
    borderColor: colors.self,
    backgroundColor: colors.ink2,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 30,
    color: colors.slate2,
    textTransform: 'uppercase',
  },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  photoActions: {
    flex: 1,
    gap: 8,
  },
  secondaryButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  // REMOVE PHOTO is a bare text button in G5.
  textButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textButtonText: {
    color: colors.muted2,
  },
  secondaryButtonText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  notice: {
    marginTop: 12,
    padding: 12,
    gap: 8,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  noticeText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.bone,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairline,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.bone,
  },
  hint: {
    minHeight: 24,
    paddingTop: 6,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.slate2,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.bone,
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.claimButton,
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  pressed: {
    backgroundColor: colors.ink3,
  },
  disabled: {
    opacity: 0.4,
  },
});
