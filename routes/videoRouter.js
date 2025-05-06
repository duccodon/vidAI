const router = require("express").Router();
const {showVideo} = require('../controller/pageController');
const {videoSync, exportVideo, renderVideo} = require('../controller/videoUpload');


router.get('/', showVideo);
router.post('/video-sync', videoSync); //use this route to upload video to cloudinary and save to DB

router.post('/api/render', renderVideo); 
router.post('/api/export', exportVideo);
  
module.exports = router;

