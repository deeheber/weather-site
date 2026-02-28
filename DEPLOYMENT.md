# 🚀 Deployment

## 📋 Prerequisites

1. Install Node.js (see `.nvmrc` for required version)
2. Install [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and [configure credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)
3. Get an API key from [OpenWeatherMap](https://openweathermap.org/api/one-call-3)

## 🔧 Basic Setup

1. Clone the repository
2. [Create a Secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_secret.html) in AWS Secrets Manager:
   - Name: `weather-site-api-key`
   - Value: Your OpenWeatherMap API key (plaintext)
3. Copy `.env.example` to `.env` and configure:

   ```bash
   cp .env.example .env
   ```

   - Set required variables: `WEATHER_LOCATION_LAT`, `WEATHER_LOCATION_LON`, `LOCATION_NAME`, etc.
   - Optionally set `ALERT_EMAIL` for email notifications when site status changes or system failures occur
   - Leave `DOMAIN_NAME` empty for basic deployment

4. Install dependencies:
   ```bash
   npm install
   ```
5. Set AWS profile (optional):
   ```bash
   export AWS_PROFILE=<your_aws_profile>
   ```

## 📦 Deployment Options

### Basic Deployment (CloudFront Default Domain)

Works out of the box with a CloudFront-generated domain (e.g., `d123456789.cloudfront.net`)

```bash
npm run deploy
```

The CloudFront URL will be output to the console.

### Custom Domain Deployment

1. Set `DOMAIN_NAME` in your `.env` file
2. If your domain is not hosted in Route53, point your nameservers to Route53 ([instructions](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/MigratingDNS.html))
3. Deploy:
   ```bash
   npm run deploy
   ```

CDK automatically deploys the domain stack to `us-east-1` (required for CloudFront SSL certificates) and wires everything together via `crossRegionReferences`. The domain stack creates `www` → non-www redirects and DNS A records pointing to CloudFront.

**Note**: Certificate DNS validation can take up to 30 minutes. For non-Route53 domains, update nameservers quickly after deployment starts to prevent certificate validation failures.

## 🧹 Cleanup

To delete all resources:

```bash
npm run destroy
```

Manually delete the `weather-site-api-key` secret from AWS Secrets Manager.
