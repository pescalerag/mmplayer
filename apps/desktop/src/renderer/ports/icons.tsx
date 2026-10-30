import React from "react";
import { Text } from "react-native";
import ionicons from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json";
import material from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json";
import "./icons.css";
function icon(glyphMap: Record<string, number>, family: string) {
  const Icon = ({ name, size = 20, color, style, ...props }: any) => (
    <Text
      {...props}
      selectable={false}
      style={[
        { fontFamily: family, fontSize: size, color, lineHeight: size },
        style,
      ]}
    >
      {String.fromCodePoint(
        glyphMap[name] || glyphMap["help-circle-outline"] || 63,
      )}
    </Text>
  );
  Icon.glyphMap = glyphMap;
  return Icon;
}
export const Ionicons = icon(ionicons, "Ionicons");
export const MaterialCommunityIcons = icon(material, "MaterialCommunityIcons");
