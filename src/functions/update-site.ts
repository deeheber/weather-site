import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { Buffer } from 'buffer'

type FunctionInput = {
  SiteStatus: { Body: string }
  CurrentWeather: { Status: string }
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

  const weatherType = process.env.WEATHER_TYPE!
  let weather = weatherType
  if (
    weather.toLowerCase().endsWith('e') ||
    weather.toLowerCase().endsWith('s')
  ) {
    // Remove the last letter so adding 'ing' will work (kinda hacky)
    // Examples: 'haze' -> 'haz' -> 'hazing'
    // 'clouds' -> 'cloud' -> 'clouding'
    weather = weather.slice(0, -1)
  }

  // Should be something like 'no snow' or 'snow', 'no rain' or 'rain' etc.
  const status = event.CurrentWeather.Status
  const answerText = status.startsWith('no') ? 'NO.' : 'YES!!!'
  const backgroundColor = status.startsWith('no') ? 'green' : 'red'

  const htmlString = `<html>
  <head>
    <link rel="stylesheet" type="text/css" href="styles.css">
    <title>Is it ${weather}ing in ${process.env.LOCATION_NAME}?</title>
  </head>
  <body style="background-color: ${backgroundColor};">
    <div class="supercontainer">
      <div class="container">
        <div class="title">
          <h1>${answerText}</h1>
        </div>
        <div class="footer">
          <p>
            This site uses a weather API, so if you're wondering why it's not matching what you're seeing check <a href="${process.env.OPEN_WEATHER_URL}">here</a>
          </p>
          <p>
            Made by <a href="https://www.danielleheberling.xyz/">Danielle Heberling</a> - Inspired by <a href="http://isitsnowinginpdx.com/">Is it snowing in PDX</a>
          </p>
          <p>
            <a href="https://github.com/deeheber/weather-site">Code contributions welcome</a>
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`

  const s3 = new S3Client({ region: process.env.AWS_REGION })
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: 'index.html',
    Body: Buffer.from(htmlString),
    ContentType: 'text/html',
  }

  try {
    await s3.send(new PutObjectCommand(params))
  } catch (err) {
    console.error('Error', err)
    throw new Error('Failed to update site')
  }

  return {
    statusCode: 200,
    body: 'success',
  }
}
