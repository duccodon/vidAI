const router = require("express").Router();
const { showHomepage, genScript } = require('../controller/pageController');

router.get('/', showHomepage);
router.post('/api/generate-script', genScript);
  

module.exports = router;