const router = require("express").Router();
const { showCreate, addUser} = require('../controller/pageController');
const { addUser } = require('../controller/user');
const { verifyEmail } = require('../controller/user');

router.get('/', showCreate);
//router.get('/VerifyEmail', verifyEmail);
//router.post('/', addUser);

module.exports = router;