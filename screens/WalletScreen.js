import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { spacing } from '../lib/theme';
import {
  IronGlyph,
  StoneGlyph,
  GoldGlyph,
  MoraleGlyph,
} from '../components/ResourceGlyphs';

const INK = '#0E1014';
const BONE = '#F2EEE6';
const SLATE2 = '#8B8F98';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

const RESOURCES = [
  {
    key: 'iron',
    label: 'IRON',
    Glyph: IronGlyph,
    glyphColor: '#F2EEE6',
    spend: 'Spend to contest territories',
    earn: 'Earn from calorie challenges & contest wins',
  },
  {
    key: 'stone',
    label: 'STONE',
    Glyph: StoneGlyph,
    glyphColor: '#F2EEE6',
    spend: 'Spend to defend & develop territories',
    earn: 'Earn from step challenges & defence wins',
  },
  {
    key: 'gold',
    label: 'GOLD',
    Glyph: GoldGlyph,
    glyphColor: '#F2EEE6',
    spend: 'Spend to claim territories',
    earn: 'Earn from all challenges & claims',
  },
  {
    key: 'morale',
    label: 'MORALE',
    Glyph: MoraleGlyph,
    glyphColor: '#F2EEE6',
    spend: 'Donate to alliance war chest',
    earn: 'Earn from challenges & alliance missions',
  },
];

