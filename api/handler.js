'use strict'

const {randomUUID} = require('crypto')

const previousResults = new Map()

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
    const {name, answers} = extractBody(event);
    const correctQuestions = [3, 1, 0, 2]

    const correctAnswers = answers.reduce((acc, answer, index) => {
        if (answer === correctQuestions[index]) {
            acc++
        }
        return acc
    }, 0)


    const result = {
        name,
        correctAnswers,
        totalAnswers: answers.length
    }

    const resultId = randomUUID()
    previousResults.set(resultId, {response: req.body, result})
    console.log(previousResults)

    return {
        statusCode: 201,
        body: JSON.stringify({
            resultId,
            __hypermedia: {
                href: `/results.html`,
                query: {id: resultId}
            }
        }),
        headers: {
            'Content-Type': 'application/json'
        }
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
    const result = previousResults.get(event.pathParameters.id)
    if (!result) notFound()

    return {
        statusCode: 200,
        body: JSON.stringify(result),
        headers: {
            'Content-Type': 'application/json'
        }
    }
}
