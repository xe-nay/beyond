import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Button, Chip, Divider, Press, Row, Stepper, T, Toggle } from '../src/components/ui';
import { endLive, liveStatus, startLive } from '../modules/live-activity';
import { formatClock } from '../src/domain/intervals';
import type { Cue } from '../src/domain/types';
import { downloadPack, englishVoices, packReady, playClip, playCountdown, playVoice, prepareAudio, say } from '../src/sound';
import { useStore } from '../src/store';
import { alpha, colors, radius, space } from '../src/theme';
import { pack, PACKS, VOICE_LEAD } from '../src/voices';

export default function TimerSettings() {
  const s = useStore();
  const t = s.timer;
  const [loading, setLoading] = useState<{ cue: Cue; done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<Cue | null>(null);
  const [island, setIsland] = useState(liveStatus());
  // A 15-second countdown in the Dynamic Island, to check it works; any refusal from iOS is shown.
  const testIsland = async () => {
    await startLive('Beyond', { mode: 'rest', title: 'Test', subtitle: 'Dynamic Island check', symbol: 'timer', accent: '#40E0F0', endsAt: Date.now() + 15000, total: 15 });
    setIsland(liveStatus());
    setTimeout(() => { endLive().then(() => setIsland(liveStatus())); }, 16000);
  };
  const muted = t.muted ?? [];
  const current = pack(t.cue);
  const kept = current.clips.filter((c) => !muted.includes(c.id));

  const toggle = (label: string, value: boolean, key: 'autoStart' | 'sound' | 'haptics') => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
      <T v="headline">{label}</T>
      <Toggle value={value} onChange={(v) => s.setTimer({ [key]: v })} />
    </Row>
  );

  const preview = async (cue: Cue) => {
    await prepareAudio();
    if (cue === 'beeps') playCountdown(t.countdown, 'end');
    else playVoice(cue);
  };

  const choose = async (cue: Cue) => {
    setFailed(null);
    s.setTimer({ cue });
    if (!packReady(cue)) {
      try {
        setLoading({ cue, done: 0, total: 1 });
        await downloadPack(cue, (done, total) => setLoading({ cue, done, total }));
      } catch {
        setFailed(cue);
      } finally {
        setLoading(null);
      }
    }
    preview(cue);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
      <T v="title">Rest timer</T>
      {toggle('Start after each set', t.autoStart, 'autoStart')}
      <Stepper label="Default rest for new exercises" value={t.defaultRest ?? 120} onChange={(defaultRest) => s.setTimer({ defaultRest })} step={15} min={15} max={600} clock format={formatClock} />
      <Divider />

      <T v="caption" color={colors.faint}>End of rest</T>
      <View style={{ gap: space.sm }}>
        {PACKS.map((p) => {
          const on = t.cue === p.id;
          const busy = loading?.cue === p.id;
          return (
            <Press key={p.id} onPress={() => choose(p.id)} style={[styles.pack, on && styles.packOn]}>
              <View style={[styles.packIcon, on && { backgroundColor: colors.cyan }]}>
                <Icon name={p.id === 'beeps' ? 'timer' : 'speaker.wave.2.fill'} size={16} color={on ? colors.black : colors.cyan} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="headline">{p.name}</T>
                <T v="label" color={failed === p.id ? colors.amber : colors.dim}>
                  {busy ? `Downloading ${loading!.done}/${loading!.total}…` : failed === p.id ? 'Needs a connection to download once' : p.id === 'beeps' ? `${t.countdown}s countdown · ${p.detail.toLowerCase()}` : `${VOICE_LEAD}s before the end · ${p.detail}`}
                </T>
              </View>
              <Press onPress={() => preview(p.id)} style={styles.play} hitSlop={6}><Icon name="play.fill" size={12} color={colors.cyan} /></Press>
            </Press>
          );
        })}
      </View>

      {t.cue !== 'beeps' && (
        <View style={{ gap: space.sm }}>
          <T v="caption" color={colors.faint}>Clips · {kept.length} of {current.clips.length} kept</T>
          <View style={styles.clips}>
            {current.clips.map((c, i) => {
              const on = !muted.includes(c.id);
              return (
                <View key={c.id}>
                  {i > 0 && <Divider />}
                  <Row style={{ paddingVertical: space.sm, gap: space.md }}>
                    <Press onPress={async () => { await prepareAudio(); playClip(t.cue, c.id); }} style={styles.play} hitSlop={6}>
                      <Icon name="play.fill" size={12} color={colors.cyan} />
                    </Press>
                    <View style={{ flex: 1 }}>
                      <T v="headline" color={on ? colors.text : colors.faint}>{c.name}</T>
                      {c.seconds ? <T v="footnote" color={colors.faint}>First {c.seconds}s</T> : null}
                    </View>
                    {/* The last kept clip can't be removed: the pack needs one to play. */}
                    <Toggle value={on} onChange={(v) => (v || kept.length > 1) && s.setTimer({ muted: v ? muted.filter((m) => m !== c.id) : [...muted, c.id] })} />
                  </Row>
                </View>
              );
            })}
          </View>
          <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
            <View style={{ flex: 1 }}>
              <T v="headline">Pause music for voices</T>
              <T v="footnote" color={colors.dim}>For clips too quiet to hear over lowered music</T>
            </View>
            <Toggle value={!!t.pauseMusic} onChange={(pauseMusic) => s.setTimer({ pauseMusic })} />
          </Row>
        </View>
      )}

      <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
        <View style={{ flex: 1 }}>
          <T v="headline">Cardio voice coach</T>
          <T v="footnote" color={colors.dim}>Says each phase, the round and rounds left, and when your pace is off</T>
        </View>
        <Toggle value={t.voiceCoach !== false} onChange={(voiceCoach) => s.setTimer({ voiceCoach })} />
      </Row>
      {t.voiceCoach !== false && <CoachVoice />}

      {t.cue === 'beeps' && (
        <View style={{ gap: space.sm }}>
          <T v="caption" color={colors.faint}>Countdown length</T>
          <Row gap={space.sm}>
            {[0, 3, 5, 10, 15].map((n) => <Chip key={n} label={n ? `${n}s` : 'End only'} active={t.countdown === n} onPress={() => s.setTimer({ countdown: n })} />)}
          </Row>
        </View>
      )}
      <Divider />
      {toggle('Sound', t.sound, 'sound')}
      {t.sound && (
        <View style={{ gap: space.sm }}>
          <T v="caption" color={colors.faint}>Volume</T>
          <Row gap={space.sm}>{[0.25, 0.5, 0.75, 1].map((v) => <Chip key={v} label={`${v * 100}%`} active={t.volume === v} onPress={() => s.setTimer({ volume: v })} />)}</Row>
        </View>
      )}
      {toggle('Vibration', t.haptics, 'haptics')}
      <Divider />
      <View style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T v="headline">Dynamic Island</T>
            <T v="footnote" color={island.ok ? colors.lime : colors.amber}>{island.text}</T>
          </View>
          <Button small kind="secondary" title="Test" onPress={testIsland} />
        </Row>
        <T v="footnote" color={colors.faint}>Shows a 15-second countdown. Swipe home to see it in the island.</T>
      </View>
      <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>
        Your music keeps playing: it lowers while a cue plays and comes back up right after. Cues play in silent mode too. If the phone is locked, a notification rings at the end.
      </T>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pack: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface2, borderWidth: 1, borderColor: 'transparent' },
  packOn: { borderColor: alpha(colors.cyan, 0.6), backgroundColor: alpha(colors.cyan, 0.08) },
  packIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  play: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  clips: { borderRadius: radius.lg, backgroundColor: colors.surface2, paddingHorizontal: space.md },
});

