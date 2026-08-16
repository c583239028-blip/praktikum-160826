// packages/client/src/_dev/QuestionCardPreview.js
import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import QuestionCard from '../components/game/QuestionCard';
import { Colors } from '../../constants/design';

export default function QuestionCardPreview() {
  const mockQuestion = {
    id: 'q1',
    questionText: 'Who will win the game?',
    options: [
      { id: 'o1', text: 'Player 1 sitting to the right with a white hat?' },
      { id: 'o2', text: 'Player 1 sitting to the right with a white hat?' },
      { id: 'o3', text: 'Player 1 sitting to the right with a white hat?' },
      { id: 'o4', text: 'Player 1 sitting to the right with a white hat?' },
    ],
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <QuestionCard
        question={mockQuestion}
        onWager={(optionId) => console.log('Wager placed on option:', optionId)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.dark,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 291,
    paddingBottom: 32,
  },
});
