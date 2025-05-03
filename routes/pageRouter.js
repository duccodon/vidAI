const router = require("express").Router();
const { showHomepage } = require('../controller/pageController');

router.get('/', showHomepage);

module.exports = router;