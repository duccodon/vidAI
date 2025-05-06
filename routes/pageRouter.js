const router = require("express").Router();
const { showHomepage, genScript, genAudio } = require('../controller/pageController');

router.get('/', showHomepage);
router.post('/api/generate-script', genScript);
router.post('/api/generate-audio', genAudio);
  

module.exports = router;