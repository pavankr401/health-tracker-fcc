const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ObjectId } = require('mongodb');

// create MongoClient instance
const client = new MongoClient(process.env.MONGO_URI);

app.use(express.urlencoded({ extended: false }));

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

app.post("/api/users", async function (req, res) {
  let name = req.body.username;
  let getId = await insertUser(name);
  res.json({ username: name, _id: getId });
})

app.get("/api/users", async function (req, res) {
  let allUsers = await getAllUsers();
  res.send(allUsers);
})

app.post("/api/users/:_id/exercises", async function (req, res) {
  let { description, duration, date } = req.body;
  // console.log(date);
  duration = Number(duration);
  const { _id } = req.params;

  if(date == undefined) date = new Date();
  else date = new Date(date);

  let username = await checkUserById(_id);
  if (username && !isNaN(duration) && !isNaN(date.getTime())) {
    await findUserByIdAndUpdate(_id, duration, description, date.toDateString());
    res.send({ "username": username, "description": description, "duration": duration, "date": date.toDateString(), "_id": _id })
  }
  else {
    // console.log(duration, date, username);
    res.send("invalid id")
  }
})

app.get("/api/users/:_id/logs", function(req, res){
  const {_id} = req.params;
  let {from, to, limit} = req.query;

  if(_id.length != 24){
    return res.send("invalid id");
  }

  from = new Date(from);
  to = new Date(to);
  limit = Number(limit);

  getLogs(_id, from, to, limit).then(({username, log}) => {
    if(username != undefined && (from == "Invalid Date" || to == "Invalid Date")){
      res.send({username: username, count: log.length, _id: _id, log: log});
    }
    else if(username != undefined && from != "Invalid Date" && to != "Invalid Date"){
      res.send({username: username, count: log.length, _id: _id, from: from.toDateString(), to: to.toDateString(), log: log});
    }
    else{
      res.send("invalid user")
    }
  })
})


const usersCollection = client.db("exercise_tracker").collection("users");

async function connectToDB(){
  try{
    await client.connect();
  }
  catch(err){
    console.log(err);
  }
}

async function insertUser(name) {
  let finalRes;
  try {
    await connectToDB();
    let documentToInsert = { username: name, log: [] };
    let result = await usersCollection.insertOne(documentToInsert);
    finalRes = result.insertedId;
  }
  catch (error) {
    console.error(error);
  }
  finally {
    // await client.close();
    return finalRes;
  }
}

async function getAllUsers() {
  let finalRes;
  try {
    await connectToDB();
    finalRes = await usersCollection.find({}, { projection: { username: 1 } }).toArray();
  }
  catch (err) {
    console.error(err);
  }
  finally {
    // await client.close();
    return finalRes;
  }
}

async function checkUserById(id) {
  let finalRes;
  try {
    await connectToDB();
    let filterDoc = { _id: new ObjectId(id) };
    let result = await usersCollection.findOne(filterDoc);
    if (result) finalRes = result.username;
    else finalRes = false;
    // console.log(result);
  }
  catch (error) {
    console.log(error);
  }
  finally {
    // await client.close();
    return finalRes;
  }
}

async function findUserByIdAndUpdate(id, dur, des, date) {
  let finalRes;
  try {
    await connectToDB();
    let filterDoc = { _id: new ObjectId(id) };
    let updateDoc = {
      $push: {
        log: {
          description: des,
          duration: dur,
          date: date
        }
      }
    };
    let optionsObj = { returnDocument: 'after' }
    let result = await usersCollection.findOneAndUpdate(filterDoc, updateDoc, optionsObj);
    if (result) {
      finalRes = true;
    }
    else {
      finalRes = false;
    }
  }
  catch (error) {
    console.log(error);
  }
  finally {
    // await client.close();
    return finalRes;
  }
}

async function getLogs(id, from, to, limit){
  let finalRes;
  try{
    await connectToDB();
    let filterDoc = {_id: new ObjectId(id)};
    let options = {projection: {username: 1, log: 1, _id: 0}, returnDocument: 'after'};
    let result = await usersCollection.findOne(filterDoc, options);

    result.log.sort((a,b) => {
      let x = new Date(a.date);
      let y = new Date(b.date);
      if(x >= y) return -1;
      else return 1;
    });//console.log(result);

    if(from != "Invalid Date" && to != "Invalid Date"){
      result.log = result.log.filter((eachLog) => {
        let date = new Date(eachLog.date);
        if(date >= from && date <= to) return eachLog;
      })
    }

    if(!isNaN(limit)){
      result.log = result.log.slice(0, limit);
    }

    if(result) finalRes = result;
    else finalRes = {username: undefined, log: undefined};

  }
  catch(err) {console.error(err)}
  finally{
    // await client.close();
    return finalRes;
  }
}