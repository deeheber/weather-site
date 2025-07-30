---
inclusion: always
---

# Technology Stack & Development Guidelines

## Core Technologies

- **Runtime**: Node.js (version specified in `.nvmrc`)
- **Language**: TypeScript with strict configuration (`tsconfig.json`)
- **Infrastructure**: AWS CDK v2 for Infrastructure as Code
- **Cloud Platform**: AWS (multi-region deployment pattern)
- **Testing**: Jest with ts-jest and snapshot testing for CDK stacks

## Code Style Requirements

- **Formatting**: Prettier with single quotes, no semicolons (`.prettierrc`)
- **Linting**: ESLint with TypeScript plugin and simple-import-sort (`eslint.config.mjs`)
- **Import Organization**: Use simple-import-sort plugin for consistent imports
- **File Naming**: Use kebab-case for TypeScript files (`weather-site-stack.ts`)

## Architecture Patterns

### CDK Constructs

- Naming convention: `${stackPrefix}-${resource-type}`
- Environment validation required in `bin/weather-site.ts`
- Stack dependencies managed through CDK app instantiation
- Use construct IDs consistently: `${stackId}-${resource-name}`

### Lambda Functions

- **Architecture**: ARM64 only for cost optimization
- **Bundling**: esbuild with CDK NodejsFunction construct
- **Location**: Store all Lambda code in `src/functions/` directory
- **SDK**: Use AWS SDK v3 client pattern (not v2)
- **Error Handling**: Always include proper error handling and CloudWatch logging

### Environment & Secrets

- Environment variables validated at CDK app startup
- OpenWeatherMap API key stored in AWS Secrets Manager as `weather-site-api-key`
- Optional `ALERT_EMAIL` environment variable for email notifications
- Local development: copy `.env.example` to `.env`
- Never commit secrets to version control

## Development Workflow

### Required Commands

```bash
# Always run together for development
npm run build && npm run test

# Code quality (run before commits)
npm run format && npm run lint

# CDK operations
npm run synth    # Generate CloudFormation templates
npm run diff     # Preview infrastructure changes
npm run deploy   # Interactive deployment
npm run deploy:ci # CI/CD deployment (no prompts)
```

### Build Artifacts

- `dist/` - TypeScript compilation output (gitignored)
- `cdk.out/` - CDK synthesized CloudFormation templates (gitignored)
- Both directories regenerated on each build - never edit manually

## Deployment Architecture

### Stack Organization

- **Weather Stack**: Main application stack (S3, CloudFront, Lambda, Step Functions, CloudWatch alarms, optional SNS topic)
- **Domain Stack**: Optional custom domain stack (Route53, SSL certificates, redirects)

### Regional Deployment Requirements

- **Weather Stack**: Deploy to any AWS region (always includes CloudWatch alarms, optionally includes SNS topic when ALERT_EMAIL is set)
- **Domain Stack**: **MUST deploy to us-east-1 region** due to CloudFront SSL certificate requirements

### Custom Domain Deployment Pattern

```bash
# For custom domains - deploy domain stack first in us-east-1
cdk deploy DomainStack --region us-east-1

# Then deploy main weather stack in desired region
cdk deploy WeatherStack --region us-west-2
```

## Key Constraints

- **Critical Region Dependency**: Domain stack with custom domains requires us-east-1 deployment
- **Optional Custom Domains**: Site works with CloudFront default domain or custom domain
- **Stack Dependencies**: Domain stack must be deployed before weather stack when using custom domains
- **Bundle Optimization**: Minimize Lambda bundle sizes for cold start performance
- **TypeScript Strict**: Use strict TypeScript configuration - no `any` types
- **Testing**: All CDK stacks require snapshot tests in `test/` directory
