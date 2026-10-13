import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { pickDocumentForCopy } from '../services/DocumentPickerService';

describe('document selections copied to app storage', () => {
    afterEach(() => { (Platform as any).OS = 'android'; jest.clearAllMocks(); });

    it.each(['application/json', 'image/*'])('launches %s immediately without a redundant cache copy on Android', async type => {
        (Platform as any).OS = 'android';
        (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'content://provider/document/123', name: 'file.png' }] });
        const result = pickDocumentForCopy(type);
        expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({ type, copyToCacheDirectory: false });
        expect((await result).assets?.[0].uri).toBe('content://provider/document/123');
    });

    it('keeps a readable cache file on iOS', async () => {
        (Platform as any).OS = 'ios';
        await pickDocumentForCopy('image/*');
        expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({ type: 'image/*', copyToCacheDirectory: true });
    });

    it('returns cancellation without starting a persistence operation', async () => {
        (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: null });
        expect(await pickDocumentForCopy('application/json')).toEqual({ canceled: true, assets: null });
    });
});
