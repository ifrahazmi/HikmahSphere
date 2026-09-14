import { Request, Response } from 'express';
import User from '../models/User';
import { applyTemporaryPasswordReset, validateTemporaryPassword } from '../utils/temporaryPassword';

type AuthedRequest = Request & {
  user?: { userId?: string };
};

export const resetUserPasswordHandler = async (req: AuthedRequest, res: Response) => {
  try {
    if (req.params.id === req.user?.userId) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot reset your own password this way.',
      });
    }

    const validationError = validateTemporaryPassword(req.body?.temporaryPassword);
    if (validationError) {
      return res.status(400).json({ status: 'error', message: validationError });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    await applyTemporaryPasswordReset(user, String(req.body.temporaryPassword).trim());

    return res.json({
      status: 'success',
      message: 'Temporary password set. The user must log in and choose a new password.',
    });
  } catch (error: any) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};
