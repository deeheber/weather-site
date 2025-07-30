---
inclusion: always
---

# Project Structure & Architecture Patterns

## Directory Organization

```
bin/           # CDK app entry point with environment validation
lib/           # CDK stack definitions (infrastructure + monitoring)
src/functions/ # Lambda function implementations
src/site/      # Static web assets (HTML, CSS)
test/          # Jest tests with CDK snapshot testing
```

## Naming Conventions

### AWS Resources

- Stack names: `${stackPrefix}-weather`, `${stackPrefix}-domain`, `${stackPrefix}-alert`
- Resource IDs: `${stackId}-${resource-name}`
- Lambda functions: `${stackId}-${function-name}Function`

### Files

- TypeScript: kebab-case (`weather-site-stack.ts`)
- Tests: `*.test.ts` with snapshots in `__snapshots__/`

## CDK Architecture Patterns

### Stack Organization

- **Main stack**: S3 bucket + CloudFront + Step Functions + Lambda + CloudWatch alarms + optional SNS topic (always required)
- **Domain stack**: Route53 hosted zone + SSL certificates + www redirect (optional - only for custom domains)
- Environment validation required in `bin/weather-site.ts`
- Use CDK app for stack dependency management

#### Domain Stack Usage

The domain stack is only needed when using a custom domain:

- Without custom domain: Weather site uses CloudFront's default domain
- With custom domain: Domain stack provides Route53 hosted zone, SSL certificates, and www→non-www redirect
- Domain stack must be deployed first when using custom domains
- **Important**: Domain stack must be deployed in us-east-1 region due to CloudFront certificate requirements

### Resource Management

- Consistent naming: `${stackPrefix}-${resource-type}`
- Environment variables validated at startup
- Secrets in AWS Secrets Manager: `weather-site-api-key`
- Optional email notifications via SNS when `ALERT_EMAIL` is configured
- ARM64 Lambda architecture with esbuild bundling

### Code Patterns

- AWS SDK v3 client pattern for Lambda functions
- Bundle optimization for cold start performance
- TypeScript strict mode with proper error handling
- Jest snapshot testing for CDK constructs

## Build Artifacts

- `dist/` - TypeScript compilation output (gitignored)
- `cdk.out/` - CDK CloudFormation templates (gitignored)
- Both regenerated on each build