const SAMPLE = 'Round 2 of 6. Work, 90 seconds. Target pace 7 30 per kilometre.';
const ACCENT: Record<string, string> = { 'en-US': 'US', 'en-GB': 'UK', 'en-AU': 'Australia', 'en-IE': 'Ireland', 'en-IN': 'India', 'en-ZA': 'South Africa', 'en-SC': 'Scotland' };

/** The English voices on this iPhone, male ones first; tapping one picks it and speaks a sample. */
function CoachVoice() {
  const s = useStore();
  const [list, setList] = useState<Speech.Voice[]>([]);
  useEffect(() => { englishVoices().then(setList); }, []);
  const current = s.timer.voiceId && list.some((v) => v.identifier === s.timer.voiceId) ? s.timer.voiceId : list[0]?.identifier;
  const pick = (id: string) => { s.setTimer({ voiceId: id }); prepareAudio(); say(SAMPLE); };
  return (
    <View style={{ gap: space.sm }}>
      <T v="caption" color={colors.faint}>Coach voice</T>
      {list.length ? (
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {list.slice(0, 10).map((v) => (
            <Chip key={v.identifier} label={`${v.name} · ${ACCENT[v.language.replace('_', '-')] ?? v.language}${v.quality === Speech.VoiceQuality.Enhanced ? ' · HD' : ''}`} active={current === v.identifier} onPress={() => pick(v.identifier)} />
          ))}
        </Row>
      ) : (
        <T v="footnote" color={colors.dim}>No English voice found on this iPhone.</T>
      )}
      <T v="footnote" color={colors.dim}>Male voices come first. More voices, and better HD versions: iPhone Settings › Accessibility › Spoken Content › Voices › English.</T>
      <Button small kind="ghost" icon="speaker.wave.2.fill" title="Hear a sample" onPress={() => { prepareAudio(); say(SAMPLE); }} />
    </View>
  );
}
