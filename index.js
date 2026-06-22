const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { ObjectId, MongoClient, ServerApiVersion } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
    const userCollection = database.collection("user");
    const paymentCollection = database.collection("payments");

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

      if (email && role === 'freelancer') {
        const result = await proposalCollection.find({ freelancer_email: email }).toArray();
        return res.send(result);
      }

      if (email) {
        const clientTasks = await jobCollection.find({ client_email: email }).toArray();
        const taskIds = clientTasks.map(t => t._id.toString());

        const result = await proposalCollection.find({ task_id: { $in: taskIds } }).toArray();
        return res.send(result);
      }

      const result = await proposalCollection.find().toArray();
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

    app.get('/admin-stats', async (req, res) => {
      const totalUsers = await userCollection.countDocuments();
      const totalTasks = await jobCollection.countDocuments();
      const activeTasks = await jobCollection.countDocuments({ status: 'In Progress' });

      const revenueResult = await paymentCollection.aggregate([
        { $match: { payment_status: 'succeeded' } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]).toArray();
      const totalRevenue = revenueResult[0]?.total || 0;

      res.send({ totalUsers, totalTasks, activeTasks, totalRevenue });
    });

    // ---- Manage Users ----
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch('/users/:id/block', async (req, res) => {
      const result = await userCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { isBlocked: true } }
      );
      res.send(result);
    });

    app.patch('/users/:id/unblock', async (req, res) => {
      const result = await userCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { isBlocked: false } }
      );
      res.send(result);
    });

    // ---- Payments / Transactions ----
    app.get('/payments', async (req, res) => {
      const result = await paymentCollection.find().sort({ paid_at: -1 }).toArray();
      res.send(result);
    });

    // ---- Stripe: Checkout Session তৈরি করা ----
    app.post('/create-checkout-session', async (req, res) => {
      const { task_id, proposal_id, amount, task_title, freelancer_email, client_email } = req.body;

      // ডিবাগ করার জন্য — backend টার্মিনালে দেখা যাবে আসলে কী ডেটা আসছে
      console.log("create-checkout-session body:", req.body);

      try {
        if (!amount || isNaN(amount)) {
          throw new Error(`Invalid amount received: ${amount}`);
        }

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: { name: task_title || "Task Payment" },
                unit_amount: Math.round(Number(amount) * 100),
              },
              quantity: 1,
            },
          ],
          success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_URL}/dashboard/client/proposals`,
          metadata: {
            task_id: task_id || "",
            proposal_id: proposal_id || "",
            freelancer_email: freelancer_email || "",
            client_email: client_email || "",
            amount: amount.toString(),
          },
        });

        res.send({ url: session.url });
      } catch (error) {
        // 👇 এই লাইনটাই সবচেয়ে গুরুত্বপূর্ণ — exact কারণ টার্মিনালে দেখাবে
        console.error("STRIPE ERROR:", error.message);
        res.status(500).send({ message: "Checkout session তৈরি করা যায়নি", error: error.message });
      }
    });

    app.post('/confirm-session', async (req, res) => {
      const { session_id } = req.body;

      try {
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
          return res.status(400).send({ message: "পেমেন্ট সম্পন্ন হয়নি" });
        }

        const { task_id, proposal_id, freelancer_email, client_email, amount } = session.metadata;

        const existing = await paymentCollection.findOne({ transaction_id: session.payment_intent });
        if (existing) {
          return res.send({ message: "আগেই সেভ করা আছে", payment: existing });
        }

        const paymentDoc = {
          client_email,
          freelancer_email,
          task_id,
          amount: parseFloat(amount),
          transaction_id: session.payment_intent,
          payment_status: 'succeeded',
          paid_at: new Date(),
        };
        await paymentCollection.insertOne(paymentDoc);

        await jobCollection.updateOne(
          { _id: new ObjectId(task_id) },
          { $set: { status: 'In Progress' } }
        );

        await proposalCollection.updateOne(
          { _id: new ObjectId(proposal_id) },
          { $set: { status: 'accepted' } }
        );

        await proposalCollection.updateMany(
          { task_id: task_id, _id: { $ne: new ObjectId(proposal_id) } },
          { $set: { status: 'Rejected' } }
        );

        res.send({ message: "পেমেন্ট কনফার্ম হয়েছে", payment: paymentDoc });
      } catch (error) {
        console.error("CONFIRM SESSION ERROR:", error.message);
        res.status(500).send({ message: "Confirm করতে সমস্যা হয়েছে", error: error.message });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);

app.get('/', (req, res) => res.send('SkillSwap Server is running!'));
app.listen(port, () => console.log(`Server running on port ${port}`));