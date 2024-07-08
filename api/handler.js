'use strict'

const {MongoClient, ObjectId} = require("mongodb");
const { pbkdf2Sync } = require('crypto');

async function connectToDatabase() {
    const client = new MongoClient(process.env.DB_CONNECTION_STRING);
    const connection = await client.connect();
    return connection.db(process.env.MONGO_DB_NAME);
}

async function basicAuth(event) {
    const {authorization} = event.headers;
    if (!authorization) {
        return {
            statusCode: 401,
            body: JSON.stringify({error: 'Missing Authorization header'}),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }

    const [type, credentials] = authorization.split(' ');
    if (type !== 'Basic') {
        return {
            statusCode: 401,
            body: JSON.stringify({error: 'Invalid Authorization type'}),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }

    const [username, password] = Buffer.from(
        credentials,
        'base64'
    ).toString().split(':'); // transforma do base64 e separando por :

    const hashedPassword = pbkdf2Sync(password, process.env.SALT, 100000, 64, 'sha512')
        .toString('hex');

    const db = await connectToDatabase();
    const collection = await db.collection('users');
    const user = await collection.findOne ({
       name: username,
         password: hashedPassword
    });

    if (!user) {
        return {
            statusCode: 401,
            body: JSON.stringify({error: 'Invalid credentials'}),
            headers: {
                'Content-Type': 'application/json'
            }
        }
    }

    return {
        id: user._id,
        name: user.name
    }
}

function extractBody(event) {
    if (!event?.body) {
        return {
            body: JSON.stringify({error: 'No body provided'}),
            statusCode: 422
        }
    }

    return JSON.parse(event.body)
}

module.exports.sendResponse = async (event) => {
    const authResult = await basicAuth(event);
    if (authResult.statusCode === 401) return authResult;

    const {name, answers} = extractBody(event);
    const correctQuestions = [3, 1, 0, 2]

    const totalCorrectAnswers = answers.reduce((acc, answer, index) => {
        if (answer === correctQuestions[index]) {
            acc++
        }
        return acc
    }, 0)

    const result = {
        name,
        answers,
        correctAnswers: totalCorrectAnswers,
        totalAnswers: answers.length
    }

    const db = await connectToDatabase();
    const collection = await db.collection('results');
    const { insertedId } = await collection.insertOne(result);

    return {
        statusCode: 201,
        body: JSON.stringify({
            resultId: insertedId,
            __hypermedia: {
                href: `/results.html`,
                query: { id: insertedId }
            }
        }),
        headers: {
            'Content-Type': 'application/json'
        },
    }
};

function notFound() {
    return {
        statusCode: 404,
        body: JSON.stringify({error: 'Result not found'}),
        headers: {
            'Content-Type': 'application/json'
        }
    }
}

module.exports.getResult = async (event) => {
    const db = await connectToDatabase();
    const collection = await db.collection('results');

    const result = await collection.findOne({
        _id: new ObjectId(event.pathParameters.id)
    });

    if (!result) return notFound()

    return {
        statusCode: 200,
        body: JSON.stringify(result),
        headers: {
            'Content-Type': 'application/json'
        }
    }
}
