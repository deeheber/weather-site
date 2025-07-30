# 🌦️ Weather Site

## 📖 Description

Inspired by [isitsnowinginpdx.com](http://isitsnowinginpdx.com/) ❄️  
See [blog post](https://www.danielleheberling.xyz/blog/serverless-weather-reporting/) for more details 📝

A serverless weather reporting website that answers a single question: **"Is it [condition] in [location]?"** with a simple YES/NO response 🎯

This automated workflow:

1. 📍 Gets the current website status for a specified location
2. 🌤️ Hits the [OpenWeatherMap API](https://openweathermap.org/) to get current weather conditions
3. 🔄 If the status has changed → updates the website with new weather conditions
4. ⏰ Runs automatically on a schedule via EventBridge Scheduler

My deployment of this site is [here](https://isitsnowinginhillsboro.com/) 🚀

**🔴 When the weather is happening (YES!):**

<img width="1430" alt="Screenshot 2023-03-24 at 8 59 11 AM" src="https://user-images.githubusercontent.com/12616554/227594815-a8560813-2bff-4afd-b216-d24dc518c4cd.png">

**🟢 When the weather is NOT happening (Nope!):**

<img width="1430" alt="Screenshot 2023-03-24 at 8 58 11 AM" src="https://user-images.githubusercontent.com/12616554/227594838-a20aec0b-a4e2-4d09-919e-a3e1f2d08ff5.png">

## 🏗️ Architecture

### 🎯 Core Stack (Always Required)

- **🪣 S3** - Static website hosting
- **🌐 CloudFront** - Global CDN distribution
- **⚡ Lambda** - HTML generation and site updates (ARM64)
- **🔄 Step Functions** - Orchestrates weather checks and updates
- **⏰ EventBridge Scheduler** - Triggers checks every 10 minutes
- **📊 Systems Manager Parameter Store** - Stores current site status
- **🔐 Secrets Manager** - Stores OpenWeatherMap API key

### 🌍 Optional Custom Domain Stack

- **🌐 Route53** - DNS hosted zone management
- **🔒 Certificate Manager** - SSL certificates for HTTPS
- **↩️ CloudFront Function** - www → non-www redirects

### 📈 Optional Monitoring Stack

- **👀 CloudWatch** - Alarms for Step Function failures
- **📧 SNS** - Email notifications for site status changes and system failures

### 🛠️ Technologies

- **🟢 Runtime**: [Node.js](https://nodejs.org/en/) (version in `.nvmrc`)
- **📘 Language**: [TypeScript](https://www.typescriptlang.org/) with strict configuration
- **🏗️ Infrastructure**: [AWS CDK v2](https://aws.amazon.com/cdk/) for Infrastructure as Code
- **🌤️ API**: [OpenWeatherMap One Call API 3.0](https://openweathermap.org/api/one-call-3)

## 🔄 Step Function State Machine

<img width="1081" alt="Screenshot 2025-07-01 at 09 24 30" src="https://github.com/user-attachments/assets/aa445da5-5fd0-4abe-8b76-c7db24f2feb9" />

## 🚀 Deployment Options

### 🎯 Basic Deployment (CloudFront Default Domain)

Works out of the box with a CloudFront-generated domain (e.g., `d123456789.cloudfront.net`) ✨

### 🌍 Custom Domain Deployment

Requires additional domain stack deployed to `us-east-1` region for SSL certificates 🔒

## 📋 Setup Instructions

### ✅ Prerequisites

1. 🟢 Install Node.js (see `.nvmrc` for required version)
2. ☁️ Install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and [configure credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)
3. 🔑 Get an API key from [OpenWeatherMap](https://openweathermap.org/api/one-call-3)

### 🛠️ Basic Setup

1. 📥 Clone the repository
2. 🔐 [Create a Secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_secret.html) in AWS Secrets Manager:
   - Name: `weather-site-api-key`
   - Value: Your OpenWeatherMap API key (plaintext)
3. ⚙️ Copy `.env.example` to `.env` and configure:

   ```bash
   cp .env.example .env
   ```

   - Set required variables: `WEATHER_LOCATION_LAT`, `WEATHER_LOCATION_LON`, `LOCATION_NAME`, etc.
   - Optionally set `ALERT_EMAIL` for email notifications when site status changes or system failures occur 📧
   - Leave `DOMAIN_NAME` empty for basic deployment

4. 📦 Install dependencies:
   ```bash
   npm install
   ```
5. 👤 Set AWS profile (optional):
   ```bash
   export AWS_PROFILE=<your_aws_profile>
   ```

### 🚀 Deployment Commands

#### 🎯 Basic Deployment (No Custom Domain)

```bash
npm run deploy
```

The CloudFront URL will be output to the console 📋

#### 🌍 Custom Domain Deployment

**⚠️ Important**: Domain stack must be deployed to `us-east-1` region first!

1. 📝 Set `DOMAIN_NAME` in your `.env` file
2. 🌐 Deploy domain stack to us-east-1:
   ```bash
   npm run deploy -- --region us-east-1 --exclusively "*-domain"
   ```
3. ☁️ Deploy weather stack to your preferred region:
   ```bash
   npm run deploy -- --region us-west-2 --exclusively "*-weather"
   ```

## 🌍 Custom Domain Setup

### 🌐 DNS Requirements

- If your domain is not hosted in Route53, point your nameservers to Route53 ([instructions](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/MigratingDNS.html)) 🔄
- For non-Route53 domains: Update nameservers quickly after domain stack deployment starts to prevent certificate validation failures ⚡

### 🗺️ Regional Requirements

- **🌐 Domain Stack**: Must deploy to `us-east-1` (CloudFront SSL certificate requirement) 🔒
- **☁️ Weather Stack**: Can deploy to any AWS region 🌎

### 🎁 What Gets Created

- 🌐 Route53 hosted zone for your domain
- 🔒 SSL certificates for both `example.com` and `www.example.com`
- ☁️ CloudFront distribution with custom domain
- ↩️ Automatic `www` → non-www redirect
- 📍 DNS A records pointing to CloudFront

### ⏱️ Certificate Validation

- 🕐 DNS validation can take up to 30 minutes
- 👀 Monitor AWS Console for certificate status
- ⚡ Ensure nameservers are updated promptly for external domains

### 🌎 Multi-Region Deployment Pattern

```bash
# Step 1: 🌐 Deploy domain resources (us-east-1 required)
npm run deploy -- --region us-east-1 --exclusively "myStack-domain"

# Step 2: ☁️ Deploy main application (any region)
npm run deploy -- --region us-west-2 --exclusively "myStack-weather"
```

## 👨‍💻 Development

### 🛠️ Available Commands

```bash
npm run build          # 🔨 Compile TypeScript
npm run test           # 🧪 Run Jest tests
npm run format         # ✨ Format code with Prettier
npm run lint           # 🔍 Lint code with ESLint
npm run synth          # 📄 Generate CloudFormation templates
npm run diff           # 👀 Preview infrastructure changes
npm run deploy         # 🚀 Interactive deployment
npm run deploy:ci      # 🤖 CI/CD deployment (no prompts)
npm run destroy        # 💥 Delete all stacks
```

### ⚙️ Environment Variables

Configure in `.env` file:

- 📍 `WEATHER_LOCATION_LAT` / `WEATHER_LOCATION_LON` - Coordinates for weather checks
- 🏷️ `LOCATION_NAME` - Display name for the location
- 🌦️ `WEATHER_TYPE` - Condition to check (snow, rain, etc.)
- ⏰ `SCHEDULES` - Cron expressions for check frequency
- 🏷️ `STACK_PREFIX` - Prefix for all AWS resources
- 🌐 `DOMAIN_NAME` - Optional custom domain
- 📧 `ALERT_EMAIL` - Optional email for notifications when site status changes or system failures occur

### 🧪 Testing

Basic CDK snapshot tests are in the `test/` folder:

```bash
npm run test
```

## 📧 Email Notifications (Optional)

The weather site supports optional email notifications for two scenarios:

### 🔄 Status Change Notifications

When the weather condition status changes (e.g., from "NO" to "YES" or vice versa), you'll receive an email notification with the new status.

### ⚠️ System Failure Alerts

If the Step Function fails (e.g., API errors, deployment issues), you'll receive CloudWatch alarm notifications.

### 🛠️ Setup

1. Add your email address to the `.env` file:

   ```bash
   ALERT_EMAIL=your-email@example.com
   ```

2. Deploy the app:

   ```bash
   npm run deploy
   ```

   Or deploy the weather stack separately:

   ```bash
   npm run cdk deploy -- --exclusively "*-weather"
   ```

3. **Important**: You will receive one confirmation email from AWS SNS that you must confirm by clicking the link. This single topic handles both status change notifications and system failure alerts.

### 📊 What Gets Created

- **📧 SNS Topic** - Handles email delivery
- **👀 CloudWatch Alarm** - Monitors Step Function failures (≥2 failures in 1 hour)
- **📬 Email Subscription** - Sends notifications to your specified email

### 🗑️ Removing Email Notifications

To stop receiving emails:

1. Remove `ALERT_EMAIL` from `.env`
2. Redeploy the weather stack: `npm run deploy`

This removes the SNS topic and alarm action, stopping all email notifications. The CloudWatch alarm remains for monitoring purposes.

## 🧹 Cleanup

To delete all resources:

```bash
npm run destroy
```

🗑️ Manually delete the `weather-site-api-key` secret from AWS Secrets Manager.

## 🤝 Contributing

See [CONTRIBUTING.md](https://github.com/deeheber/weather-site/blob/main/CONTRIBUTING.md) for more info on our guidelines.
