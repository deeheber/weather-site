#!/usr/bin/env node
import 'source-map-support/register'
import { App } from 'aws-cdk-lib'
import 'dotenv/config'

import { WeatherSiteStack } from '../lib/weather-site-stack'
import { AlertStack } from '../lib/alert-stack'

// Env var validation
// TODO add domainName (optional) env var
const {
  ALERT_EMAIL: alertEmail = '',
  LOCATION_NAME: locationName = '',
  OPEN_WEATHER_URL: openWeatherUrl = '',
  SCHEDULES: schedules = 'rate(10 minutes)',
  SECRETS_EXTENSION_ARN: secretsExtensionArn = '',
  WEATHER_LOCATION_LAT: weatherLocationLat = '',
  WEATHER_LOCATION_LON: weatherLocationLon = '',
  WEATHER_SECRET_ARN: weatherSecretArn = '',
  WEATHER_TYPE: weatherType = 'snow',
} = process.env

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

const app = new App()

const weatherSiteStack = new WeatherSiteStack(app, 'WeatherSiteStack', {
  description: 'Contains the resources for the weather site',
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
