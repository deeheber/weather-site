# Weather Site

**This repo is a work in progress**

## Description
Inspired by [isitsnowinginpdx.com](http://isitsnowinginpdx.com/), this is a workflow that:
1. Gets the current website status for a specified location
2. Hits the [open weather map API](https://openweathermap.org/) to get the current weather conditions
3. If #1 and #2 are different 👉🏻 update the website with the current weather conditions

## Technologies used
1. [AWS](https://aws.amazon.com/)
   - [S3](https://aws.amazon.com/s3/)
   - [Step Functions](https://aws.amazon.com/step-functions/)
   - [DynamoDB](https://aws.amazon.com/dynamodb/)
   - [Lambda](https://aws.amazon.com/lambda/)
   - [IAM](https://aws.amazon.com/iam/)
   - [CDK](https://aws.amazon.com/cdk/)
 2. [Node.js](https://nodejs.org/en/) - specific version is in `.nvmrc` file
 3. [TypeScript](https://www.typescriptlang.org/)
 3. [Open Weather API](https://openweathermap.org/api/one-call-3)

## Instructions to run
// TODO


## Step Function State machine

<img width="620" alt="weather-site-workflow" src="https://user-images.githubusercontent.com/12616554/221385438-87a3509a-788c-41cf-8a76-ddac15bcc7fd.png">
