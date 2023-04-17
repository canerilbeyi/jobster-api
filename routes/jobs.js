const express = require("express");

const router = express.Router();
const {
  createJob,
  deleteJob,
  getAllJobs,
  updateJob,
  getJob,
  showStats,
} = require("../controllers/jobs");
const testUser = require("../middleware/testUser");

router.route("/").post(testUser, createJob).get(getAllJobs);

// router.get is my preference
router.get("/stats", showStats);

router
  .route("/:id")
  .get(getJob)
  .delete(testUser, deleteJob)
  .patch(testUser, updateJob);

module.exports = router;
