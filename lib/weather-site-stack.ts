import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class WeatherSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'WeatherSiteQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    /**
     * TODO:
     * - S3 bucket
     *  - Parameterized bucket name
     *  - Enable static website hosting
     * - DynamoDB table
     *  - Partition key: PK
     *  - Capacity mode: on-demand ???
     * - Lambda function
     *  - Parameterized Weather API key
     *  - Parameterized Weather Location Lat
     *  - Parameterized Weather Location Lon
     *  - Parameterized Weather Type
     *  - Write code for Lambda function
     * - Step Function State Machine
     *  - SF execution role (S3 PutObject, DDB GetItem UpdateItem, Lambda Invoke)
     *  - SF definition
     * - EventBridge Scheduler to invoke SF every 15 minutes
     */
  }
}
