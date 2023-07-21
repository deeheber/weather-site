type FunctionInput = {
  SiteStatus: { Body: string }
}

type FunctionResponse = {
  statusCode: number
  body: string
}

export const handler = async (
  event: FunctionInput
): Promise<FunctionResponse> => {
  console.log(event)

  try {
    const weatherType = process.env.WEATHER_TYPE!.toLowerCase()

    const response = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${process.env.WEATHER_LOCATION_LAT}&lon=${process.env.WEATHER_LOCATION_LON}&exclude=minutely,hourly,daily,alerts&appid=${process.env.WEATHER_API_KEY}`
    )
    // https://github.com/node-fetch/node-fetch/issues/1262
    const responseBody = (await response.json()) as any

    let currentWeather
    if (responseBody?.current?.weather.length > 0) {
      currentWeather = responseBody?.current?.weather[0].main.toLowerCase()
    } else {
      console.log('No weather data found')
      throw new Error('No weather data found')
    }

    console.log(`Current weather is ${currentWeather}`)

    return {
      statusCode: 200,
      // ex. 'snow' or 'no snow', 'rain' or 'no rain' etc.
      body: currentWeather.includes(weatherType)
        ? `${weatherType}`
        : `no ${weatherType}`,
    }
  } catch (err) {
    console.log('Error', err)

    if (err instanceof Error) {
      throw new Error(`${err.message}`)
    }

    throw new Error('Unknown error ocurred')
  }
}
