const router = require("express").Router();
const {showVideo} = require('../controller/pageController');
const {uploadVideo} = require('../controller/videoUpload');

router.get('/', showVideo);
router.get('/videos', uploadVideo); //use this route to upload video to cloudinary and save to DB


module.exports = router;