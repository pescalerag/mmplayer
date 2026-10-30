import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

// These callers immediately copy the selection to app-owned storage. Android's
// FileSystem.copyAsync supports content://, so a picker cache copy is redundant.
export function pickDocumentForCopy(type: string | string[]) {
    return DocumentPicker.getDocumentAsync({
        type,
        copyToCacheDirectory: Platform.OS !== 'android',
    });
}
