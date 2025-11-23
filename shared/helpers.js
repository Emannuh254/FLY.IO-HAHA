const { body, validationResult } = require('express-validator');

// Validate request and handle errors
const validateRequest = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

// Validation schemas
const validationSchemas = {
  signup: [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
    body('country').optional().isLength({ min: 2 }).withMessage('Country must be at least 2 characters'),
    body('currency').optional().isIn(['KSH', 'USD']).withMessage('Currency must be KSH or USD'),
  ],
  login: [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  deposit: [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('method').notEmpty().withMessage('Deposit method is required'),
    body('currency').isIn(['KSH', 'USD']).withMessage('Currency must be KSH or USD'),
  ],
  withdraw: [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('method').notEmpty().withMessage('Withdrawal method is required'),
    body('currency').isIn(['KSH', 'USD']).withMessage('Currency must be KSH or USD'),
    body('address').notEmpty().withMessage('Withdrawal address is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  createBot: [
    body('name').notEmpty().withMessage('Bot name is required'),
    body('investment').isFloat({ gt: 0 }).withMessage('Investment must be greater than 0'),
  ],
  updateProgress: [
    body('progress').isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
  ],
  adminLogin: [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').trim().notEmpty().withMessage('Password is required'),
  ],
  updateTransaction: [
    body('status').isIn(['pending', 'completed', 'failed']).withMessage('Invalid status'),
  ],
  adminDeposit: [
    body('userId').isInt().withMessage('Valid user ID is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('currency').isIn(['KSH', 'USD']).withMessage('Currency must be KSH or USD'),
  ],
  updateUserBalance: [
    body('balance').isFloat({ min: 0 }).withMessage('Balance must be a positive number'),
  ],
  updateDepositAddress: [
    body('coin').isIn(['USDT', 'BTC', 'ETH']).withMessage('Invalid coin'),
    body('network').isIn(['BSC', 'ETH', 'BTC']).withMessage('Invalid network'),
    body('address').isLength({ min: 10 }).withMessage('Address is too short'),
  ]
};

module.exports = {
  validateRequest,
  validationSchemas
};