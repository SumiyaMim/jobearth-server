const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: [
        // 'http://localhost:5173', 
        // 'http://localhost:5174',
        'https://job-earth.web.app',
        'https://job-earth.firebaseapp.com'
    ],
    credentials: true
  }));
app.use(express.json());
app.use(cookieParser());

// MongoDB connection uri
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nrtglbz.mongodb.net/?retryWrites=true&w=majority`;

// MongoDB Connection
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// create middlewares
const logger = async (req, res, next) => {
    console.log('log info:', req.method, req.url)
    next();
}

// verify token
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    // console.log(token)
  
    // no token available 
    if (!token) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      // error
      if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
      }
      // if value is valid then it would be decoded
      // console.log(decoded)
      req.user = decoded;
      next();
    })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const categoryCollection = client.db('jobEarthDB').collection('category');
    const jobCollection = client.db('jobEarthDB').collection('jobs');
    const bidCollection = client.db('jobEarthDB').collection('bids');

    // auth related api
    app.post('/jwt', logger, async (req, res) => {
        try {
            const user = req.body;
            // console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '1h'
            });
            res
            .cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
            .send({ success: true })
        }
        catch(error) {
            console.log(error)
        }
    })  

    app.post('/signout', async (req, res) => {
        try {
            const user = req.body;
            console.log('sign out', user);
            res
            .clearCookie('token', { 
                secure: true,
                sameSite: 'none',
                maxAge: 0 
            })
            .send({ success: true })
        }
        catch(error) {
            console.log(error)
        }
    })

    // get category
    app.get('/category', async (req, res) => {
        try {
            const cursor = categoryCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        } 
        catch(error) {
            console.log(error)
        }
    })

    // send jobs
    app.post('/jobs', async (req, res) => {
       try {
            const newJob = req.body;
            const result = await jobCollection.insertOne(newJob);
            res.send(result);
       }
       catch(error) {
        console.log(error)
       }
    })

     // get jobs
     app.get('/jobs', logger, async (req, res) => {
        try {
            const cursor = jobCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        } 
        catch(error) {
            console.log(error)
        }
    })

     // get my posted jobs
     app.get('/jobs/my-posted-jobs', logger, verifyToken, async (req, res) => {
        try {

            const queryEmail = req.query.email;
            const userEmail = req.user.email;
    
            if (queryEmail !== userEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const cursor = jobCollection.find({ employerEmail: queryEmail });
            const result = await cursor.toArray();
            res.send(result);
        } 
        catch(error) {
            console.log(error)
        }
    })

    // get single jobs
    app.get('/jobs/:id', async(req, res) => {
        try {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await jobCollection.findOne(query);
            res.send(result);
        }
        catch(error) {
            console.log(error)
        }
    })

    // updates jobs
    app.put('/jobs/:id', async(req, res) => {
        try {
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)}
            const options = { upsert: true };
            const updatedJob = req.body;
      
            const product = {
                $set: {
                    jobTitle: updatedJob.jobTitle, 
                    category: updatedJob.category, 
                    deadline: updatedJob.deadline, 
                    description: updatedJob.description, 
                    minimumPrice: updatedJob.minimumPrice, 
                    maximumPrice: updatedJob.maximumPrice, 
                }
            }
            const result = await jobCollection.updateOne(filter, product, options);
            res.send(result);
        }
        catch(error) {
            console.log(error)
        }
    })

    // delete jobs from my posted jobs
    app.delete('/jobs/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobCollection.deleteOne(query);
            res.send(result);
        }
        catch(error) {
            console.log(error)
        }
    })  

    // send bids
    app.post('/bids', async (req, res) => {
        try {
             const bid = req.body;
             const result = await bidCollection.insertOne(bid);
             res.send(result);
        }
        catch(error) {
         console.log(error)
        }
    })

     // get bids and sorted by ascending order
     app.get('/bids', logger, verifyToken, async (req, res) => {
        try {
            // console.log(req.query.email);
            // console.log('token', req.cookies)
            // console.log('user in the valid token', req.user)

            const queryEmail = req.query.email;
            const userEmail = req.user.email;
    
            if (queryEmail !== userEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const sortField = req.query.sortField || 'status';
            const sortOrder = req.query.sortOrder || 1; 

            const cursor = bidCollection.find().sort({ [sortField]: sortOrder });
            
            const result = await cursor.toArray();
            res.send(result);
        } 
        catch(error) {
            console.log(error)
        }
    })

    // update bids status
    app.patch('/bids/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedBid = req.body;
            // console.log(updatedBid);
            const updateDoc = {
                $set: {
                    status: updatedBid.status
                },
            };
            const result = await bidCollection.updateOne(filter, updateDoc);
            res.send(result);
        }
        catch(error) {
            console.log(error)
        }
    })
  

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('JobEarth server is running')
})

app.listen(port, () => {
    console.log(`JobEarth is running on port: ${port}`)
})