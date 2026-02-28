# 🌦️ Weather Site

## 📖 Description

Inspired by [isitsnowinginpdx.com](http://isitsnowinginpdx.com/)

See [blog post](https://www.danielleheberling.xyz/blog/serverless-weather-reporting/) for more details

A serverless weather reporting website that answers a single question: **"Is it [condition] in [location]?"** with a simple YES/NO response

This automated workflow:

1. Gets the current website status for a specified location
2. Hits the [OpenWeatherMap API](https://openweathermap.org/) to get current weather conditions
3. If the status has changed → updates the website with new weather conditions
4. Runs automatically on a schedule via EventBridge Scheduler

My deployment of this site is [here](https://isitsnowinginhillsboro.com/)

**When the weather is happening (YES!):**

<img width="1430" alt="Screenshot 2023-03-24 at 8 59 11 AM" src="https://user-images.githubusercontent.com/12616554/227594815-a8560813-2bff-4afd-b216-d24dc518c4cd.png">

**When the weather is NOT happening (Nope!):**

<img width="1430" alt="Screenshot 2023-03-24 at 8 58 11 AM" src="https://user-images.githubusercontent.com/12616554/227594838-a20aec0b-a4e2-4d09-919e-a3e1f2d08ff5.png">

## 🏗️ Architecture

### Core Stack (Always Required)

- **S3** - Static website hosting
- **CloudFront** - Global CDN distribution
- **Lambda** - HTML generation and site updates (ARM64)
- **Step Functions** - Orchestrates weather checks and updates
- **EventBridge Scheduler** - Triggers checks every 10 minutes
- **Systems Manager Parameter Store** - Stores current site status
- **Secrets Manager** - Stores OpenWeatherMap API key
- **CloudWatch** - Alarm for monitoring Step Function failures
- **SNS** - Optional email notifications (only when `ALERT_EMAIL` is configured)

### Optional Custom Domain Stack

Automatically deployed to `us-east-1` via CDK `crossRegionReferences` when `DOMAIN_NAME` is set.

- **Route53** - DNS hosted zone management
- **Certificate Manager** - SSL certificates for HTTPS
- **CloudFront Function** - www → non-www redirects

### Technologies

- **Runtime**: [Node.js](https://nodejs.org/en/) (version in `.nvmrc`)
- **Language**: [TypeScript](https://www.typescriptlang.org/) with strict configuration
- **Infrastructure**: [AWS CDK v2](https://aws.amazon.com/cdk/) for Infrastructure as Code
- **API**: [OpenWeatherMap One Call API 3.0](https://openweathermap.org/api/one-call-3)

## 🔄 Step Function State Machine

<img width="1416" height="984" alt="Screenshot 2025-07-31 at 1 44 31 PM" src="https://github.com/user-attachments/assets/0cd3878d-8c93-4213-be2b-bd686b26408a" />

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for setup instructions, deployment commands, custom domain configuration, and cleanup.

## 👨‍💻 Development

### Available Commands

```bash
npm run build          # Compile TypeScript
npm run test           # Run tests
npm run format         # Format code with Prettier
npm run lint           # Lint code with ESLint
npm run synth          # Generate CloudFormation templates
npm run diff           # Preview infrastructure changes
npm run deploy         # Interactive deployment
npm run deploy:ci      # CI/CD deployment (no prompts)
npm run destroy        # Delete all stacks
```

### Environment Variables

Configure in `.env` file:

- `WEATHER_LOCATION_LAT` / `WEATHER_LOCATION_LON` - Coordinates for weather checks
- `LOCATION_NAME` - Display name for the location
- `OPEN_WEATHER_URL` - Link to the OpenWeatherMap page for the location
- `WEATHER_TYPE` - Condition to check (snow, rain, etc.)
- `SCHEDULES` - Cron expressions for check frequency
- `STACK_PREFIX` - Prefix for all AWS resources
- `DOMAIN_NAME` - Optional custom domain
- `ALERT_EMAIL` - Optional email for notifications when site status changes or system failures occur

## 📧 Email Notifications (Optional)

Set `ALERT_EMAIL` in `.env` to receive notifications for weather status changes and Step Function failures via a shared SNS topic.

1. Add `ALERT_EMAIL=your-email@example.com` to `.env`
2. Deploy: `npm run deploy`
3. **Confirm the SNS subscription** by clicking the link in the confirmation email from AWS

## 🤝 Contributing

See [CONTRIBUTING.md](https://github.com/deeheber/weather-site/blob/main/CONTRIBUTING.md) for more info on our guidelines.
