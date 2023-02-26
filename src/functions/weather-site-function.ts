export const handler = async (event: any = {}): Promise<any> => {
  console.log('---------------------')
  console.log(event)
  console.log('---------------------')

  /*
   * TODO actually write code for this function
   * for now we're return a static response
   *
   * 1. HTTP call to Open Weather API
   * (axios or node-fetch, since it appears AWS doesn't
   * offer the native fetch in their node 18 runtime)
   * 2. Get/set Status
   * 3. Get/set Html
   */

  const snow =
    '<html><title>Is it snowing?</title><h1>It is snowing!!!</h1></html>'
  const noSnow =
    '<html><title>Is it snowing?</title><h1>It is not snowing.</h1></html>'

  const response = {
    Status: 'snow',
    Html: snow,
  }

  return {
    statusCode: 200,
    body: response,
  }
}
