import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, PanResponder, Animated as RNAnimated } from 'react-native';
import Svg, { Ellipse, Line, Circle, Path, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

// Purely decorative "sci-fi tracking HUD" overlay. This does NOT read camera
// pixels, run any ML model, or capture frames — it's an absolutely-positioned
// SVG/Animated layer drawn on top of whatever camera preview the caller
// renders underneath it. The user drags each group into place by hand (via
// PanResponder) since there is no real face/hand tracking driving it.

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const VIOLET = '#B47CFF';
const WIRE = 'rgba(230,230,240,0.55)';
const ORANGE = '#FF9F45';
const GREEN_LIP = '#4CE0A0';
const TEAL = '#2FD8C4';
const BLUE = '#4FA8F5';

const FACE_W = 180;
const FACE_H = 230;
const HAND_W = 170;
const HAND_H = 210;

// --- Draggable wrapper -------------------------------------------------

function useDrag(startX, startY) {
  const pan = useRef(new RNAnimated.ValueXY({ x: startX, y: startY })).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: RNAnimated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => pan.flattenOffset(),
    })
  ).current;
  return { pan, panResponder };
}

// --- Pulse/glow/scan animation ------------------------------------------

function usePulse(duration = 1300) {
  const value = useSharedValue(0.35);
  useEffect(() => {
    value.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);
  return value;
}

function useScan(height, duration = 2600) {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withRepeat(withTiming(height, { duration, easing: Easing.linear }), -1, false);
  }, []);
  return value;
}

// --- Face HUD -------------------------------------------------------------

