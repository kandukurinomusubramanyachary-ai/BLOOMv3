import React, { useState } from 'react';
import { View, Text, TextInput, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import Button from '../../../components/Button';
import { Entrance } from '../../../components/Motion';
import ReasonCallout from '../components/ReasonCallout';
import { COLORS, createThemedStyles, LAYOUT, TYPOGRAPHY, WEB_FOCUS } from '../../../utils/constants';

/**
 * Screen 2 — Name
 * Warm and personal: asks what Bloom should call her.
 */
export default function NameStep({ initialName = '', onNext, onSkip }) {
  const [name, setName] = useState(initialName);
  const [focused, setFocused] = useState(false);

  const cleanName = name.trim();

  function handleSubmit() {
    onNext({ firstName: cleanName });
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Entrance distance={8} duration={200} style={styles.shell}>
          <Text style={styles.eyebrow}>STEP 1 OF 7</Text>
          <Text style={styles.title}>What should Bloom call you?</Text>
          <Text style={styles.subtitle}>
            A first name or nickname — whatever feels most natural to see when you open Bloom.
          </Text>

          <View style={styles.inputWrap}>
            <TextInput
              value={name}
              onChangeText={setName}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Your name or nickname"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={handleSubmit}
              accessibilityLabel="What should Bloom call you?"
              maxLength={40}
              style={[
                styles.input,
                focused && styles.inputFocused,
              ]}
            />
          </View>

          <ReasonCallout text="We use your name to personalize your daily greetings and make Meg’s responses feel warm." />
        </Entrance>

        <View style={styles.footer}>
          <Button
            title={cleanName ? `Continue as ${cleanName}` : 'Continue'}
            onPress={handleSubmit}
            accessibilityLabel="Continue to next question"
          />
          {!cleanName ? (
            <Button
              title="Skip for now"
              variant="ghost"
              onPress={() => onNext({ firstName: '' })}
              accessibilityLabel="Skip name input"
            />
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = createThemedStyles({
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  shell: {
    width: '100%',
  },
  eyebrow: {
    ...TYPOGRAPHY.eyebrow,
    color: COLORS.brand,
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    ...TYPOGRAPHY.screenTitle,
    fontSize: 25,
    lineHeight: 32,
    color: COLORS.ink,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    marginBottom: 24,
  },
  inputWrap: {
    width: '100%',
    marginBottom: 4,
  },
  input: {
    ...TYPOGRAPHY.body,
    fontSize: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: COLORS.hairline,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    color: COLORS.ink,
    ...Platform.select({
      web: { outlineStyle: 'none' },
      default: {},
    }),
  },
  inputFocused: {
    borderColor: COLORS.brand,
    backgroundColor: COLORS.white,
    ...Platform.select({
      web: WEB_FOCUS,
      default: {},
    }),
  },
  footer: {
    width: '100%',
    gap: 8,
    marginTop: 24,
  },
});
