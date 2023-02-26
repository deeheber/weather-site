import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import {
  LogLevel,
  Pass,
  StateMachine,
  StateMachineType,
} from 'aws-cdk-lib/aws-stepfunctions'
import { config } from 'dotenv'

config()

export class WeatherSiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const bucket = new Bucket(this, 'WeatherSiteBucket', {
      // TODO: add and parameterize bucket name
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      // TODO: Revisit this to possibly RETAIN
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const table = new Table(this, 'WeatherSiteTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const checkCurrentWeatherFunction = new NodejsFunction(
      this,
      'WeatherSiteFunction',
      {
        functionName: 'WeatherSiteFunction',
        runtime: Runtime.NODEJS_18_X,
        entry: 'dist/src/functions/weather-site-function.js',
        logRetention: RetentionDays.ONE_WEEK,
        architecture: Architecture.ARM_64,
        timeout: Duration.seconds(30),
        memorySize: 3008,
        environment: {
          WEATHER_API_KEY: process.env.WEATHER_API_KEY!,
          WEATHER_LOCATION_LAT: process.env.WEATHER_LOCATION_LAT!,
          WEATHER_LOCATION_LON: process.env.WEATHER_LOCATION_LON!,
          WEATHER_TYPE: process.env.WEATHER_TYPE!,
        },
      }
    )

    const logGroup = new LogGroup(this, 'WeatherSiteLogGroup', {
      logGroupName: 'WeatherSiteLogGroup',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const stateMachine = new StateMachine(this, 'WeatherSiteStateMachine', {
      stateMachineName: 'WeatherSiteStateMachine',
      stateMachineType: StateMachineType.EXPRESS,
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        includeExecutionData: true,
        // TODO: Revisit this to possibly set to ERROR
        level: LogLevel.ALL,
      },
      // TODO: Write SF definition
      definition: new Pass(this, 'StartState'),
    })

    // IAM Permissions
    bucket.grantWrite(stateMachine)
    table.grantReadWriteData(stateMachine)
    checkCurrentWeatherFunction.grantInvoke(stateMachine)

    // TODO: Add EventBridge Scheduler to invoke SF every 15 minutes
  }
}
