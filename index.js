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
        // ui_mode: "custom",
        // line_items: [
        //   {
        //     // Provide the exact Price ID (e.g. price_1234) of the product you want to sell
        //     price: "{{PRICE_ID}}",
        //     quantity: 1,
        //   },
        // ],
        // mode: "payment",
        // return_url: `${YOUR_DOMAIN}/complete?session_id={CHECKOUT_SESSION_ID}`,
      });

      res.send({ clientSecret: session.client_secret });
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
