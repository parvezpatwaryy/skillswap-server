const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { ObjectId, MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = 5000;

// Middleware
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
    const proposalCollection = database.collection("proposals");

    // --- TASK ROUTES ---

    // সব টাস্ক (সার্চ, ফিল্টার এবং পেজিনেশনসহ)
    app.get('/tasks', async (req, res) => {
      const { email, page, limit, search, category } = req.query;
      let query = {};

      if (email) query.client_email = email;
      if (search) query.title = { $regex: search, $options: 'i' };
      if (category && category !== 'all') query.category = category;

      const cursor = jobCollection.find(query);

      if (page !== undefined && limit !== undefined) {
        const result = await cursor
          .skip(parseInt(page) * parseInt(limit))
          .limit(parseInt(limit))
          .toArray();
        res.send(result);
      } else {
        const result = await cursor.toArray();
        res.send(result);
      }
    });



    app.post('/tasks', async (req, res) => {
      const newTask = req.body;
      const result = await jobCollection.insertOne(newTask);
      res.send(result);
    });



    // লেটেস্ট ৬টি টাস্ক
    app.get('/latest-tasks', async (req, res) => {
      const result = await jobCollection.find().sort({ _id: -1 }).limit(6).toArray();
      res.send(result);
    });

    // টাস্ক ডিলিট
    app.delete('/tasks/:id', async (req, res) => {
      const result = await jobCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // টাস্ক আপডেট
    app.put('/tasks/:id', async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updateDoc = { $set: req.body };
      const result = await jobCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // --- FREELANCER ROUTES ---

    app.get('/all-freelancers', async (req, res) => {
      res.send(await freelancerCollection.find().toArray());
    });

    app.get('/top-freelancers', async (req, res) => {
      res.send(await freelancerCollection.find().sort({ rating: -1 }).limit(4).toArray());
    });

    app.get('/freelancer/:id', async (req, res) => {
      const result = await freelancerCollection.findOne({ _id: new ObjectId(req.params.id) });
      result ? res.send(result) : res.status(404).send({ message: "Not found" });
    });

    // --- STATS ROUTE ---
    app.get('/platform-stats', async (req, res) => {
      const totalTasks = await jobCollection.countDocuments();
      const totalFreelancers = await freelancerCollection.countDocuments();
      res.send({ totalTasks, totalFreelancers });
    });


    app.post('/proposals', async (req, res) => {
      const newProposal = req.body;
      const result = await proposalCollection.insertOne(newProposal);
      res.send(result);
    });

    // নির্দিষ্ট ক্লায়েন্টের সব প্রপোজাল দেখা
    app.get('/proposals', async (req, res) => {
      const { email } = req.query;
      const query = { client_email: email };
      const result = await proposalCollection.find(query).toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } finally {
    // client.close(); // এটি কমেন্ট আউট রাখা ভালো যাতে কানেকশন খোলা থাকে
  }
}
run().catch(console.dir);

app.get('/', (req, res) => res.send('SkillSwap Server is running!'));
app.listen(port, () => console.log(`Server running on port ${port}`));