import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { Buffer } from 'buffer'

export const handler = async (event: any = {}): Promise<any> => {
  console.log(event)

  // TODO: get status from the event (event.CurrentWeather.Status) and pick the proper HTML
  const snow =
    '<html><title>Is it snowing?</title><h1>It is snowing!!!</h1></html>'
  const noSnow =
    '<html><title>Is it snowing?</title><h1>It is not snowing.</h1></html>'

  const s3 = new S3Client({ region: process.env.AWS_REGION })
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: 'index.html',
    Body: Buffer.from(snow),
    ContentType: 'text/html',
  }

  try {
    await s3.send(new PutObjectCommand(params))
  } catch (err) {
    console.log('Error', err)
    throw new Error('Failed to update site')
  }

  return {
    statusCode: 200,
    body: 'success',
  }
}
