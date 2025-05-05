const router = require("express").Router();
const { showProfile, updateProfile } = require('../controller/pageController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/', showProfile);
router.post('/update', upload.single('profilePicture'), updateProfile);

module.exports = router;