function SectionDivider({ label }) {
  return (
    <View style={styles.sectionDivider}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

export default function WalletScreen({ route }) {
  const navigation = useNavigation();
  const { playerId = null, username = '' } = route?.params ?? {};

  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ iron: 0, stone: 0, gold: 0, morale: 0 });
  const [allianceId, setAllianceId] = useState(null);
  const [error, setError] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [donating, setDonating] = useState(false);
  const [donateError, setDonateError] = useState(null);
  const [donateModalVisible, setDonateModalVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      if (!playerId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('players')
        .select('iron, stone, gold, morale, alliance_id')
        .eq('id', playerId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message ?? 'Could not load wallet');
        setLoading(false);
        return;
      }

      setWallet({
        iron: data?.iron ?? 0,
        stone: data?.stone ?? 0,
        gold: data?.gold ?? 0,
        morale: data?.morale ?? 0,
      });
      setAllianceId(data?.alliance_id ?? null);
      setLoading(false);
    }

    loadWallet();
    return () => { cancelled = true; };
  }, [playerId]);

  async function handleDonate(amount) {
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) return;
    if (parsed > wallet.morale) {
      setDonateError('Not enough Morale.');
      return;
    }

    Alert.alert(
      `Donate ${parsed} Morale?`,
      'This will be added to your alliance war chest.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Donate',
          style: 'destructive',
          onPress: async () => {
            setDonating(true);
            setDonateError(null);
            const { error } = await supabase.rpc('donate_morale', {
              player_id: playerId,
              alliance_id: allianceId,
              amount: parsed,
            });
            setDonating(false);
            if (error) {
              setDonateError('Donation failed. Try again.');
            } else {
              setWallet(prev => ({ ...prev, morale: prev.morale - parsed }));
              setCustomAmount('');
              setDonateModalVisible(false);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerBlock}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← PROFILE</Text>
        </Pressable>
        <Text style={styles.headerLabel}>{username}</Text>
        <Text style={styles.headerTitle}>MY RESOURCES</Text>
        <View style={styles.hairlineStrong} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={SLATE2} />
            <Text style={styles.loadingText}>Loading wallet…</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            <View style={styles.walletBlock}>
              <SectionDivider label="WALLET" />
              {RESOURCES.map((r, index) => (
                <View key={r.key}>
                  {(() => {
                    const isMoreale = r.key === 'morale';
                    const row = (
                      <View style={styles.resourceRow}>
                        <View style={styles.glyphWrap}>
                          <r.Glyph size={28} color={r.glyphColor} />
                        </View>
                        <View style={styles.resourceInfo}>
                          <Text style={styles.resourceLabel}>{r.label}</Text>
                          {isMoreale ? (
                            <>
                              <Text style={styles.resourceSpend}>{r.spend}</Text>
                              <Text style={styles.resourceEarn}>{r.earn}</Text>
                              {allianceId ? <Text style={styles.donateArrow}>DONATE →</Text> : null}
                            </>
                          ) : (
                            <>
                              <Text style={styles.resourceSpend}>{r.spend}</Text>
                              <Text style={styles.resourceEarn}>{r.earn}</Text>
                            </>
                          )}
                        </View>
                        <Text style={styles.resourceBalance}>
                          {wallet[r.key].toLocaleString()}
                        </Text>
                      </View>
                    );
                    if (isMoreale && allianceId) {
                      return (
                        <Pressable onPress={() => setDonateModalVisible(true)}>
                          {row}
                        </Pressable>
                      );
                    }
                    return row;
                  })()}
                  {index < RESOURCES.length - 1 ? (
                    <View style={styles.rowDivider} />
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={donateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDonateModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setDonateModalVisible(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          <Text style={styles.modalTitle}>DONATE MORALE</Text>
          <Text style={styles.modalBalance}>
            YOUR BALANCE · {wallet.morale.toLocaleString()}
          </Text>

          <View style={styles.modalInputRow}>
            <TextInput
              style={styles.modalInput}
              value={customAmount}
              onChangeText={text => {
                setCustomAmount(text.replace(/[^0-9]/g, ''));
                setDonateError(null);
              }}
              keyboardType="numeric"
              placeholder="Amount"
              placeholderTextColor={SLATE2}
              maxLength={6}
              autoFocus
            />
            <Pressable
              style={[
                styles.modalDonateBtn,
                (!customAmount || parseInt(customAmount) > wallet.morale || donating) && styles.modalDonateBtnDisabled,
              ]}
              onPress={() => handleDonate(customAmount)}
              disabled={!customAmount || parseInt(customAmount) > wallet.morale || donating}
            >
              <Text style={styles.modalDonateBtnText}>{donating ? '…' : 'DONATE'}</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.modalDonateAllBtn, (wallet.morale === 0 || donating) && styles.modalDonateBtnDisabled]}
            onPress={() => handleDonate(wallet.morale)}
            disabled={wallet.morale === 0 || donating}
          >
            <Text style={styles.modalDonateAllBtnText}>
              DONATE ALL · {wallet.morale.toLocaleString()} MORALE
            </Text>
          </Pressable>

          {donateError ? (
            <Text style={styles.modalDonateError}>{donateError}</Text>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: INK,
  },
  headerBlock: {
    paddingTop: (StatusBar.currentHeight ?? 0) + 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    marginBottom: 8,
  },
  backBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: '#D64525',
    letterSpacing: 1.4,
  },
  headerLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: SLATE2,
  },
  headerTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 36,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
    marginTop: 2,
  },
  hairlineStrong: {
    marginTop: 14,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: SLATE2,
  },
  errorBanner: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: SLATE2,
  },
  walletBlock: {
    paddingTop: spacing.xl,
  },
  donateHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  donateArrow: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.4,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    backgroundColor: '#1A1D24',
    borderTopWidth: 1,
    borderTopColor: HAIRLINE_STRONG,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36,
    height: 3,
    backgroundColor: HAIRLINE_STRONG,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalBalance: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: SLATE2,
    letterSpacing: 1.4,
    marginBottom: 20,
  },
  modalInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 13,
    color: BONE,
    letterSpacing: 1.2,
  },
  modalDonateBtn: {
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDonateBtnDisabled: {
    borderColor: HAIRLINE,
    opacity: 0.35,
  },
  modalDonateBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
    letterSpacing: 1.4,
  },
  modalDonateAllBtn: {
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDonateAllBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
    letterSpacing: 1.4,
  },
  modalDonateError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#E05A5A',
    marginTop: 8,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE,
  },
  sectionLabel: {
    paddingHorizontal: 8,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.16,
    color: SLATE2,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  glyphWrap: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceInfo: {
    flex: 1,
    gap: 2,
  },
  resourceLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: SLATE2,
  },
  resourceSpend: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: BONE,
    opacity: 0.7,
  },
  resourceEarn: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
  resourceBalance: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 28,
    color: BONE,
    letterSpacing: -0.02,
  },
  rowDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
  },
});

