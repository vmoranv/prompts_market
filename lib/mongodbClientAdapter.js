import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {};

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env.local');
}

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // 在开发模式下，使用一个全局变量，这样值会在模块热重载之间被保留。
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // 在生产模式下，最好不要使用全局变量。
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise; 