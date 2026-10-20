import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

export function useUnsavedDocument(dirty: boolean) {
    const navigation = useNavigation();
    const { t } = useTranslation();
    usePreventRemove(dirty, ({ data }) => {
        Alert.alert(t('actions.warning'), t('lyrics.unsaved_warning'), [
            { text: t('actions.cancel'), style: 'cancel' },
            { text: t('actions.discard'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
        ]);
    });
}
