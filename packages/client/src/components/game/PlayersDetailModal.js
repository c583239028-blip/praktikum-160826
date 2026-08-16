import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, Image } from 'react-native';
import PropTypes from 'prop-types';
import { Colors, Spacing, BorderRadius, TextStyles } from '../../../constants/design';
import XSvg from '../../../assets/icons/x.svg';

export function PlayersDetailModal({ visible, players, onClose, onTogglePlayer }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
               <XSvg width={24} height={24} color={Colors.neutral[100]} />
          </TouchableOpacity>
        <FlatList
  data={players}
  numColumns={2}
  keyExtractor={(item) => item.id}
  columnWrapperStyle={{ gap: Spacing.lg }} // spacing/lg ✓ (12px) - רווח בין העמודות
  contentContainerStyle={{ gap: Spacing.md }} // spacing/md ✓ (8px) - רווח בין השורות
            renderItem={({ item }) => (
  <View style={styles.row}>
    <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
    <View style={{ flex: 1 }}>
      <Text style={[TextStyles.bodyMMedium, { color: Colors.surface.white }]}>
        {item.name}
      </Text>
      <Text style={[TextStyles.captionRegular, { color: Colors.surface.white }]}>
        🎁 {item.count ?? 0}
      </Text>
    </View>
    <TouchableOpacity
      onPress={() => onTogglePlayer(item.id)}
      disabled={item.isActive} // isActive = true → כבר עוקב → disabled (לפי הבהרת המנחה)
      style={[
        styles.plusBtn,
        // isActive true = כבר עוקב → אפור (disabled) | false = לא עוקב עדיין → כחול (פעיל)
        { backgroundColor: item.isActive ? Colors.neutral[300] : Colors.primary.default },
      ]}
    >
      <Text style={[TextStyles.bodyMMedium, { color: Colors.surface.white }]}>+</Text>
    </TouchableOpacity>
  </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', // היה 'flex-end' - זה מה שגרם לפאנל "לעלות מלמטה"
    alignItems: 'center',
  },
  sheet: {
    // תוקן לפי הפיגמה: פאנל צף וממורכז (284×280), לא bottom-sheet ברוחב מלא
    width: 284,
    maxHeight: 280,
    backgroundColor: 'rgba(31, 41, 59, 0.7)', // Colors.neutral[900] @ 70% - אין טוקן שקיפות ב-design.js
    borderRadius: BorderRadius.md, // border-radius/md ✓ (16px)
    padding: Spacing.lg, // spacing/lg ✓ (12px)
  },
  closeBtn: { alignSelf: 'flex-end', padding: Spacing.sm },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', // רקע ה"כרטיס" - לפי הפילה הכהה סביב כל שחקן בתמונה
    borderRadius: BorderRadius.full, // 32px ✓ - Hug width + Radius מהפיגמה = צורת פילה מלאה
    padding: Spacing.sm, // padding: 4 לפי image3 ✓
    gap: Spacing.xs, // gap: 4px בין האווטאר לטקסט, לפי Layer properties
  },
  avatar: {
    width: 32, // לפי layer tree: avatar 32×32
    height: 32,
    borderRadius: BorderRadius.full,
  },
  plusBtn: {
    width: 24, // לפי image2 (icon-button Fixed 24×24)
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
};

PlayersDetailModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  players: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      avatarUrl: PropTypes.string,
      count: PropTypes.number,
      isActive: PropTypes.bool,
    })
  ).isRequired,
  onClose: PropTypes.func.isRequired,
  onTogglePlayer: PropTypes.func.isRequired,
};
