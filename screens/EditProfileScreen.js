// Figma Edit Profile (plan U10; Dominia-Temp board 38): "‹ Edit Profile" back
// row, MY DETAILS with its slanted icon tile, the big blue slanted avatar tile,
// CHANGE PHOTO / REMOVE PHOTO tiles, a hairline, and the NAME row card. SAVE
// CHANGES appears pinned to the bottom once the name has been edited.
//
// Photo: Clerk CDN via setProfileImage, then the URL cached into
// players.avatar_url with PATCH /me (lib/avatar updateAvatar; a removal
// patches null). A denied photo permission offers Settings; a failed upload
// keeps the old photo and the picked image so RETRY re-sends it without
// picking again. The name uses the onboarding picker's rules, availability
// check and error copy.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { useAuth, useUser } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import SlantAvatar from '../components/SlantAvatar';
import { CutCard, SlantButton, SlantTile } from '../components/ui';
import { BackRow, ListGlyph } from './ProfileAccordionScreen';
import { checkUsernameAvailable, getMe, patchMe } from '../lib/meApi';
import { avatarThumb, clerkAvatarUrl, updateAvatar } from '../lib/avatar';
import { usernameSaveErrorKey, validateUsername } from '../lib/profile';
import { colors, fonts } from '../lib/theme';

const AVAILABILITY_DEBOUNCE_MS = 400;
const AVATAR_HEIGHT = 110;
const GLYPH = { stroke: colors.white, strokeWidth: 1.5, fill: 'none' };

function PhotoGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Rect x="2" y="2.5" width="12" height="11" {...GLYPH} />
      <Circle cx="6" cy="6.5" r="1.3" {...GLYPH} />
      <Polyline points="2,12 6.5,8.5 9,10.5 11,9 14,11.5" {...GLYPH} />
    </Svg>
  );
}

function TrashGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Line x1="2.5" y1="4" x2="13.5" y2="4" {...GLYPH} />
      <Path d="M6 4 V2.5 H10 V4" {...GLYPH} />
      <Path d="M4 4 L4.8 14 H11.2 L12 4" {...GLYPH} />
      <Line x1="6.8" y1="6.5" x2="6.8" y2="11.5" {...GLYPH} />
      <Line x1="9.2" y1="6.5" x2="9.2" y2="11.5" {...GLYPH} />
    </Svg>
  );
}

