const router = require("express").Router();
const { showProfile} = require('../controller/pageController');

router.get('/', showProfile);

module.exports = router;