# Weather Site — Key Constraints

## Deployment

- **Domain stack must deploy to us-east-1** — CloudFront requires ACM certificates in us-east-1
- Weather stack deploys to any region; domain stack is optional (site works on CloudFront's default domain)
- When using custom domains, deploy domain stack first, then weather stack

## Secrets & Configuration

- OpenWeatherMap API key lives in Secrets Manager as `weather-site-api-key`
- `ALERT_EMAIL` env var is optional — SNS topic and alarm action are conditionally created only when it's set
- CloudWatch alarm for Step Function failures is always created regardless of `ALERT_EMAIL`

## Lambda

- ARM64 architecture only (all functions)
- AWS SDK v3 client pattern (not v2)

## Development

- `npm run build && npm run test` — always run together
- `npm run format && npm run lint` — before commits
- Snapshot tests required for CDK stacks