function FaceHUD({ startX, startY }) {
  const { pan, panResponder } = useDrag(startX, startY);
  const pulse = usePulse(1300);
  const scan = useScan(FACE_H, 2400);

  const ovalProps = useAnimatedProps(() => ({ opacity: 0.35 + pulse.value * 0.4 }));
  const noseDotProps = useAnimatedProps(() => ({ opacity: 0.5 + pulse.value * 0.5 }));
  const scanProps = useAnimatedProps(() => ({ y: scan.value - 14 }));

  return (
    <RNAnimated.View
      style={[styles.group, { width: FACE_W, height: FACE_H, transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <Svg width={FACE_W} height={FACE_H} viewBox={`0 0 ${FACE_W} ${FACE_H}`}>
        {/* Outer violet tracking oval */}
        <AnimatedEllipse
          cx={FACE_W / 2}
          cy={FACE_H / 2}
          rx={70}
          ry={102}
          stroke={VIOLET}
          strokeWidth={2}
          fill={VIOLET}
          fillOpacity={0.06}
          animatedProps={ovalProps}
        />

        {/* Wireframe mesh inside the oval */}
        <Line x1={30} y1={78} x2={150} y2={78} stroke={WIRE} strokeWidth={1} />
        <Line x1={24} y1={115} x2={156} y2={115} stroke={WIRE} strokeWidth={1} />
        <Line x1={30} y1={152} x2={150} y2={152} stroke={WIRE} strokeWidth={1} />
        <Line x1={60} y1={20} x2={60} y2={210} stroke={WIRE} strokeWidth={1} />
        <Line x1={90} y1={12} x2={90} y2={218} stroke={WIRE} strokeWidth={1} />
        <Line x1={120} y1={20} x2={120} y2={210} stroke={WIRE} strokeWidth={1} />

        {/* Orange V-shaped eyebrow markers with dots */}
        <Path d="M46,74 L60,58 L74,74" stroke={ORANGE} strokeWidth={2.5} fill="none" />
        <Path d="M106,74 L120,58 L134,74" stroke={ORANGE} strokeWidth={2.5} fill="none" />
        <Circle cx={46} cy={74} r={3} fill={ORANGE} />
        <Circle cx={60} cy={58} r={3.5} fill={ORANGE} />
        <Circle cx={74} cy={74} r={3} fill={ORANGE} />
        <Circle cx={106} cy={74} r={3} fill={ORANGE} />
        <Circle cx={120} cy={58} r={3.5} fill={ORANGE} />
        <Circle cx={134} cy={74} r={3} fill={ORANGE} />

        {/* Green lip outline */}
        <Path
          d="M62,158 Q90,172 118,158 Q90,168 62,158 Z"
          stroke={GREEN_LIP}
          strokeWidth={2}
          fill={GREEN_LIP}
          fillOpacity={0.12}
        />

        {/* Small orange accent dots near the nose */}
        <AnimatedCircle cx={83} cy={118} r={2.4} fill={ORANGE} animatedProps={noseDotProps} />
        <AnimatedCircle cx={97} cy={118} r={2.4} fill={ORANGE} animatedProps={noseDotProps} />
        <Circle cx={90} cy={128} r={2} fill={ORANGE} opacity={0.6} />

        {/* Slow scan-line sweep, clipped loosely to the oval's vertical span */}
        <AnimatedRect x={16} width={FACE_W - 32} height={3} fill={VIOLET} opacity={0.28} animatedProps={scanProps} />
      </Svg>
    </RNAnimated.View>
  );
}

// --- Hand HUD ---------------------------------------------------------

// Stylized open-hand skeleton: wrist + 5 fingers, each with base/mid/tip.
const WRIST = [82, 196];
const FINGERS = [
  { base: [42, 150], mid: [24, 116], tip: [12, 88] }, // thumb
  { base: [56, 100], mid: [50, 58], tip: [47, 22] }, // index
  { base: [78, 88], mid: [78, 42], tip: [78, 6] }, // middle
  { base: [100, 94], mid: [104, 52], tip: [106, 16] }, // ring
  { base: [118, 112], mid: [128, 76], tip: [134, 46] }, // pinky
];
const FLOATING_DOT = [64, 208];

function HandHUD({ startX, startY }) {
  const { pan, panResponder } = useDrag(startX, startY);
  const pulse = usePulse(1100);

  const tipProps = useAnimatedProps(() => ({ opacity: 0.55 + pulse.value * 0.45 }));
  const wristGlowProps = useAnimatedProps(() => ({ opacity: 0.3 + pulse.value * 0.5 }));

  return (
    <RNAnimated.View
      style={[styles.group, { width: HAND_W, height: HAND_H, transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}
    >
      <Svg width={HAND_W} height={HAND_H} viewBox={`0 0 ${HAND_W} ${HAND_H}`}>
        {/* Orange radiating lines from wrist to each finger base */}
        {FINGERS.map((f, i) => (
          <Line key={`radiate-${i}`} x1={WRIST[0]} y1={WRIST[1]} x2={f.base[0]} y2={f.base[1]} stroke={ORANGE} strokeWidth={1.4} opacity={0.7} />
        ))}

        {/* Finger segments: base -> mid -> tip, teal/green */}
        {FINGERS.map((f, i) => (
          <React.Fragment key={`seg-${i}`}>
            <Line x1={f.base[0]} y1={f.base[1]} x2={f.mid[0]} y2={f.mid[1]} stroke={TEAL} strokeWidth={1.8} />
            <Line x1={f.mid[0]} y1={f.mid[1]} x2={f.tip[0]} y2={f.tip[1]} stroke={TEAL} strokeWidth={1.8} />
          </React.Fragment>
        ))}

        {/* Joints: orange near wrist/base, green mid, blue tip */}
        <AnimatedCircle cx={WRIST[0]} cy={WRIST[1]} r={5} fill={ORANGE} animatedProps={wristGlowProps} />
        {FINGERS.map((f, i) => (
          <React.Fragment key={`dots-${i}`}>
            <Circle cx={f.base[0]} cy={f.base[1]} r={3.4} fill={ORANGE} />
            <Circle cx={f.mid[0]} cy={f.mid[1]} r={3.2} fill={TEAL} />
            <AnimatedCircle cx={f.tip[0]} cy={f.tip[1]} r={3.6} fill={BLUE} animatedProps={tipProps} />
          </React.Fragment>
        ))}

        {/* Guide lines trailing from the wrist to a floating dot below */}
        <Line x1={WRIST[0]} y1={WRIST[1]} x2={FLOATING_DOT[0]} y2={FLOATING_DOT[1]} stroke={ORANGE} strokeWidth={1.2} opacity={0.55} strokeDasharray="3,4" />
        <Line x1={WRIST[0] + 10} y1={WRIST[1] + 2} x2={FLOATING_DOT[0] + 22} y2={FLOATING_DOT[1] - 4} stroke={ORANGE} strokeWidth={1} opacity={0.4} strokeDasharray="2,5" />
        <AnimatedCircle cx={FLOATING_DOT[0]} cy={FLOATING_DOT[1]} r={2.6} fill={ORANGE} animatedProps={tipProps} />
      </Svg>
    </RNAnimated.View>
  );
}

// --- Public component ------------------------------------------------

export default function SciFiTrackingHUD({ width, height }) {
  const faceStartX = width ? width / 2 - FACE_W / 2 : 40;
  const faceStartY = height ? height * 0.14 : 30;
  const handStartX = width ? Math.max(8, width - HAND_W - 12) : 180;
  const handStartY = height ? height * 0.42 : 220;

  return (
    <View style={[styles.overlay, { width, height }]} pointerEvents="box-none">
      <FaceHUD startX={faceStartX} startY={faceStartY} />
      <HandHUD startX={handStartX} startY={handStartY} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  group: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
