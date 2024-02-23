#!/usr/bin/env node
import 'source-map-support/register'
import { App } from 'aws-cdk-lib'
import 'dotenv/config'

import { WeatherSiteStack } from '../lib/weather-site-stack'
import { AlertStack } from '../lib/alert-stack'

// Env var validation
const {
  AWS_DEFAULT_ACCOUNT_ID,
  AWS_DEFAULT_REGION,
  CDK_DEFAULT_ACCOUNT,
  CDK_DEFAULT_REGION,
  ALERT_EMAIL: alertEmail = '',
  DOMAIN_NAME: domainName = '',
  LOCATION_NAME: locationName = '',
  OPEN_WEATHER_URL: openWeatherUrl = '',
  SCHEDULES: schedules = 'rate(10 minutes)',
  SECRETS_EXTENSION_ARN: secretsExtensionArn = '',
  WEATHER_LOCATION_LAT: weatherLocationLat = '',
  WEATHER_LOCATION_LON: weatherLocationLon = '',
  WEATHER_SECRET_ARN: weatherSecretArn = '',
  WEATHER_TYPE: weatherType = 'snow',
} = process.env

const account = CDK_DEFAULT_ACCOUNT || AWS_DEFAULT_ACCOUNT_ID
const region = CDK_DEFAULT_REGION || AWS_DEFAULT_REGION

if (
  ![
    locationName,
    openWeatherUrl,
    secretsExtensionArn,
    weatherLocationLat,
    weatherLocationLon,
    weatherSecretArn,
  ].every((el) => !!el)
) {
  console.log(
    JSON.stringify(
      {
        locationName,
        openWeatherUrl,
        secretsExtensionArn,
        weatherLocationLat,
        weatherLocationLon,
        weatherSecretArn,
      },
      null,
      2,
    ),
  )
  throw new Error('Missing environment variables!')
}

/**
 * The domain certificate must be hosted in us-east-1
 *
 * Could set this up using cross region references
 * https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_certificatemanager-readme.html#cross-region-certificates
 *
 * But for now deciding to throw an error instead to keep this simple.
 * Contributions welcome for handling this better!
 */
if (domainName && region !== 'us-east-1') {
  throw new Error('Domain names can only be used in us-east-1')
}

const app = new App()

const weatherSiteStack = new WeatherSiteStack(app, 'WeatherSiteStack', {
  description: 'Contains the resources for the weather site',
  env: { account, region },
  domainName,
  locationName,
  openWeatherUrl,
  schedules: schedules.split(', '),
  secretsExtensionArn,
  weatherLocationLat,
  weatherLocationLon,
  weatherSecretArn,
  weatherType,
})

if (alertEmail !== '') {
  const alertsStack = new AlertStack(app, 'AlertStack', {
    description: `Contains the resources for the alerts for ${weatherSiteStack.stackName}`,
    stepFunction: weatherSiteStack.stepFunction,
    alertEmail,
  })
  alertsStack.addDependency(weatherSiteStack)
}
