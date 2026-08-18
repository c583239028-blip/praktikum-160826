import { ERROR_MESSAGES } from '@worldplay/shared';
import chatService from '../services/chat.service.js';

export const getChatHistory = async (req, res) => {
  const { otherUserId } = req.params;
  const myUserId = req.user.id;

  if (!myUserId || !otherUserId) {
    return res
      .status(400)
      .json({ success: false, message: ERROR_MESSAGES.MISSING_USER_IDS });
  }

  try {
    const history = await chatService.fetchChatHistory(myUserId, otherUserId);

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error in getChatHistory:', error);
    res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.FAILED_TO_RETRIEVE_CHAT_HISTORY,
    });
  }
};

export const sendMessageAPI = async (req, res) => {
  const senderId = req.user.id;
  const { receiverId, messageText } = req.body;

  if (!senderId || !receiverId || !messageText) {
    return res.status(400).json({
      success: false,
      message: ERROR_MESSAGES.MISSING_REQUIRED_FIELDS,
    });
  }

  try {
    const newMessage = await chatService.createChatMessage(
      senderId,
      receiverId,
      messageText
    );

    res.status(201).json({ success: true, data: newMessage });
  } catch (error) {
    console.error('Error in sendMessageAPI:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
