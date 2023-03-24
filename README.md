# Weather Site

## Description

Inspired by [isitsnowinginpdx.com](http://isitsnowinginpdx.com/).
See [blog post](https://www.danielleheberling.xyz/blog/serverless-weather-reporting/) for more details.

This is a workflow that:

1. Gets the current website status for a specified location
2. Hits the [open weather map API](https://openweathermap.org/) to get the current weather conditions
3. If #1 and #2 are different 👉🏻 update the website with the current weather conditions

My deployment of this site is [here](http://www.isitsnowinginhillsboro.com/).

## Technologies used

1. [AWS](https://aws.amazon.com/)
   - [S3](https://aws.amazon.com/s3/)
   - [Step Functions](https://aws.amazon.com/step-functions/)
   - [DynamoDB](https://aws.amazon.com/dynamodb/)
   - [Lambda](https://aws.amazon.com/lambda/)
   - [EventBridge Scheduler](https://aws.amazon.com/eventbridge/scheduler/)
   - [IAM](https://aws.amazon.com/iam/)
   - [CDK](https://aws.amazon.com/cdk/)
2. [Node.js](https://nodejs.org/en/) - specific version is in `.nvmrc` file
3. [TypeScript](https://www.typescriptlang.org/)
4. [Open Weather API](https://openweathermap.org/api/one-call-3)

## Step Function State machine

<img width="620" alt="weather-site-workflow" src="https://user-images.githubusercontent.com/12616554/221385438-87a3509a-788c-41cf-8a76-ddac15bcc7fd.png">

## Instructions to run

### Prerequisites

1. Install Node.js
2. Ensure you have an AWS account, install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), and [configure your credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)
3. Get an API key from [Open Weather Map](https://openweathermap.org/api/one-call-3)

### Steps

1. Clone the repo
2. Copy `.env.example` to `.env` and add your API key and other info
3. Run `npm install`
4. Run `export AWS_PROFILE=<your_aws_profile>`
   - Optional if you have a default profile or use `--profile` instead
5. Run `npm run cdk deploy`

### Cleanup

If you want to delete the resources created by this project, run `npm run cdk destroy`.

### Tests

There's some super basic tests in the `test` folder. To run them, run `npm run test`.

## Contributing

See [CONTRIBUTING.md](https://github.com/deeheber/weather-site/blob/main/CONTRIBUTING.md) for more info on our guidelines.
