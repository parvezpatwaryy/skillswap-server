const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = 5000;
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_DB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const database = client.db("skillswap-db");
    const jobCollection = database.collection("tasks");
    const freelancerCollection = database.collection("freelancers");

    app.get('/latest-tasks', async (req, res) => {
      const result = await jobCollection.find().sort({ _id: -1 }).limit(6).toArray();
      res.send(result);
    });
    app.get('/tasks', async (req, res) => {
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 9;
      const result = await jobCollection.find()
        .skip(page * limit)
        .limit(limit)
        .toArray();
      res.send(result);
    });
    app.get('/top-freelancers', async (req, res) => {
      const result = await freelancerCollection.find().sort({ rating: -1 }).limit(4).toArray();
      res.send(result);
    });
    app.get('/platform-stats', async (req, res) => {
      const totalTasks = await jobCollection.countDocuments();
      const totalFreelancers = await freelancerCollection.countDocuments();
      res.send({ totalTasks, totalFreelancers });
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('SkillSwap Server is running!');
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});