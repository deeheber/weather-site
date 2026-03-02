#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import { z } from 'zod'

import { DomainStack } from '../lib/domain-stack'
import { WeatherSiteStack } from '../lib/weather-site-stack'

const envSchema = z
  .object({
    CDK_DEFAULT_ACCOUNT: z.string().optional(),
    CDK_DEFAULT_REGION: z.string().optional(),
    AWS_DEFAULT_ACCOUNT_ID: z.string().optional(),
    AWS_DEFAULT_REGION: z.string().optional(),
    ALERT_EMAIL: z.email().optional(),
    DOMAIN_NAME: z.string().min(1).optional(),
    LOCATION_NAME: z.string().min(1, 'LOCATION_NAME is required'),
    OPEN_WEATHER_URL: z.url('OPEN_WEATHER_URL must be a valid URL'),
    SCHEDULES: z.string().default('rate(10 minutes)'),
    STACK_PREFIX: z.string().default('myStack'),
    WEATHER_LOCATION_LAT: z.string().min(1, 'WEATHER_LOCATION_LAT is required'),
    WEATHER_LOCATION_LON: z.string().min(1, 'WEATHER_LOCATION_LON is required'),
    WEATHER_TYPE: z.string().default('snow'),
  })
  .refine((data) => data.CDK_DEFAULT_ACCOUNT || data.AWS_DEFAULT_ACCOUNT_ID, {
    message:
      'AWS account not found. Configure AWS CLI credentials or set AWS_DEFAULT_ACCOUNT_ID.',
  })
  .refine((data) => data.CDK_DEFAULT_REGION || data.AWS_DEFAULT_REGION, {
    message:
      'AWS region not found. Configure AWS CLI credentials or set AWS_DEFAULT_REGION.',
  })

const env = envSchema.parse(process.env)

const account = (env.CDK_DEFAULT_ACCOUNT || env.AWS_DEFAULT_ACCOUNT_ID)!
const region = (env.CDK_DEFAULT_REGION || env.AWS_DEFAULT_REGION)!

const app = new App()

/**
 * For https with a custom domain in CloudFront
 * The ACM certificate must be issued in the us-east-1 region
 * https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html#https-requirements-aws-region
 */
let domainStack
if (env.DOMAIN_NAME) {
  domainStack = new DomainStack(app, `${env.STACK_PREFIX}-domain`, {
    description: ` Resources needed to have a custom domain for on ${env.STACK_PREFIX}-weather`,
    crossRegionReferences: true,
    env: { account, region: 'us-east-1' },
    domainName: env.DOMAIN_NAME,
  })
}

new WeatherSiteStack(app, `${env.STACK_PREFIX}-weather`, {
  description: `Resources for ${env.STACK_PREFIX}-weather, an informative weather website`,
  env: { account, region },
  crossRegionReferences: region === 'us-east-1' ? undefined : true,
  alertEmail: env.ALERT_EMAIL,
  certificate: domainStack?.certificate,
  domainName: env.DOMAIN_NAME,
  hostedZone: domainStack?.hostedZone,
  locationName: env.LOCATION_NAME,
  openWeatherUrl: env.OPEN_WEATHER_URL,
  schedules: env.SCHEDULES.split(', '),
  weatherLocationLat: env.WEATHER_LOCATION_LAT,
  weatherLocationLon: env.WEATHER_LOCATION_LON,
  weatherType: env.WEATHER_TYPE,
})
