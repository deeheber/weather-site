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
4. [Open Weather API](https://openweathermap.org/api/one-call-3)

## Instructions to run

**Still a work in progress**

1. Ensure you have Node.js installed
2. Ensure you have an AWS account and have configured your credentials
3. Get an API key from [Open Weather Map](https://openweathermap.org/api/one-call-3)
4. Copy `.env.example` to `.env` and add your API key and other info
5. Clone the repo
6. Run `npm install`
7. Run `npm run build`
8. Run `export AWS_PROFILE=<your_aws_profile>`
   - Optional if you have a default profile or use `--profile` instead
9. Run `npm run cdk deploy`
10. Add a record to the DynamoDB table with the following info:

```json
{
  "PK": "SiteStatus",
  "Weather": "initial state"
}
```

- TODO: Add a custom resource to automate this step

## Step Function State machine

<img width="620" alt="weather-site-workflow" src="https://user-images.githubusercontent.com/12616554/221385438-87a3509a-788c-41cf-8a76-ddac15bcc7fd.png">
