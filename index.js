const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { ObjectId } = require('mongodb');
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
      const email = req.query.email;
      const page = parseInt(req.query.page);
      const limit = parseInt(req.query.limit);

      if (email) {
        // ইমেইল থাকলে শুধু ওই ক্লায়েন্টের টাস্ক দিবে
        const query = { client_email: email };
        const result = await jobCollection.find(query).toArray();
        res.send(result);
      } else if (!isNaN(page) && !isNaN(limit)) {
        // ইমেইল না থাকলে পেজিনেশন অনুযায়ী সব টাস্ক দিবে
        const result = await jobCollection.find()
          .skip(page * limit)
          .limit(limit)
          .toArray();
        res.send(result);
      } else {
        // কোনো প্যারামিটার না থাকলে সব ডাটা দিবে
        const result = await jobCollection.find().toArray();
        res.send(result);
      }
    })
    app.get('/top-freelancers', async (req, res) => {
      const result = await freelancerCollection.find().sort({ rating: -1 }).limit(4).toArray();
      res.send(result);
    });
    app.get('/platform-stats', async (req, res) => {
      const totalTasks = await jobCollection.countDocuments();
      const totalFreelancers = await freelancerCollection.countDocuments();
      res.send({ totalTasks, totalFreelancers });
    });


    // index.js
    app.get('/all-freelancers', async (req, res) => {
      const result = await freelancerCollection.find().toArray();
      res.send(result);
    });



    app.get('/freelancer/:id', async (req, res) => {
      try {
        const id = req.params.id;
        // আইডিটি ObjectId তে কনভার্ট করে সার্চ করুন
        const query = { _id: new ObjectId(id) };
        const result = await freelancerCollection.findOne(query);

        if (result) {
          res.send(result);
        } else {
          res.status(404).send({ message: "Freelancer not found!" });
        }
      } catch (error) {
        res.status(500).send({ message: "Invalid ID format or Server Error" });
      }
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