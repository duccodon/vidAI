const router = require("express").Router();
const { showVideo } = require("../controller/pageController");
const { videoSync, exportVideo, renderVideo, authYouTube, handleYouTubeCallback, uploadToYouTube, mergeAudio, deleteVideo } = require("../controller/videoUpload");

router.get("/", showVideo);
router.post("/video-sync", videoSync);
router.post("/api/render", renderVideo);
router.post("/api/export", exportVideo);
router.get("/auth/youtube", authYouTube);
router.get("/google/callback", handleYouTubeCallback); 
router.post("/api/upload-youtube", uploadToYouTube);
router.post("/api/merge-audio", mergeAudio);
router.delete("/api/delete-video/:videoId", deleteVideo);
module.exports = router;