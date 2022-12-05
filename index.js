const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ObjectId } = require('mongodb');

// create MongoClient instance
const client = new MongoClient( process.env.MONGO_URI );

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

app.get("/api/users", async function (req, res){
  let allUsers = await getAllUsers();
  res.send(allUsers);
})

app.post("/api/users/:_id/exercises", async function(req, res){
  let {description, duration, date} = req.body;
  duration = Number(duration);
  const {_id} = req.params;

  if(date == "") date = new Date();
  else if(/^ +$/.test(date)) return res.send("invalid date");
  else if(!isNaN(Number(date))) date = new Date(Number(date));
  else date = new Date(date);

  let username = await checkUserById(_id);
  if(username && !isNaN(duration) && !isNaN(date.getTime()) ){
    await findUserByIdAndUpdate(_id, duration, description, date.toDateString() );
    res.json({"_id": _id, "username": username, "date": date.toDateString(), "duration": duration, "description": description})
  }
  else{
    // console.log(duration, date, username);
    res.send("invalid id")
  }
})

app.get("/api/users/:_id/logs", async function(req, res){
  let {from, to, limit} = req.query;
  from = new Date(from);
  to = new Date(to);
  limit = Number(limit);
  let {_id} = req.params;
  let {username, log} = await getUserLogs(_id,from,to,limit);
  if(username && from == "Invalid Date") res.json({"_id": _id, "username": username, "count": log.length, "log": log});
  else if(username && from != "Invalid Date" && to != "Invalid Date") res.json({"_id": _id, "username": username, "from": from.toDateString(), "to": to.toDateString(), "count": log.length, "log": log});
  else res.send("user not found");
})




const usersCollection = client.db("exercise_tracker").collection("users");

async function insertUser(name) {
  let finalRes;
  try {
    await client.connect();
    let isUserExist = await checkUser(name);
    if (isUserExist) {
      finalRes = isUserExist;
    }
    else {
      let documentToInsert = { username: name, count: 0, log: []};
      let result = await usersCollection.insertOne(documentToInsert);
      finalRes = result.insertedId;
    }
  }
  catch (error) {
    console.error(error);
  }
  finally {
    await client.close();
    return finalRes;
  }
}

async function checkUser(name) {
  try {
    let result = await usersCollection.findOne({ username: name });
    if (result) return result._id;
    else return false;
  }
  catch (err) {
    console.log(err);
  }
}

async function getAllUsers(){
  let finalRes;
  try{
    await client.connect();
    finalRes = await usersCollection.find({}, {projection: {username: 1}}).toArray();
  }
  catch(err){
    console.error(err);
  }
  finally{
    await client.close();
    return finalRes;
  }
}

async function checkUserById(id){
  let finalRes;
  try{
    await client.connect();
    let filterDoc = { _id: new ObjectId(id)};
    let result = await usersCollection.findOne(filterDoc);
    if(result) finalRes = result.username;
    else finalRes = false;
    // console.log(result);
  } 
  catch(error){
    console.log(error);
  }
  finally{
    client.close();
    return finalRes;
  }
}

async function findUserByIdAndUpdate(id, dur, des, date){
  let finalRes;
  try{
    await client.connect();
    let filterDoc = {_id: new ObjectId(id)};
    let updateDoc = {
      $inc: {count : 1},
      $push: {log: {
        duration: dur,
        description: des,
        date: date
      }}
    };
    let optionsObj = { returnDocument: 'after'}
    let result = await usersCollection.findOneAndUpdate(filterDoc, updateDoc, optionsObj);
    if(result){
      finalRes = true;
    }
    else{
      finalRes = false;
    }
  }
  catch(error){
    console.log(error);
  }
  finally{
    await client.close();
    return finalRes;
  }
}

async function getUserLogs(id, from, to, lim){
  let finalRes;
  try{
    await client.connect();
    let filterDoc,result,options; 

    filterDoc = {_id: new ObjectId(id)};
      options = {projection: {log:1, username:1, _id: 0}};
      result = await usersCollection.findOne(filterDoc,options);

    if(from != "Invalid Date" && to != "Invalid Date"){
      result.log = result.log.filter((eachLog) => {
        let date = new Date(eachLog.date);
        if(date >= from && date < to) return eachLog;
      })
    }
    result.log.sort((x,y) => {
      let a = new Date (x.date);
      let b = new Date (y.date);
      if(a < b) return 1;
      if(a >= b) return -1;
    });

    if(!isNaN(lim)){
      result.log = result.log.slice(0,lim);
    }

    if(result) finalRes = result;
    else finalRes = false;
  }
  catch(err){
    console.error(err);
  }
  finally{
    await client.close();
    return finalRes;
  }
}