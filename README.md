# Weather Site

## Description

Inspired by [isitsnowinginpdx.com](http://isitsnowinginpdx.com/).
See [blog post](https://www.danielleheberling.xyz/blog/serverless-weather-reporting/) for more details.

This is a workflow that:

1. Gets the current website status for a specified location
2. Hits the [open weather map API](https://openweathermap.org/) to get the current weather conditions
3. If #1 and #2 are different 👉🏻 update the website with the current weather conditions

My deployment of this site is [here](https://isitsnowinginhillsboro.com/).

**The weather is happening site looks like this**

<img width="1430" alt="Screenshot 2023-03-24 at 8 59 11 AM" src="https://user-images.githubusercontent.com/12616554/227594815-a8560813-2bff-4afd-b216-d24dc518c4cd.png">

**The weather is not happening site looks like this**

<img width="1430" alt="Screenshot 2023-03-24 at 8 58 11 AM" src="https://user-images.githubusercontent.com/12616554/227594838-a20aec0b-a4e2-4d09-919e-a3e1f2d08ff5.png">

## Technologies used

1. [AWS](https://aws.amazon.com/)
   - [Route53](https://aws.amazon.com/route53/) - only if using a custom domain
   - [Certificate Manger](https://aws.amazon.com/certificate-manager/) - only if using a custom domain
   - [S3](https://aws.amazon.com/s3/)
   - [CloudFront](https://aws.amazon.com/cloudfront/)
   - [Step Functions](https://aws.amazon.com/step-functions/)
   - [Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
   - [Lambda](https://aws.amazon.com/lambda/)
   - [EventBridge Scheduler](https://aws.amazon.com/eventbridge/scheduler/)
   - [IAM](https://aws.amazon.com/iam/)
   - [CDK](https://aws.amazon.com/cdk/)
2. [Node.js](https://nodejs.org/en/) - specific version is in `.nvmrc` file
3. [TypeScript](https://www.typescriptlang.org/)
4. [Open Weather API](https://openweathermap.org/api/one-call-3)

## Step Function State machine

![stepfunctions_graph](https://github.com/deeheber/weather-site/assets/12616554/4ee8dbec-c5fc-41a0-bfd6-4a758336bc36)

## Instructions to run

### Prerequisites

1. Install Node.js. See `.nvmrc` for the recommended version
2. Ensure you have an AWS account, install the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), and [configure your credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)
3. Get an API key from [Open Weather Map](https://openweathermap.org/api/one-call-3)

### Steps

1. Clone the repo
2. [Create a Secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_secret.html) in Secrets Manager titled `weather-site-api-key` with a plaintext secret value that is your OpenWeather API key. Save the secret ARN for step #2.
3. Copy `.env.example` to `.env`. Fill in the missing `SECRETS_EXTENSION_ARN` using the commented URL in `.env.example` to grab the correct ARN for your region. Add your copied ARN from the secret you created in step #1 for `WEATHER_SECRET_ARN`. Uncomment and add an email address to `ALERT_EMAIL`, if you'd like to receive an email notification if the state machine has two failed executions within 1 hour (totally optional). Update any other values if you don't want the default values.
4. Run `npm install`
5. Run `export AWS_PROFILE=<your_aws_profile>`
   - Optional if you have a default profile or use `--profile` instead
6. Run `npm run deploy` **see note below about custom domains before running this**
7. If not using a custom domain, the generated CloudFront URL will output to the console. This is where your website is.

### Custom Domain

- If your domain is not hosted in Route53, you'll also need to point your nameservers at Route53. [Directions here](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/MigratingDNS.html)
- Non Route53 hosted domain DNS validation is a bit tricky since we're also creating the hosted zone in the creation of this stack. Once the initial deploy starts and the hosted zone is created, I had to quickly updated my nameservers in my domain registrar to point at Route53 (nameservers found in the AWS console looking at the hosted zone - see prior link for more details) to prevent things from failing. This may or may not be your experience. Also note that certificate validation can take up to 30 min according to AWS, so be patient (mine took 20 min).
- This will create the settings needed for both the `www` and non-www versions of your domain to point to the CloudFront distribution. The `www` version of the domain will redirect to the non-www version of the domain.
- Certificates used for CloudFront have to be in the `us-east-1` region. I could've set this up with [cross region references](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager-readme.html#cross-region-certificates), but decided to throw an error for now if a domain name is present and not deploying into `us-east-1`. Contributions are welcome to make this better!

### Cleanup

If you want to delete the resources created by this project, run `npm run destroy`. Delete the secret that you created in the Secrets Manager console.

### Tests

There's some super basic tests in the `test` folder. To run them, run `npm run test`.

## Contributing

See [CONTRIBUTING.md](https://github.com/deeheber/weather-site/blob/main/CONTRIBUTING.md) for more info on our guidelines.
