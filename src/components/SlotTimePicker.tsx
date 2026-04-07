import React, {useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
} from 'react-native';

const ITEM_HEIGHT = 54;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const REPEAT = 3;
const HOURS_DATA = Array.from({length: 24 * REPEAT}, (_, i) => i % 24);
const MINUTES_DATA = Array.from({length: 60 * REPEAT}, (_, i) => i % 60);

interface SlotTimePickerProps {
  value: string;
  onChange: (value: string) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

interface SlotColumnProps {
  data: number[];
  dataLength: number;
  selected: number;
  onSelect: (value: number) => void;
}

function AnimatedSlotColumn({
  data,
  dataLength,
  selected,
  onSelect,
}: SlotColumnProps) {
  const scrollRef = useRef<any>(null);
  const lastSettled = useRef(selected);
  const didLayout = useRef(false);
  const isScrolling = useRef(false);

  const scrollAnim = useRef(
    new Animated.Value((dataLength + selected) * ITEM_HEIGHT),
  ).current;

  const onScrollEvent = useMemo(
    () =>
      Animated.event([{nativeEvent: {contentOffset: {y: scrollAnim}}}], {
        useNativeDriver: true,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          // Keep track of raw scroll for snap correction
        },
      }),
    [scrollAnim],
  );

  const handleLayout = useCallback(
    (_e: LayoutChangeEvent) => {
      if (didLayout.current) return;
      didLayout.current = true;

      const y = (dataLength + selected) * ITEM_HEIGHT;
      scrollRef.current?.scrollTo({y, animated: false});
    },
    [dataLength, selected],
  );

  const snapToNearest = useCallback(
    (y: number) => {
      const index = Math.round(y / ITEM_HEIGHT);
      const snappedY = index * ITEM_HEIGHT;

      // Force snap if not already aligned
      if (Math.abs(y - snappedY) > 1) {
        scrollRef.current?.scrollTo({y: snappedY, animated: true});
      }

      const value = data[index];
      if (value !== undefined && value !== lastSettled.current) {
        lastSettled.current = value;
        onSelect(value);
      }

      // Wrap to middle repeat if in first or last
      if (index < dataLength || index >= dataLength * 2) {
        const middleY = (dataLength + (value ?? 0)) * ITEM_HEIGHT;
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({y: middleY, animated: false});
        });
      }
    },
    [data, dataLength, onSelect],
  );

  const handleScrollBegin = useCallback(() => {
    isScrolling.current = true;
  }, []);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isScrolling.current = false;
      snapToNearest(e.nativeEvent.contentOffset.y);
    },
    [snapToNearest],
  );

  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      // If velocity is near zero, momentum won't fire — snap manually
      const v = e.nativeEvent.velocity?.y ?? 0;
      if (Math.abs(v) < 0.5) {
        isScrolling.current = false;
        snapToNearest(e.nativeEvent.contentOffset.y);
      }
      // Otherwise onMomentumScrollEnd will handle it
    },
    [snapToNearest],
  );

  const items = useMemo(
    () =>
      data.map((value, index) => {
        const centeredScrollY = index * ITEM_HEIGHT;

        const opacity = scrollAnim.interpolate({
          inputRange: [
            centeredScrollY - ITEM_HEIGHT * 1.5,
            centeredScrollY - ITEM_HEIGHT,
            centeredScrollY,
            centeredScrollY + ITEM_HEIGHT,
            centeredScrollY + ITEM_HEIGHT * 1.5,
          ],
          outputRange: [0.2, 0.45, 1, 0.45, 0.2],
          extrapolate: 'clamp',
        });

        const scale = scrollAnim.interpolate({
          inputRange: [
            centeredScrollY - ITEM_HEIGHT * 1.5,
            centeredScrollY - ITEM_HEIGHT,
            centeredScrollY,
            centeredScrollY + ITEM_HEIGHT,
            centeredScrollY + ITEM_HEIGHT * 1.5,
          ],
          outputRange: [0.6, 0.75, 1, 0.75, 0.6],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.item,
              {opacity, transform: [{scale}]},
            ]}>
            <Text style={styles.itemText}>{pad(value)}</Text>
          </Animated.View>
        );
      }),
    [data, scrollAnim],
  );

  // Pre-compute snap offsets for precise snapping
  const snapOffsets = useMemo(
    () => data.map((_, i) => i * ITEM_HEIGHT),
    [data],
  );

  return (
    <View style={styles.columnContainer}>
      <View style={styles.highlightBar} />
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{paddingVertical: ITEM_HEIGHT}}
        onLayout={handleLayout}
        showsVerticalScrollIndicator={false}
        snapToOffsets={snapOffsets}
        decelerationRate="fast"
        onScroll={onScrollEvent}
        scrollEventThrottle={16}
        onScrollBeginDrag={handleScrollBegin}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumEnd}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled>
        {items}
      </Animated.ScrollView>
    </View>
  );
}

export function SlotTimePicker({value, onChange}: SlotTimePickerProps) {
  const [hours, minutes] = (value || '06:00').split(':').map(Number);

  const handleHourChange = useCallback(
    (h: number) => {
      onChange(`${pad(h)}:${pad(minutes)}`);
    },
    [minutes, onChange],
  );

  const handleMinuteChange = useCallback(
    (m: number) => {
      onChange(`${pad(hours)}:${pad(m)}`);
    },
    [hours, onChange],
  );

  return (
    <View style={styles.container}>
      <AnimatedSlotColumn
        data={HOURS_DATA}
        dataLength={24}
        selected={hours}
        onSelect={handleHourChange}
      />
      <View style={styles.separatorContainer}>
        <Text style={styles.separator}>:</Text>
      </View>
      <AnimatedSlotColumn
        data={MINUTES_DATA}
        dataLength={60}
        selected={minutes}
        onSelect={handleMinuteChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: PICKER_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  columnContainer: {
    width: 90,
    height: PICKER_HEIGHT,
    overflow: 'hidden',
  },
  scrollView: {
    height: PICKER_HEIGHT,
  },
  highlightBar: {
    position: 'absolute',
    top: ITEM_HEIGHT,
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    zIndex: 0,
    pointerEvents: 'none',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f59e0b',
    fontVariant: ['tabular-nums'],
  },
  separatorContainer: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    fontSize: 36,
    fontWeight: '700',
    color: '#f59e0b',
  },
});
