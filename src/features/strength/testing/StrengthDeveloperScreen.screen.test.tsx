import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {StrengthStackParamList} from '../navigation/types';
import StrengthDeveloperScreen from './StrengthDeveloperScreen';
import {SQUAT_FIXTURES} from './squatFixtures';

type Props = NativeStackScreenProps<StrengthStackParamList, 'StrengthDeveloper'>;
const props = {
  navigation: {goBack: jest.fn()},
  route: {key: 'developer-test', name: 'StrengthDeveloper'},
} as unknown as Props;

describe('Strength developer simulator', () => {
  afterEach(() => jest.useRealTimers());

  test('steps observed frames and shows real timestamp, angle, confidence and FPS', () => {
    const screen = render(<StrengthDeveloperScreen {...props}/>);
    expect(screen.getByText('DEVELOPER ONLY · SIMULATED')).toBeTruthy();
    expect(screen.getByTestId('dev-reps').props.children).toBe('0');
    expect(screen.getByTestId('dev-timestamp').props.children).toBe('—');
    fireEvent.press(screen.getByRole('button', {name: 'Step frame'}));
    expect(screen.getByTestId('dev-timestamp').props.children).toBe('0 ms');
    expect(screen.getByTestId('dev-left-angle').props.children).toBe('173.0°');
    expect(screen.getByTestId('dev-tracking').props.children).toBe('TRACKING');
    expect(parseFloat(screen.getByTestId('dev-confidence').props.children)).toBeGreaterThan(0);
    expect(screen.getByTestId('dev-fps').props.children).toBe('—');
    fireEvent.press(screen.getByRole('button', {name: 'Step frame'}));
    expect(screen.getByTestId('dev-timestamp').props.children).toBe('50 ms');
    expect(screen.getByTestId('dev-fps').props.children).toBe('20.0');
  });

  test('complete fixture counts one real rep and reset clears engine and frame evidence', () => {
    const screen = render(<StrengthDeveloperScreen {...props}/>);
    for (let index = 0; index < SQUAT_FIXTURES[0].createFrames().length; index += 1) {
      fireEvent.press(screen.getByRole('button', {name: 'Step frame'}));
    }
    expect(screen.getByTestId('dev-reps').props.children).toBe('1');
    expect(screen.getByRole('button', {name: 'Replay'})).toBeTruthy();
    fireEvent.press(screen.getByRole('button', {name: 'Reset sequence'}));
    expect(screen.getByTestId('dev-reps').props.children).toBe('0');
    expect(screen.getByTestId('dev-tracking').props.children).toBe('INITIALIZING');
    expect(screen.getByTestId('dev-left-angle').props.children).toBe('—');
    expect(screen.getByTestId('dev-timestamp').props.children).toBe('—');
  });

  test('selecting low confidence fixture resets playback and displays failed tracking', () => {
    const screen = render(<StrengthDeveloperScreen {...props}/>);
    fireEvent.press(screen.getByRole('button', {name: 'Step frame'}));
    fireEvent.press(screen.getByRole('button', {name: 'Low confidence'}));
    expect(screen.getByTestId('dev-timestamp').props.children).toBe('—');
    fireEvent.press(screen.getByRole('button', {name: 'Step frame'}));
    expect(screen.getByTestId('dev-reps').props.children).toBe('0');
    expect(screen.getByTestId('dev-tracking').props.children).toBe('NO_POSE');
    expect(screen.getByTestId('dev-confidence').props.children).toBe('0.0%');
  });

  test('play advances fixture frames and pause cancels scheduled playback', () => {
    jest.useFakeTimers();
    const screen = render(<StrengthDeveloperScreen {...props}/>);
    fireEvent.press(screen.getByRole('button', {name: 'Play'}));
    act(() => { jest.advanceTimersByTime(1); });
    expect(screen.getByTestId('dev-timestamp').props.children).toBe('0 ms');
    act(() => { jest.advanceTimersByTime(50); });
    expect(screen.getByTestId('dev-timestamp').props.children).toBe('50 ms');
    fireEvent.press(screen.getByRole('button', {name: 'Pause'}));
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByTestId('dev-timestamp').props.children).toBe('50 ms');
    screen.unmount();
  });
});
