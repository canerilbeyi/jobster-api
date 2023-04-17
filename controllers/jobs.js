const Job = require("../models/Job");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");
const mongoose = require("mongoose");
const moment = require("moment");

const getAllJobs = async (req, res) => {
  const { search, status, jobType, sort } = req.query;

  const queryObject = {
    createdBy: req.user.userId,
  };

  if (search) {
    queryObject.position = { $regex: search, $options: "i" };
  }

  if (status && status !== "all") {
    queryObject.status = status;
  }

  if (jobType && jobType !== "all") {
    queryObject.jobType = jobType;
  }

  let result = Job.find(queryObject);

  // chain sort conditons

  // better than if statement
  const sortObject = {
    latest: "-createdAt",
    oldest: "createdAt",
    "a-z": "position",
    "z-a": "-position",
  };
  result = result.sort(sortObject[sort]);

  // if (sort === "latest") {
  //   result = result.sort("-createdAt");
  // }
  // if (sort === "oldest") {
  //   result = result.sort("createdAt");
  // }
  // if (sort === "a-z") {
  //   result = result.sort("position");
  // }
  // if (sort === "z-a") {
  //   result = result.sort("-position");
  // }

  const page = Number(req.query.page) || 1;
  // req.query.limit is not coming from front end but you can add if you want
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  result = result.skip(skip).limit(limit);

  const jobs = await result;

  const totalJobs = await Job.countDocuments(queryObject);
  const numOfPages = Math.ceil(totalJobs / limit);
  res.status(StatusCodes.OK).json({ jobs, totalJobs, numOfPages });
};
const getJob = async (req, res) => {
  const {
    user: { userId },
    params: { id: jobId },
  } = req;

  const job = await Job.findOne({
    _id: jobId,
    createdBy: userId,
  });
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`);
  }
  res.status(StatusCodes.OK).json({ job });
};

const createJob = async (req, res) => {
  req.body.createdBy = req.user.userId;
  const job = await Job.create(req.body);
  res.status(StatusCodes.CREATED).json({ job });
};

const updateJob = async (req, res) => {
  const {
    body: { company, position },
    user: { userId },
    params: { id: jobId },
  } = req;

  if (company === "" || position === "") {
    throw new BadRequestError("Company or Position fields cannot be empty");
  }
  const job = await Job.findByIdAndUpdate(
    { _id: jobId, createdBy: userId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`);
  }
  res.status(StatusCodes.OK).json({ job });
};

const deleteJob = async (req, res) => {
  const {
    user: { userId },
    params: { id: jobId },
  } = req;

  const job = await Job.findByIdAndRemove({
    _id: jobId,
    createdBy: userId,
  });
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`);
  }
  res.status(StatusCodes.OK).send();
};

const showStats = async (req, res) => {
  /* const arry = [
    {
      _id: 0,
      name: "Pepperoni",
      size: "small",
      price: 19,
      quantity: 10,
    },
    {
      _id: 1,
      name: "Pepperoni",
      size: "medium",
      price: 20,
      quantity: 20,
    },
    {
      _id: 2,
      name: "Pepperoni",
      size: "large",
      price: 21,
      quantity: 30,
    },
    {
      _id: 3,
      name: "Cheese",
      size: "small",
      price: 12,
      quantity: 15,
    },
    {
      _id: 4,
      name: "Cheese",
      size: "medium",
      price: 13,
      quantity: 50,
    },
    {
      _id: 5,
      name: "Cheese",
      size: "large",
      price: 14,
      quantity: 10,
    },
    {
      _id: 6,
      name: "Vegan",
      size: "small",
      price: 17,
      quantity: 10,
    },
    {
      _id: 7,
      name: "Vegan",
      size: "medium",
      price: 18,
      quantity: 10,
    },
    {
      _id: 8,
      name: "Cheese",
      size: "medium",
      price: 13,
      quantity: 50,
    },
    {
      _id: 9,
      name: "Cheese",
      size: "medium",
      price: 13,
      quantity: 50,
    },
  ];

  const filter = arry.filter((item) => {
    return item.size === "medium";
  });

  const uniqueNames = new Set();

  filter.forEach((item) => {
    uniqueNames.add(item.name);
  });

  const result = [];

  uniqueNames.forEach((a) => {
    let sum = 0;
    filter.forEach((f) => {
      if (f.name === a) sum += f.quantity;
    });
    result.push({
      name: a,
      quantity: sum,
    });
  });

  console.log(result); */

  let stats = await Job.aggregate([
    { $match: { createdBy: mongoose.Types.ObjectId(req.user.userId) } },
    {
      $group: { _id: "$status", count: { $sum: 1 } },
    },
  ]);
  console.log(stats);

  stats = stats.reduce((acc, curr) => {
    const { _id: title, count } = curr;
    acc[title] = count;
    return acc;
  }, {});

  const defaultStats = {
    pending: stats.pending || 0,
    interview: stats.interview || 0,
    declined: stats.declined || 0,
  };

  let monthlyApplications = await Job.aggregate([
    { $match: { createdBy: mongoose.Types.ObjectId(req.user.userId) } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": -1, "_id.month": -1 },
    },
    // limit how many of the items which is 6
    {
      $limit: 6,
    },
  ]);

  monthlyApplications = monthlyApplications
    .map((item, index) => {
      const {
        _id: { year, month },
        count,
      } = item;

      const date = moment()
        .month(month - 1)
        .year(year)
        .format("MMM Y");
      return { date, count };
    })
    .reverse();

  console.log(monthlyApplications);
  // the reason for using mongoose.Types.ObjectId(req.user.userId) is because req.user.userId is string and we need to convert it to mongoose object like we conver string "1" to number 1 with Number(1) method
  res.status(StatusCodes.OK).json({ defaultStats, monthlyApplications });
};

module.exports = {
  createJob,
  deleteJob,
  getAllJobs,
  updateJob,
  getJob,
  showStats,
};
