import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { birthdayService } from '../../services/birthday.service';
import BirthdayModal from '../../components/BirthdayModal';

export default function ViewerScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user, isLoading, updateUser } = useAuth();
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const checkBirthday = useCallback(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    const shouldShow = birthdayService.shouldShowPopup(user);
    if (shouldShow) {
      setShowBirthdayModal(true);
    } else {
      setIsReady(true);
    }
  }, [user, router]);
  useEffect(() => {
    if (!isLoading) {
      checkBirthday();
    }
  }, [isLoading, user, checkBirthday]);

  const handleBirthdayConfirm = async (dateOfBirth) => {
    try {
      const updatedUser = await birthdayService.saveBirthday(dateOfBirth);
      updateUser(updatedUser);
      setShowBirthdayModal(false);
      setIsReady(true);
    } catch (error) {
      alert('שמירת תאריך הלידה נכשלה. נסי שוב.');
      console.error('Failed to save birthday:', error.message);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BirthdayModal
        visible={showBirthdayModal}
        onConfirm={handleBirthdayConfirm}
        onRequestClose={() => {}}
      />

      {!isReady ? (
        <ActivityIndicator size="large" color="#06b6d4" />
      ) : (
        <View style={styles.streamContainer}>
          <Text style={styles.text}>Stream ID: {id}</Text>
          {/* TODO: הוסיפי כאן את רכיב השידור */}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  streamContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
  },
});
