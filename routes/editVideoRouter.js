const router = require("express").Router();
const { showEditVideo} = require('../controller/pageController');

router.get('/', showEditVideo);

module.exports = router;