const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { signup, login, getMe } = require('../controllers/authController');

// Public routes
router.post('/signup', signup);
router.post('/login', login);

// Protected routes
router.get('/me', authenticate, getMe);

module.exports = router;
