---
inclusion: always
---

# Weather Site Product Requirements

A serverless weather reporting website that answers a single question: "Is it [condition] in [location]?" with a simple YES/NO response.

## Core Product Rules

### User Experience

- Display exactly one weather condition status (YES/NO)
- Use color-coded backgrounds: **green = NO**, **red = YES**
- Show minimal text: condition status + location name only
- Page must load in under 2 seconds globally
- Mobile-first responsive design

### Content Updates

- Automatic refresh every 10 minutes via EventBridge Scheduler
- Weather data from OpenWeatherMap API only
- Site updates are atomic: all files updated together or not at all
- Graceful degradation: show last known status on API failures

## Deployment Options

### Basic Deployment

- Uses CloudFront's default domain (e.g., `d123456789.cloudfront.net`)
- Single weather stack deployment
- No additional DNS configuration required

### Custom Domain Deployment

- Requires separate domain stack in us-east-1 region
- Provides branded domain with SSL certificates
- Includes www → non-www redirect functionality
- Requires Route53 hosted zone management

## Architecture Requirements

### Frontend (Static Site)

- Single HTML file with inline CSS in `src/site/`
- Hosted on S3 with CloudFront CDN distribution
- **Optional custom domain** with SSL certificates and www → non-www redirects
- Works with CloudFront default domain or custom domain
- No JavaScript required for core functionality

### Backend (Serverless)

- Step Functions orchestrate weather checks and site updates
- Lambda functions handle API calls and HTML generation
- S3 stores current site status for change detection
- All functions use ARM64 architecture

### Data Flow

1. EventBridge triggers Step Function every 10 minutes
2. Lambda fetches weather from OpenWeatherMap API
3. Compare against stored status in S3
4. If changed, generate new HTML and upload to S3
5. CloudFront serves updated content globally

## Development Constraints

### Weather Logic

- Weather conditions must be configurable via environment variables
- Support multiple condition types (snow, rain, temperature thresholds)
- API responses must be validated before processing
- Handle API rate limits and timeouts gracefully

### Error Handling

- Never show error messages to end users
- Log all errors to CloudWatch for debugging
- Fallback to last known good status on failures
- Include health checks for monitoring stack

### Performance

- HTML generation must be template-based for consistency
- Minimize bundle sizes for Lambda cold starts
- Use CDK bundling optimizations for all functions
- Cache weather API responses when appropriate
