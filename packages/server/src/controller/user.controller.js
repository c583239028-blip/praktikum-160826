//     ניהול פרופיל המשתמש — שליפת יתרה וניקוד, עדכון פרטים אישיים
import { BirthdaySchema } from '@worldplay/shared';
import userService from '../services/user.service.js';
import prisma from '../lib/prisma.js';

export const getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        dateOfBirth: true,
        walletBalance: true,
        participations: {
          where: { game: { status: 'ACTIVE' } },
          select: { gameId: true, score: true },
        },
      },
    });

    if (!userProfile) return res.status(404).json({ message: 'משתמש לא נמצא' });

    const scoresByGame = {};
    userProfile.participations.forEach((p) => {
      scoresByGame[p.gameId] = Number(p.score);
    });

    res.json({
      id: userProfile.id,
      username: userProfile.username,
      email: userProfile.email,
      dateOfBirth: userProfile.dateOfBirth,
      walletCoins: Number(userProfile.walletBalance),
      scoresByGame,
    });
  } catch (error) {
    console.error('Error in getMe:', error);
    res.status(500).json({ message: 'שגיאה פנימית בשרת' });
  }
};

export const updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedUser = await userService.updateUserProfile(userId, req.body);
    res.json({ message: 'הפרטים עודכנו בהצלחה', user: updatedUser });
  } catch (error) {
    if (error.message === 'PHONE_EXISTS') {
      return res
        .status(400)
        .json({ message: 'מספר הטלפון כבר קיים במערכת למשתמש אחר' });
    }
    console.error(error);
    res.status(500).json({ message: 'שגיאה בעדכון פרטים' });
  }
};

export const updateBirthday = async (req, res) => {
  const result = BirthdaySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: result.error.issues[0].message });
  }

  try {
    const updatedUser = await userService.updateBirthday(
      req.user.id,
      new Date(result.data.dateOfBirth)
    );

    res.json(updatedUser);
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }
    console.error('Error in updateBirthday:', error);
    res.status(500).json({ message: 'שגיאה פנימית בשרת' });
  }
};
