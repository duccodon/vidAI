const router = require("express").Router();
const { showHomepage, genScript, genAudio, genImage, genVideo } = require('../controller/pageController');
const { uploadRecording } = require('../utils/recordings');

router.get('/', showHomepage);
router.post('/api/generate-script', genScript);
router.post('/api/generate-audio', genAudio);

router.post('/upload-recording', uploadRecording);  

router.post('/api/generate-video', genVideo);
router.post('/api/generate-image', genImage);

module.exports = router;