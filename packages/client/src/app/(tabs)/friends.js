import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Screen from '../../components/Screen';
import { Colors, FontSize } from '../../../constants/design';

export default function FriendsScreen() {
  const { t } = useTranslation('friends');

  return (
    <Screen style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: Colors.text.primary, fontSize: FontSize.bodyL }}>
        {t('coming_soon')}
      </Text>
    </Screen>
  );
}