// A slanted icon tile over an uppercase label; the whole column is the button.
function PhotoAction({ icon, label, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.photoAction, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <SlantTile size={36} square tone="raised">{icon}</SlantTile>
      <Text style={styles.photoActionText} maxFontSizeMultiplier={1.3}>{label}</Text>
    </Pressable>
  );
}

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { user } = useUser();
  // Clerk's getToken is not referentially stable; read it through a ref so the
  // loader below stays stable (see ProfileAccordionScreen stableGetToken).
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const stableGetToken = useCallback((...args) => getTokenRef.current(...args), []);

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
    const res = await getMe({ clerkGetToken: stableGetToken });
    if (!res.ok || !res.data?.player) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    const player = res.data.player;
    setCurrentName(player.username ?? '');
    setName(player.username ?? '');
    // Clerk's generated default image is not a photo (hasImage false).
    setAvatarUrl(player.avatar_url ?? clerkAvatarUrl(user));
    setLoading(false);
  }, [stableGetToken, user]);

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
    const res = await updateAvatar({
      user,
      file,
      previousUrl: avatarUrl,
      patch: (fields) => patchMe({ clerkGetToken: getToken, fields }),
    });
    if (!res.ok) {
      // The old photo stays; RETRY re-sends the picked image.
      console.warn('[EditProfile] photo update failed:', res.error?.message ?? res.stage);
      setPhotoState('failed');
      return;
    }
    setPendingPhoto(undefined);
    setPhotoState('idle');
    setAvatarUrl(res.avatarUrl);
    // Clerk holds the image; the cached URL only feeds other players' lists
    // and is re-synced on the next Profile load.
    if (!res.synced) {
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
    <BackRow
      title={t('editProfile.title', { defaultValue: 'Edit Profile' })}
      onBack={() => navigation.goBack()}
      backLabel={t('common.back', { defaultValue: 'Back' })}
    />
  );

  if (loading || loadError) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.helper}>{t('profile.errCouldNotLoad')}</Text>
              <SlantButton label={t('common.retry')} variant="outline" size="md" onPress={load} />
            </>
          )}
        </View>
      </View>
    );
  }

  const uploading = photoState === 'uploading';
  const nameUnchanged = trimmed === currentName;
  const saveDisabled = savingName || nameUnchanged || validateUsername(name) !== null || nameStatus === 'taken';
  const nameInvalid = !!nameError || nameStatus === 'taken';

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
          <View style={styles.titleRow}>
            <SlantTile size={32} square tone="raised">
              <ListGlyph />
            </SlantTile>
            <Text style={styles.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {t('editProfile.myDetails', { defaultValue: 'My details' })}
            </Text>
          </View>

          <View style={styles.avatarWrap}>
            <SlantAvatar
              uri={avatarThumb(avatarUrl, AVATAR_HEIGHT)}
              height={AVATAR_HEIGHT}
              busy={uploading}
              accessibilityLabel={t('editProfile.photoA11y', { defaultValue: 'Your profile photo' })}
            />
          </View>

          <View style={styles.photoActions}>
            <PhotoAction
              icon={<PhotoGlyph />}
              label={t('editProfile.changePhoto', { defaultValue: 'Change photo' })}
              onPress={onChangePhoto}
              disabled={uploading}
            />
            <PhotoAction
              icon={<TrashGlyph />}
              label={t('editProfile.removePhoto', { defaultValue: 'Remove photo' })}
              onPress={onRemovePhoto}
              disabled={uploading || !avatarUrl}
            />
          </View>

          {photoState === 'denied' ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.noticeText}>{t('profile.alertPhotoBody')}</Text>
              <SlantButton
                label={t('editProfile.openSettings', { defaultValue: 'Open settings' })}
                variant="outline"
                size="sm"
                onPress={() => Linking.openSettings().catch(() => {})}
              />
            </View>
          ) : null}

          {photoState === 'failed' ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.noticeText}>{t('profile.alertUploadGenericBody')}</Text>
              <SlantButton label={t('common.retry')} variant="outline" size="sm" onPress={onRetryPhoto} />
            </View>
          ) : null}

          <View style={styles.rule} />

          <CutCard padding={0} variant={nameInvalid ? 'danger' : 'default'}>
            <View style={styles.nameRow}>
              <Text style={styles.nameLabel} nativeID="editProfileNameLabel" maxFontSizeMultiplier={1.3}>
                {t('editProfile.name', { defaultValue: 'Name' })}
              </Text>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={(v) => { setName(v); setNameError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                keyboardAppearance="dark"
                placeholder={t('username.placeholder')}
                placeholderTextColor={colors.muted}
                selectionColor={colors.lime}
                editable={!savingName}
                returnKeyType="done"
                onSubmitEditing={saveDisabled ? undefined : onSaveName}
                accessibilityLabel={t('editProfile.name', { defaultValue: 'Name' })}
                accessibilityLabelledBy="editProfileNameLabel"
              />
            </View>
          </CutCard>
          <View style={styles.hint}>{nameHint}</View>
        </ScrollView>

        {/* SAVE CHANGES appears once the name differs, pinned above the home
            indicator (board 38 shows the resting state without it). */}
        {nameUnchanged ? null : (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <SlantButton
              label={t('editProfile.save', { defaultValue: 'Save changes' })}
              onPress={onSaveName}
              disabled={saveDisabled}
              loading={savingName}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.obsidian,
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
    paddingTop: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
    textTransform: 'uppercase',
    color: colors.white,
  },
  avatarWrap: {
    alignItems: 'center',
    marginTop: 20,
  },
  photoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginTop: 16,
  },
  photoAction: {
    alignItems: 'center',
    gap: 10,
    minWidth: 120,
    minHeight: 44,
    paddingVertical: 2,
  },
  photoActionText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.white,
  },
  notice: {
    marginTop: 16,
    padding: 12,
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceLine,
  },
  noticeText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.white,
  },
  rule: {
    height: 1,
    marginTop: 20,
    marginBottom: 14,
    backgroundColor: colors.hairlineStrong,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
    gap: 12,
  },
  nameLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  nameInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 0,
    textAlign: 'right',
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.white,
  },
  hint: {
    minHeight: 24,
    paddingTop: 6,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted2,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.danger,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
