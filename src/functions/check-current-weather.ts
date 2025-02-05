/*global fetch*/
type FunctionInput = {
  SiteStatus: { Body: string }
}

type FunctionResponse = {
  statusCode: number
  body: string
}

export const handler = async (
  event: FunctionInput,
): Promise<FunctionResponse> => {
  console.log('EVENT')
  console.log(event)

  try {
    // Fetch secret (weather API key) from the secrets manager
    const secretUrl =
      'http://localhost:2773/secretsmanager/get?secretId=weather-site-api-key'
    const secretResponse = await fetch(secretUrl, {
      method: 'GET',
      headers: {
        'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN!,
      },
    })

    if (!secretResponse.ok) {
      throw new Error(
        `Error occured while requesting secret. Status: ${secretResponse.status}`,
      )
    }
    const { SecretString } = (await secretResponse.json()) as {
      SecretString: string
    }

    // Fetch weather data from the OpenWeather API
    const weatherType = process.env.WEATHER_TYPE!.toLowerCase()

    const response = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${process.env.WEATHER_LOCATION_LAT}&lon=${process.env.WEATHER_LOCATION_LON}&exclude=minutely,hourly,daily,alerts&appid=${SecretString}`,
    )
    // https://github.com/node-fetch/node-fetch/issues/1262
    const responseBody = await response.json()

    // Generate response
    let currentWeather = ''
    if (responseBody?.current?.weather.length > 0) {
      currentWeather = responseBody?.current?.weather[0].main.toLowerCase()
    } else {
      console.error('No weather data found')
      throw new Error('No weather data found')
    }

    console.log('RESPONSE BODY')
    console.log(responseBody)
    console.log(`Current weather is ${currentWeather}`)

    return {
      statusCode: 200,
      // ex. 'snow' or 'no snow', 'rain' or 'no rain' etc.
      body: currentWeather.includes(weatherType)
        ? `${weatherType}`
        : `no ${weatherType}`,
    }
  } catch (err) {
    console.error('Error', err)

    if (err instanceof Error) {
      throw new Error(`${err.message}`)
    }

    throw new Error('Unknown error ocurred')
  }
}
