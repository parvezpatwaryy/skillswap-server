const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { ObjectId, MongoClient, ServerApiVersion } = require('mongodb');

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
    const proposalCollection = database.collection("proposals");


    app.get('/tasks', async (req, res) => {
      const { email, page, limit, search, category, status } = req.query;
      let query = {};

      if (email) query.client_email = email;
      if (search) query.title = { $regex: search, $options: 'i' };
      if (category && category !== 'all') query.category = category;
      if (status) query.status = status;

      const cursor = jobCollection.find(query);

      if (page !== undefined && limit !== undefined) {
        const totalCount = await jobCollection.countDocuments(query);
        const result = await cursor
          .skip(parseInt(page) * parseInt(limit))
          .limit(parseInt(limit))
          .toArray();
        res.send({ tasks: result, totalCount });
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

    app.get('/tasks/:id', async (req, res) => {
      const result = await jobCollection.findOne({ _id: new ObjectId(req.params.id) });
      result ? res.send(result) : res.status(404).send({ message: "Task not found" });
    });

    
    app.get('/latest-tasks', async (req, res) => {
      const result = await jobCollection.find().sort({ _id: -1 }).limit(6).toArray();
      res.send(result);
    });

   
    app.delete('/tasks/:id', async (req, res) => {
      const result = await jobCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    
    app.put('/tasks/:id', async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updateDoc = { $set: req.body };
      const result = await jobCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

  

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

    app.get('/proposals', async (req, res) => {
      const { email, role } = req.query;
      let query = {};

      if (email && role === 'freelancer') {
        query.freelancer_email = email;
      } else if (email) {
        query.client_email = email;
      }

      const result = await proposalCollection.find(query).toArray();
      res.send(result);
    });

    app.patch('/proposals/:id', async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updateDoc = { $set: req.body };
      const result = await proposalCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get('/proposals/check', async (req, res) => {
      const { task_id, freelancer_email } = req.query;
      const existing = await proposalCollection.findOne({ task_id, freelancer_email });
      res.send({ exists: !!existing });
    });

    app.get('/freelancer-stats/:email', async (req, res) => {
      const email = req.params.email;

      const totalProposals = await proposalCollection.countDocuments({ freelancer_email: email });
      const pendingProposals = await proposalCollection.countDocuments({ freelancer_email: email, status: 'pending' });
      const acceptedProposals = await proposalCollection.countDocuments({ freelancer_email: email, status: 'accepted' });

      const earningsResult = await jobCollection.find({
        assigned_freelancer: email,
        status: 'Completed'
      }).toArray();

      const totalEarnings = earningsResult.reduce((sum, task) => sum + (task.budget || 0), 0);

      res.send({
        totalProposals,
        pendingProposals,
        acceptedProposals,
        totalEarnings
      });
    });

    app.get('/user-profile/:email', async (req, res) => {
      const email = req.params.email;
      const result = await freelancerCollection.findOne({ email: email });
      const user = result || await database.collection("user").findOne({ email: email });

      if (user) {
        res.send(user);
      } else {
        res.status(404).send({ message: "User not found" });
      }
    });


    app.patch('/user-profile/:email', async (req, res) => {
      const email = req.params.email;
      const updateData = req.body;

      const result = await database.collection("user").updateOne(
        { email: email },
        { $set: updateData }
      );

      res.send(result);
    });



    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);

app.get('/', (req, res) => res.send('SkillSwap Server is running!'));
app.listen(port, () => console.log(`Server running on port ${port}`));