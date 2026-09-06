import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Animated,
  BackHandler,
  Dimensions,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { scheduleOnRN } from "react-native-worklets";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ColorPicker, {
  HueSlider,
  Panel1,
  Swatches,
} from "reanimated-color-picker";
import { TagService } from "../../services/tagService";
import { useTagFormStore } from "../../store/useTagFormStore";
import { useToastStore } from "../../store/useToastStore";
import { getDynamicTagTextColor } from "../../utils/color";
import { useAppTheme } from "../../hooks/useAppTheme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const BASE_PALETTE = [
  "#3B82F6", // Azul
  "#10B981", // Verde
  "#F59E0B", // Ámbar
  "#EF4444", // Rojo
  "#EC4899", // Rosa
  "#06B6D4", // Cian
];

export default function TagFormModal() {
  const { colors } = useAppTheme();
  const { isVisible, tag, closeForm, onSaveCallback, setColorRowRef } = useTagFormStore();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const colorPalette = useMemo(() => [colors.accent, ...BASE_PALETTE], [colors.accent]);

  const [tagName, setTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(colors.accent);
  const [customColorMode, setCustomColorMode] = useState(false);
  const [customHexCode, setCustomHexCode] = useState("");

  const colorRowRef = useRef<View>(null);
  useEffect(() => {
    setColorRowRef(colorRowRef);
  }, [setColorRowRef]);

  // Animaciones
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  const slideTranslateY = useSharedValue(SCREEN_HEIGHT);
  const dragTranslateY = useSharedValue(0);

  // Bridge from UI thread (worklet) → JS thread for setState
  const setHexOnJS = (hex: string) => setCustomHexCode(hex);

  const performCloseForm = React.useCallback(() => {
    closeForm();
  }, [closeForm]);

  const handlePanGesture = Gesture.Pan()
    .activeOffsetY(5)
    .onUpdate((event) => {
      if (event.translationY > 0) {
        dragTranslateY.value = event.translationY;
      } else {
        dragTranslateY.value = 0;
      }
    })
    .onEnd((event) => {
      const DISMISS_THRESHOLD = 90;
      if (event.translationY > DISMISS_THRESHOLD || event.velocityY > 500) {
        dragTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 180 }, (finished) => {
          if (finished) {
            runOnJS(performCloseForm)();
          }
        });
      } else {
        dragTranslateY.value = withSpring(0, { damping: 25, stiffness: 150 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideTranslateY.value + dragTranslateY.value }],
  }));

  useEffect(() => {
    if (isVisible) {
      setTagName(tag ? tag.name : "");
      const isPaletteColor = tag ? colorPalette.includes(tag.color) : true;
      if (tag) {
        setSelectedColor(tag.color);
        if (isPaletteColor) {
          setCustomColorMode(false);
          setCustomHexCode("");
        } else {
          setCustomColorMode(false);
          setCustomHexCode(tag.color);
        }
      } else {
        setSelectedColor(colors.accent);
        setCustomColorMode(false);
        setCustomHexCode("");
      }

      dragTranslateY.value = 0;
      slideTranslateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.8 });

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      slideTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 });
    }
  }, [isVisible, tag, fadeAnim, slideTranslateY, dragTranslateY]);

  // Manejar botón físico de atrás en Android
  useEffect(() => {
    if (!isVisible) return;
    const onBackPress = () => {
      closeForm();
      return true;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [isVisible, closeForm]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeight, {
        toValue: e.endCoordinates.height,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [keyboardHeight]);

  const handleSave = async () => {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    try {
      const normalizedInput = trimmed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const allTags = await TagService.getAllTags();
      const duplicateExists = allTags.some(t => {
        const isSameNormalized = t.normalizedName === normalizedInput;
        if (tag) {
          return isSameNormalized && t.id !== tag.id;
        }
        return isSameNormalized;
      });

      if (duplicateExists) {
        useToastStore.getState().showToast(t('toasts.tag_already_exists'), 'close-circle', '#EF4444');
        return;
      }

      const finalColor =
        customColorMode && customHexCode ? customHexCode : selectedColor;
      if (tag) {
        await TagService.updateTag(tag.id, trimmed, finalColor);
      } else {
        await TagService.createTag(trimmed, finalColor);
      }
      Keyboard.dismiss();
      if (onSaveCallback) onSaveCallback();
      closeForm();
    } catch (e) {
      console.error("Error guardando tag:", e);
    }
  };

  const [shouldRender, setShouldRender] = useState(isVisible);
  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender && !isVisible) return null;

  return (
    <View
      style={[styles.containerAbsolute, { zIndex: 10000 }]}
      pointerEvents={isVisible ? "auto" : "none"}
    >
      {/* Fondo oscuro animado */}
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          closeForm();
        }}
      >
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Contenedor del bottom sheet */}
      <Animated.View
        style={[styles.keyboardAvoid, { paddingBottom: keyboardHeight }]}
        pointerEvents="box-none"
      >
        <AnimatedReanimated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: insets.bottom + 20,
            },
            customColorMode && { minHeight: 560 },
            sheetAnimatedStyle,
          ]}
        >
          <GestureDetector gesture={handlePanGesture}>
            <View style={styles.handleContainer}>
              <View style={styles.dragIndicator} />
            </View>
          </GestureDetector>

          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.accent }]} numberOfLines={1}>
              {t('tags.manager')}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {tag ? t('tags.edit') : t('tags.create_tag')}
            </Text>
          </View>

          {/* Nombre de la etiqueta */}
          <Text style={styles.sectionTitle}>{t('tags.name')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('tags.placeholder_name')}
            placeholderTextColor="#666"
            value={tagName}
            onChangeText={setTagName}
            maxLength={25}
            autoCorrect={false}
          />

          {/* Selector de Color */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
            {t('tags.color')}
          </Text>
          <View ref={colorRowRef} collapsable={false} style={styles.colorRow}>
            {colorPalette.slice(0, 5).map((color) => {
              const isSelected = !customColorMode && selectedColor === color;
              return (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    isSelected && styles.colorOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedColor(color);
                    setCustomColorMode(false);
                  }}
                >
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={getDynamicTagTextColor(color)}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[
                styles.colorOption,
                { backgroundColor: "#333" },
                customColorMode && styles.colorOptionSelected,
              ]}
              onPress={() => setCustomColorMode(true)}
            >
              <Ionicons name="color-palette" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>

          {customColorMode && (
            <View style={styles.colorPickerOverlay}>
              {/* Header: preview dot + hex label */}
              <View style={styles.pickerHeader}>
                <View
                  style={[
                    styles.pickerPreviewDot,
                    { backgroundColor: customHexCode || "#FFFFFF" },
                  ]}
                />
                <Text style={styles.pickerHexLabel}>
                  {customHexCode
                    ? customHexCode.toUpperCase()
                    : t('tags.select_color')}
                </Text>
              </View>

              <ColorPicker
                style={{ width: "100%", justifyContent: "center" }}
                value={customHexCode || "#FFFFFF"}
                onComplete={(result: { hex: string }) => {
                  "worklet";
                  scheduleOnRN(setHexOnJS, result.hex);
                }}
              >
                <Panel1 />
                <HueSlider style={{ marginTop: 15 }} />
                <Swatches style={{ marginTop: 15 }} />
              </ColorPicker>

              {/* Confirm button */}
              <TouchableOpacity
                style={[
                  styles.confirmColorButton,
                  { backgroundColor: customHexCode || colors.accent },
                ]}
                onPress={() => {
                  if (customHexCode) setSelectedColor(customHexCode);
                  setCustomColorMode(false);
                }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={getDynamicTagTextColor(customHexCode || colors.accent)}
                />
                <Text
                  style={[
                    styles.confirmColorText,
                    {
                      color: getDynamicTagTextColor(customHexCode || colors.accent),
                    },
                  ]}
                >
                  {t('tags.confirm_color')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botón de guardar/crear */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: selectedColor },
              !tagName.trim() && { opacity: 0.5 },
            ]}
            onPress={handleSave}
            disabled={!tagName.trim()}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: getDynamicTagTextColor(selectedColor) },
              ]}
            >
              {tag ? t('actions.save_changes') : t('tags.create_tag')}
            </Text>
          </TouchableOpacity>
        </AnimatedReanimated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  containerAbsolute: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#121212",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderTopWidth: 1,
    borderColor: "#282828",
  },
  handleContainer: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -12,
    marginBottom: 8,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    alignSelf: "center",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#282828",
    paddingBottom: 15,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Montserrat",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Montserrat",
    fontWeight: "800",
    marginTop: 4,
  },
  sectionTitle: {
    color: "#888",
    fontSize: 12,
    fontFamily: "Montserrat",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  colorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  colorPickerOverlay: {
    position: "absolute",
    bottom: 70,
    left: 24,
    right: 24,
    zIndex: 999,
    backgroundColor: "#1A1A1A",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 20,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginBottom: 12,
    gap: 10,
  },
  pickerPreviewDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#444",
  },
  pickerHexLabel: {
    color: "#CCC",
    fontFamily: "Montserrat",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 1,
  },
  confirmColorButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmColorText: {
    color: "#FFF",
    fontFamily: "Montserrat",
    fontWeight: "800",
    fontSize: 14,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorOptionSelected: {
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.1 }],
  },
  input: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    height: 48,
    color: "#FFFFFF",
    fontFamily: "Montserrat",
    fontWeight: '600',
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 15,
  },
  primaryButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "Montserrat",
    fontWeight: "800",
    fontSize: 14,
  },
});
