#!/usr/bin/env node
import 'source-map-support/register'
import 'dotenv/config'

import { App } from 'aws-cdk-lib'

import { AlertStack } from '../lib/alert-stack'
import { DomainStack } from '../lib/domain-stack'
import { WeatherSiteStack } from '../lib/weather-site-stack'

// Env var validation
const {
  AWS_DEFAULT_ACCOUNT_ID,
  AWS_DEFAULT_REGION,
  CDK_DEFAULT_ACCOUNT,
  CDK_DEFAULT_REGION,
  ALERT_EMAIL: alertEmail = undefined,
  DOMAIN_NAME: domainName = undefined,
  LOCATION_NAME: locationName = '',
  OPEN_WEATHER_URL: openWeatherUrl = '',
  SCHEDULES: schedules = 'rate(10 minutes)',
  STACK_PREFIX: stackPrefix = 'myStack',
  WEATHER_LOCATION_LAT: weatherLocationLat = '',
  WEATHER_LOCATION_LON: weatherLocationLon = '',
  WEATHER_TYPE: weatherType = 'snow',
} = process.env

const account = CDK_DEFAULT_ACCOUNT || AWS_DEFAULT_ACCOUNT_ID
const region = CDK_DEFAULT_REGION || AWS_DEFAULT_REGION

if (
  ![locationName, openWeatherUrl, weatherLocationLat, weatherLocationLon].every(
    (el) => !!el,
  )
) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        locationName,
        openWeatherUrl,
        weatherLocationLat,
        weatherLocationLon,
      },
      null,
      2,
    ),
  )
  throw new Error('Missing environment variables!')
}

const app = new App()

/**
 * For https with a custom domain in CloudFront
 * The ACM certificate must be issued in the us-east-1 region
 * https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html#https-requirements-aws-region
 */
let domainStack
if (domainName) {
  domainStack = new DomainStack(app, `${stackPrefix}-domain`, {
    description: ` Resources needed to have a custom domain for on ${stackPrefix}-weather`,
    crossRegionReferences: true,
    env: { account, region: 'us-east-1' },
    domainName,
  })
}

const weatherSiteStack = new WeatherSiteStack(app, `${stackPrefix}-weather`, {
  description: `Resources for ${stackPrefix}-weather, an informative weather website`,
  env: { account, region },
  crossRegionReferences: region === 'us-east-1' ? undefined : true,
  certificate: domainStack?.certificate,
  domainName,
  hostedZone: domainStack?.hostedZone,
  locationName,
  openWeatherUrl,
  schedules: schedules.split(', '),
  weatherLocationLat,
  weatherLocationLon,
  weatherType,
})

if (alertEmail) {
  const alertStack = new AlertStack(app, `${stackPrefix}-alert`, {
    description: `Alert resources for ${weatherSiteStack.id}`,
    stepFunction: weatherSiteStack.stepFunction,
    alertEmail,
  })
  alertStack.addDependency(weatherSiteStack)
}
