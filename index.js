const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

const stripe = require("stripe")(process.env.PAYMENT_GATEWAY_KEY, {
  apiVersion: "2025-07-30.basil",
});

const YOUR_DOMAIN = "http://localhost:3000";

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zst2sy0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("zap-shift");
    const parcelCollection = db.collection("parcels");
    const paymentCollection = db.collection("payment");

    // POST APIs
    app.post("/parcels", async (req, res) => {
      const parcelData = req.body;
      const result = await parcelCollection.insertOne(parcelData);
      res.status(201).send(result);
    });

    app.post("/create-checkout-session", async (req, res) => {
      const amountInCents = req.body.amountInCents;
      const session = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: session.client_secret });
    });

    app.post("/payment", async (req, res) => {
      const { parcelId, email, amount, paymentMethod, transactionId } =
        req.body;
      const updateResult = await parcelCollection.updateOne(
        { _id: new ObjectId(parcelId) },
        { $set: { paymentStatus: "paid" } }
      );

      if (updateResult.modifiedCount == 0) {
        return res
          .status(404)
          .send({ message: "Parcel not found or already paid" });
      }

      const paymentDoc = {
        parcelId,
        email,
        amount,
        paymentMethod,
        transactionId,
        paidAt: new Date(),
        paidAtString: new Date().toISOString(),
      };

      const paymentResult = await paymentCollection.insertOne(paymentDoc);

      res.status(201).send({
        message: "Payment is done",
        insertedId: paymentResult.insertedId,
      });
    });

    app.post("/tracking", async (req, res) => {
      const { trackingId, parcelId, status, message, updatedBy } = req.body;
      const log = {
        trackingId,
        parcelId: parcelId ? new ObjectId(parcelId) : undefined,
        status,
        message,
        updatedBy,
      };
    });

    // GET APIs
    app.get("/parcels", async (req, res) => {
      const userEmail = req.query.email;
      const query = userEmail ? { createdBy: userEmail } : {};
      const option = {
        sort: { createdAt: -1 },
      };
      const parcels = await parcelCollection.find(query, option).toArray();
      res.send(parcels);
    });

    app.get("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const parcel = await parcelCollection.findOne({ _id: new ObjectId(id) });
      res.send(parcel);
    });

    app.get("/session-status", async (req, res) => {
      const session = await stripe.checkout.sessions.retrieve(
        req.query.session_id,
        { expand: ["payment_intent"] }
      );

      res.send({
        status: session.status,
        payment_status: session.payment_status,
        payment_intent_id: session.payment_intent.id,
        payment_intent_status: session.payment_intent.status,
      });
    });

    app.get("/payments", async (req, res) => {
      const userEmail = req.query.email;
      const query = userEmail ? { email: userEmail } : {};
      const option = { sort: { paidAt: -1 } };
      const payments = await paymentCollection.find(query, option).toArray();
      res.send(payments);
    });

    // DELETE APIs
    app.delete("/parcels/:id", async (req, res) => {
      const id = req.params.id;
      const result = await parcelCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Pro-fast!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
