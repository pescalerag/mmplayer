import { useSheetProps } from '@/hooks/useSheetProps';
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { scheduleOnRN } from "react-native-worklets";
import ColorPicker, {
  HueSlider,
  Panel1,
  Swatches,
} from "reanimated-color-picker";
import { TagService } from "../../services/tagService";

import { useToastStore } from "../../store/useToastStore";
import { getDynamicTagTextColor } from "../../utils/color";

const COLOR_PALETTE = [
  "#8B5CF6", // Violeta (Default)
  "#3B82F6", // Azul
  "#10B981", // Verde
  "#F59E0B", // Ámbar
  "#EF4444", // Rojo
  "#EC4899", // Rosa
  "#06B6D4", // Cian
];

export default function TagFormModal() {
  const { isVisible, props: { tag, onSaveCallback }, close: closeForm } = useSheetProps<{ tag: any; onSaveCallback: (() => void) | null }>('tag-form');
  const { t } = useTranslation();

  const [tagName, setTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [customColorMode, setCustomColorMode] = useState(false);
  const [customHexCode, setCustomHexCode] = useState("");

  // Bridge from UI thread (worklet) → JS thread for setState
  const setHexOnJS = (hex: string) => setCustomHexCode(hex);

  useEffect(() => {
    if (isVisible) {
      setTagName(tag ? tag.name : "");
      const isPaletteColor = tag ? COLOR_PALETTE.includes(tag.color) : true;
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
        setSelectedColor(COLOR_PALETTE[0]);
        setCustomColorMode(false);
        setCustomHexCode("");
      }
    }
  }, [isVisible, tag]);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>
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
      <Text style={styles.sectionTitle}>
        {t('tags.color')}
      </Text>
      <View style={styles.colorRow}>
        {COLOR_PALETTE.slice(0, 5).map((color) => {
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
              { backgroundColor: customHexCode || "#8B5CF6" },
            ]}
            onPress={() => {
              if (customHexCode) setSelectedColor(customHexCode);
              setCustomColorMode(false);
            }}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={getDynamicTagTextColor(customHexCode || "#8B5CF6")}
            />
            <Text
              style={[
                styles.confirmColorText,
                {
                  color: getDynamicTagTextColor(customHexCode || "#8B5CF6"),
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#282828",
    paddingBottom: 15,
  },
  headerTitle: {
    color: "#8B5CF6",
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
    backgroundColor: "#1A1A1A",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
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
