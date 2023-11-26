const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;

const corsConfig = {
  origin: ["http://localhost:5173"],
  credentials: true,
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
    return res.status(401).json({ error: 'Unauthorized' });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try{
    const database = client.db("TeamTune");
    const userCollection = database.collection("Users");

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
          expiresIn: '1h'
      });
      res.cookie('JWT_TOKEN', token, {
              httpOnly: true,
              secure: true,
              sameSite: 'none'
          })
          .send({ success: true })
    })

    app.post("/logout", (req, res) => {
      res.clearCookie('JWT_TOKEN', {maxAge: 0});
      res.status(200).json({ message: "Logout successful" });
    });
    
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const user = await userCollection.findOne({ email }); 
        if (user) {
          res.json(user);
        }
        else {
          res.status(404).send("User not found");
        } 
      } catch (error) {
        console.error("Error finding email", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);
        
        if (existingUser) {
          return res.send({ message: 'User already exists', insertedId: null });
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.error('Error inserting user:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });
    

  }
  finally {
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
