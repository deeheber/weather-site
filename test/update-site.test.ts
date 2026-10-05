import { Buffer } from 'buffer'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

import { handler } from '../src/functions/update-site'

function mockUpload() {
  return vi.spyOn(S3Client.prototype, 'send').mockResolvedValue(undefined)
}

function uploadedHtml(send: ReturnType<typeof mockUpload>): string {
  expect(send).toHaveBeenCalledTimes(1)
  const command = send.mock.calls[0][0]
  expect(command).toBeInstanceOf(PutObjectCommand)
  if (!(command instanceof PutObjectCommand)) {
    throw new Error('Expected a PutObjectCommand')
  }

  expect(command.input).toMatchObject({
    Bucket: 'test-weather-bucket',
    Key: 'index.html',
    ContentType: 'text/html',
  })
  const body = command.input.Body
  if (typeof body === 'string') {
    return body
  }
  if (!(body instanceof Uint8Array)) {
    throw new Error('Expected an HTML upload body')
  }
  return Buffer.from(body).toString('utf8')
}

describe('Site-update handler', () => {
  beforeEach(() => {
    vi.stubEnv('WEATHER_TYPE', 'rain')
    vi.stubEnv('LOCATION_NAME', 'Test City')
    vi.stubEnv('OPEN_WEATHER_URL', 'https://openweathermap.org/city/12345')
    vi.stubEnv('BUCKET_NAME', 'test-weather-bucket')
    vi.stubEnv('AWS_REGION', 'us-west-2')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  test.each([
    {
      weatherType: 'rain',
      currentWeather: 'rain',
      answer: 'YES!!!',
      color: 'red',
      titleWeather: 'raining',
    },
    {
      weatherType: 'rain',
      currentWeather: 'no rain',
      answer: 'NO.',
      color: 'green',
      titleWeather: 'raining',
    },
    {
      weatherType: 'haze',
      currentWeather: 'haze',
      answer: 'YES!!!',
      color: 'red',
      titleWeather: 'hazing',
    },
    {
      weatherType: 'clouds',
      currentWeather: 'clouds',
      answer: 'YES!!!',
      color: 'red',
      titleWeather: 'clouding',
    },
  ])(
    'uploads the page for $currentWeather',
    async ({ weatherType, currentWeather, answer, color, titleWeather }) => {
      vi.stubEnv('WEATHER_TYPE', weatherType)
      const send = mockUpload()

      const response = await handler({ CurrentWeather: currentWeather })
      const html = uploadedHtml(send)

      expect(html).toContain(`<h1>${answer}</h1>`)
      expect(html).toContain(`<body style="background-color: ${color};">`)
      expect(html).toContain(
        `<title>Is it ${titleWeather} in Test City?</title>`,
      )
      expect(html).toContain(
        '<a href="https://openweathermap.org/city/12345">here</a>',
      )
      expect(response).toEqual({ statusCode: 200, body: 'success' })
    },
  )

  test('rejects with the original cause when the upload fails', async () => {
    const originalError = new Error('S3 upload failed')
    mockUpload().mockRejectedValue(originalError)

    const error: unknown = await handler({ CurrentWeather: 'rain' }).then(
      () => {
        throw new Error('Expected the handler to reject')
      },
      (reason: unknown) => reason,
    )

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) {
      throw new Error('Expected an Error rejection')
    }
    expect(error.message).toBe('Failed to update site')
    expect(error.cause).toBe(originalError)
  })
})
