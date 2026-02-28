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

Requires additional domain stack deployed to `us-east-1` region for SSL certificates.

**Important**: Domain stack must be deployed to `us-east-1` region first!

1. Set `DOMAIN_NAME` in your `.env` file
2. Deploy domain stack to us-east-1:
   ```bash
   npm run deploy -- --region us-east-1 --exclusively "*-domain"
   ```
3. Deploy weather stack to your preferred region:
   ```bash
   npm run deploy -- --region us-west-2 --exclusively "*-weather"
   ```

## 🌍 Custom Domain Setup

### DNS Requirements

- If your domain is not hosted in Route53, point your nameservers to Route53 ([instructions](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/MigratingDNS.html))
- For non-Route53 domains: Update nameservers quickly after domain stack deployment starts to prevent certificate validation failures

### Regional Requirements

- **Domain Stack**: Must deploy to `us-east-1` (CloudFront SSL certificate requirement)
- **Weather Stack**: Can deploy to any AWS region

### What Gets Created

- Route53 hosted zone for your domain
- SSL certificates for both `example.com` and `www.example.com`
- CloudFront distribution with custom domain
- Automatic `www` → non-www redirect
- DNS A records pointing to CloudFront

### Certificate Validation

- DNS validation can take up to 30 minutes
- Monitor AWS Console for certificate status
- Ensure nameservers are updated promptly for external domains

### Multi-Region Deployment Pattern

```bash
# Step 1: Deploy domain resources (us-east-1 required)
npm run deploy -- --region us-east-1 --exclusively "myStack-domain"

# Step 2: Deploy main application (any region)
npm run deploy -- --region us-west-2 --exclusively "myStack-weather"
```

## 🧹 Cleanup

To delete all resources:

```bash
npm run destroy
```

Manually delete the `weather-site-api-key` secret from AWS Secrets Manager.
