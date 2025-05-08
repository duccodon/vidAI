const router = require("express").Router();
const { showVideo } = require("../controller/pageController");
const { videoSync, exportVideo, renderVideo, authYouTube, handleYouTubeCallback, uploadToYouTube } = require("../controller/videoUpload");

router.get("/", showVideo);
router.post("/video-sync", videoSync);
router.post("/api/render", renderVideo);
router.post("/api/export", exportVideo);
router.get("/auth/youtube", authYouTube);
router.get("/google/callback", handleYouTubeCallback); 
router.post("/api/upload-youtube", uploadToYouTube);

module.exports = router;