#!/usr/bin/env node
import 'source-map-support/register'
import 'dotenv/config'

import { App } from 'aws-cdk-lib'

import { AlertStack } from '../lib/alert-stack'
import { WeatherSiteStack } from '../lib/weather-site-stack'

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

const weatherSiteStack = new WeatherSiteStack(app, `${stackPrefix}-weather`, {
  description: `Resources for ${stackPrefix}-weather, an informative weather website`,
  env: { account, region },
  domainName,
  locationName,
  openWeatherUrl,
  schedules: schedules.split(', '),
  weatherLocationLat,
  weatherLocationLon,
  weatherType,
})

if (alertEmail !== '') {
  const alertStack = new AlertStack(app, `${stackPrefix}-alert`, {
    description: `Alert resources for ${weatherSiteStack.id}`,
    stepFunction: weatherSiteStack.stepFunction,
    alertEmail,
  })
  alertStack.addDependency(weatherSiteStack)
}
