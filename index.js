const express = require('express');
const cors = require('cors')
const app = express()
const port = 5000
require('dotenv').config();

app.use(cors());
app.use(express.json());
const { MongoClient, ServerApiVersion } = require('mongodb');

app.get('/', (req, res) => {
  res.send('Hello World!')
})


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

    app.get('/tasks', async (req, res) => {
      // ফ্রন্টএন্ড থেকে page এবং limit প্যারামিটার নেবে
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 9; // ডিফল্ট ৯টি ডেটা

      const result = await jobCollection.find()
        .skip(page * limit)
        .limit(limit)
        .toArray();

      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);




app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})