export const handler = async (event: any = {}): Promise<any> => {
  console.log(event)

  /*
   * TODO actually write code for this function
   * for now we're returning a static response
   *
   * 1. HTTP call to Open Weather API
   * (axios or node-fetch, since it appears AWS doesn't
   * offer the native fetch in their node 18 runtime)
   * 2. Set Status
   */

  // get value from current.weather.main.toLowerCase()
  // if there isn't a value there (unlikely) -> throw error
  return {
    statusCode: 200,
    // 'snow' or 'no snow'
    body: 'snow',
  }
}
