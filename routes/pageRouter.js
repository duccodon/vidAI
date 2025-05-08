const router = require("express").Router();
const { showHomepage, genScript, genAudio } = require('../controller/pageController');
const { uploadRecording } = require('../utils/recordings');

router.get('/', showHomepage);
router.post('/api/generate-script', genScript);
router.post('/api/generate-audio', genAudio);

router.post('/upload-recording', uploadRecording);  

module.exports = router;