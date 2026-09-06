import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Icon from '../components/Icon';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, createThemedStyles } from '../utils/constants';
import { useReducedMotion } from '../components/Motion';
import useKeyboardVisible from '../components/useKeyboardVisible';
import { LotusMark } from '../components/BrandMark';
import TodayScreen from '../screens/TodayScreen';
import TimelineScreen from '../screens/TimelineScreen';
import MegScreen from '../screens/MegScreen';
import DietScreen from '../screens/DietScreen';
import StrengthScreen from '../features/strength/StrengthScreen';
import { isStrengthEnabled } from '../features/strength/featureFlag';

const Tab = createBottomTabNavigator();

const tabs = [
  { name: 'Today', component: TodayScreen, icon: 'bloom' },
  { name: 'Timeline', component: TimelineScreen, icon: 'calendar' },
  { name: 'Meg', component: MegScreen, icon: 'chatbubbles' },
  ...(isStrengthEnabled() ? [{ name: 'Strength', component: StrengthScreen, icon: 'fitness' }] : []),
  { name: 'Diet', component: DietScreen, icon: 'nutrition' },
];

function TabIcon({ icon, label, focused, reduceMotion }) {
  const focusProgress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(focusProgress, {
      toValue: focused ? 1 : 0,
      duration: reduceMotion ? 0 : 170,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [focused, focusProgress, reduceMotion]);

  const scale = focusProgress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Animated.View style={[styles.tabItem, !reduceMotion && { transform: [{ scale }] }]}>
      <View style={styles.iconWrap}>
        {icon === 'bloom' ? (
          <LotusMark
            size={23}
            style={{ opacity: focused ? 1 : 0.52 }}
          />
        ) : (
          <Icon
            name={focused ? icon : `${icon}-outline`}
            size={22}
            color={focused ? COLORS.ink : COLORS.muted}
          />
        )}
        <View style={[styles.activeDot, !focused && styles.activeDotHidden]} />
      </View>
      <Text
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.35}
        minimumFontScale={0.72}
        numberOfLines={1}
        style={[styles.tabLabel, focused && styles.tabLabelFocused]}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

function BloomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const keyboardVisible = useKeyboardVisible();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [dockWidth, setDockWidth] = useState(0);
  const activeIndex = useRef(new Animated.Value(state.index)).current;
  const segmentWidth = dockWidth ? (dockWidth - 4) / state.routes.length : 0;
  const focusedOptions = descriptors[state.routes[state.index]?.key]?.options || {};

  useEffect(() => {
    Animated.timing(activeIndex, {
      toValue: state.index,
      duration: reduceMotion ? 0 : 190,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [activeIndex, reduceMotion, state.index]);

  if (keyboardVisible) return null;
  if (focusedOptions.tabBarStyle?.display === 'none') return null;

  return (
    <View style={[styles.tabBarFrame, { paddingBottom: Math.max(insets.bottom, 8) }, wide && styles.railFrame]}>
      <View style={[styles.tabBar, wide && styles.rail]} onLayout={(event) => setDockWidth(event.nativeEvent.layout.width)}>
        {segmentWidth && !wide ? (
          <Animated.View
            style={[
              styles.activeSurface,
              styles.nonInteractive,
              {
                width: Math.max(0, segmentWidth - 4),
                transform: [{ translateX: Animated.multiply(activeIndex, segmentWidth) }],
              },
            ]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const options = descriptors[route.key].options;
          const focused = state.index === index;
          const tab = tabs.find((item) => item.name === route.name);
          const label = options.tabBarLabel || options.title || route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole='tab'
              accessibilityLabel={options.tabBarAccessibilityLabel || String(label)}
              accessibilityState={{ selected: focused }}
              style={({ pressed, hovered, focused: keyboardFocused }) => [
                styles.tabButton,
                wide && styles.railButton,
                wide && focused && styles.railButtonSelected,
                hovered && !focused && styles.tabButtonHovered,
                keyboardFocused && styles.tabButtonFocused,
                pressed && !reduceMotion && styles.tabButtonPressed,
              ]}
            >
              <TabIcon icon={tab?.icon || 'ellipse'} label={String(label)} focused={focused} reduceMotion={reduceMotion} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function MainTabNavigator() {
  const { width } = useWindowDimensions();
  return (
    <Tab.Navigator
      sceneContainerStyle={[styles.scene, width >= 900 && styles.railScene]}
      tabBar={(props) => <BloomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarAccessibilityLabel: tab.name }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = createThemedStyles({
  scene: { backgroundColor: COLORS.canvas },
  railScene: { marginLeft: 96 },
  railFrame: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 96, paddingTop: 28, borderTopWidth: 0, borderRightWidth: 1, borderRightColor: COLORS.hairlineSoft },
  rail: { height: 'auto', flexDirection: 'column', gap: 12, overflow: 'visible' },
  railButton: { flex: 0, minHeight: 64, width: '100%', borderRadius: 16 },
  railButtonSelected: { backgroundColor: COLORS.brandSoft },
  tabBarFrame: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 4,
    paddingHorizontal: 8,
    backgroundColor: COLORS.canvas,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  tabBar: {
    position: 'relative',
    width: '100%',
    maxWidth: 600,
    height: 64,
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 2,
    borderRadius: 0,
    backgroundColor: COLORS.canvas,
    overflow: 'hidden',
  },
  activeSurface: {
    position: 'absolute',
    top: 2,
    left: 2,
    height: 60,
    borderRadius: 16,
    backgroundColor: COLORS.brandSoft,
  },
  nonInteractive: { pointerEvents: 'none' },
  tabButton: {
    zIndex: 1,
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transitionProperty: 'background-color, opacity, transform',
        transitionDuration: '150ms',
        transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
        outlineStyle: 'none',
      },
    }),
  },
  tabButtonHovered: { backgroundColor: COLORS.surfaceSoft },
  tabButtonFocused: {
    ...Platform.select({
      web: {
        outlineStyle: 'solid',
        outlineWidth: 2,
        outlineColor: COLORS.brand,
        outlineOffset: -3,
      },
    }),
  },
  tabButtonPressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  tabItem: { width: '100%', minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { height: 27, alignItems: 'center', justifyContent: 'center' },
  activeDot: {
    position: 'absolute',
    bottom: -1,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.brand,
    opacity: 1,
  },
  activeDotHidden: { opacity: 0 },
  tabLabel: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 16,
    maxWidth: '100%',
    textAlign: 'center',
    color: COLORS.muted,
    fontWeight: '500',
  },
  tabLabelFocused: { color: COLORS.ink, fontWeight: '600' },
});
