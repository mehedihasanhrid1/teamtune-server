const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const port = process.env.PORT || 5000;

const corsConfig = {
  origin:['http://localhost:5173' , 'https://hrid-phero.web.app' , 'https://hrid-phero.firebaseapp.com'],
credentials:true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

app.use(cors(corsConfig));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.lbqsrfq.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const useToken = (req, res, next) => {
  const token = req.cookies.JWT_TOKEN;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired" });
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    const database = client.db("TeamTune");
    const userCollection = database.collection("Users");
    const workCollection = database.collection("WorkSheet");
    const paymentCollection = database.collection("Payments");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("JWT_TOKEN", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res.clearCookie("JWT_TOKEN", { maxAge: 0 });
      res.status(200).json({ message: "Logout successful" });
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const user = await userCollection.findOne({ email });
        if (user) {
          res.json(user);
        } else {
          res.status(404).send("User not found");
        }
      } catch (error) {
        console.error("Error finding email", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.delete("/delete/:userId", async (req, res) => {
      try {
        const { userId } = req.params;
        const result = await userCollection.deleteOne({
          _id: new ObjectId(userId),
        });
        if (result.deletedCount === 1) {
          res.json(result);
        } else {
          res.status(404).json({ error: "User not found." });
        }
      } catch (error) {
        console.error("Error deleting employee:", error);
        res
          .status(500)
          .json({ error: "An error occurred while deleting the employee." });
      }
    });

    app.get("/payments/:email", useToken, async (req, res) => {
      const userEmail = req.params.email;
      try {
        const result = await paymentCollection.find({ email : userEmail }).toArray();;
        if (result) {
          res.json(result);
        } else {
          res.status(404).send("Data not found");
        }
      } catch (error) {
        console.error("Error finding data", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);

        if (existingUser) {
          return res.send({ message: "User already exists", insertedId: null });
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/payments", async (req, res) => {
      try {
        const paymentData = req.body;
        const result = await paymentCollection.insertOne(paymentData);
        res.send(result);
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post("/worksheet", async (req, res) => {
      try {
        const data = req.body;
        const result = await workCollection.insertOne(data);
        res.send(result);
      } catch (error) {
        console.error("Error inserting user:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/employee-list", useToken, async (req, res) => {
      try {
        const users = await userCollection.find({ role: "user" }).toArray();
        res.json(users);
      } catch (error) {
        console.error("Error fetching users", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/worksheet/:email", useToken, async (req, res) => {
      const email = req.params.email;
      try {
        const works = await workCollection.find({ email: email }).toArray();
        if (works) {
          res.json(works);
        } else {
          res.status(404).send("Work not found");
        }
      } catch (error) {
        console.error("Error fetching users", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/all-employee-list", useToken, async (req, res) => {
      try {
        const users = await userCollection
          .find({ verify: true, role: { $ne: "admin" } })
          .toArray();

        res.json(users);
      } catch (error) {
        console.error("Error fetching employees", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/worksheets", useToken, async (req, res) => {
      try {
        const worksheet = await workCollection.find().toArray();
        res.json(worksheet);
      } catch (error) {
        console.error("Error fetching worksheets", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.patch("/make-hr/:userId", useToken, async (req, res) => {
      try {
        const userId = req.params.userId;

        await userCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { role: "hr" } }
        );

        res
          .status(200)
          .json({ success: true, message: "User has been made HR." });
      } catch (error) {
        console.error("Error making user HR:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });

    app.patch("/fire/:userId", useToken, async (req, res) => {
      try {
        const userId = req.params.userId;
        const { fired } = req.body;
    
        await userCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { fired } }
        );
    
        res
          .status(200)
          .json({ success: true, message: "Employee status updated." });
      } catch (error) {
        console.error("Error updating employee status:", error);
        res
          .status(500)
          .json({ success: false, message: "Internal server error" });
      }
    });
    

    app.patch("/users/:id", useToken, async (req, res) => {
      const userId = req.params.id;
      const { verify } = req.body;

      try {
        const updatedUser = await userCollection.findOneAndUpdate(
          { _id: new ObjectId(userId) },
          { $set: { verify } },
          { returnDocument: "after" }
        );

        if (updatedUser) {
          res.json(updatedUser);
        } else {
          res.status(404).json({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error updating user verification status", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post('/paymentintent', async (req, res) => {
      const { salary } = req.body;
      const amount = parseInt(salary * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("The server is running.");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
