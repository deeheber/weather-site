import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { Bucket } from 'aws-cdk-lib/aws-s3'
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import {
  Choice,
  Condition,
  Fail,
  JsonPath,
  LogLevel,
  Pass,
  StateMachine,
  StateMachineType,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions'
import {
  CallAwsService,
  DynamoAttributeValue,
  DynamoGetItem,
  DynamoUpdateItem,
  LambdaInvoke,
} from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
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
      partitionKey: { name: 'PK', type: AttributeType.STRING },
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

    // Tasks for Step Function Definition
    const getSiteStatus = new DynamoGetItem(this, 'Get site status', {
      key: { PK: DynamoAttributeValue.fromString('SiteStatus') },
      table,
      comment: 'Check current status of site',
      resultPath: '$.SiteStatus',
      resultSelector: {
        'Body.$': '$.Item.Weather.S',
      },
    })

    const checkCurrentWeather = new LambdaInvoke(
      this,
      'Check current weather',
      {
        lambdaFunction: checkCurrentWeatherFunction,
        payload: TaskInput.fromJsonPathAt('$'),
        comment: 'Get current weather using external API',
        resultPath: '$.CurrentWeather',
        resultSelector: { 'Body.$': '$.Payload.body' },
      }
    )

    const siteIsUpToDate = new Pass(this, 'Site is up to date')

    const updateSite = new CallAwsService(this, 'Update site', {
      resultPath: '$.BucketPutResult',
      comment: 'Update site with new weather data ',
      service: 's3',
      action: 'putObject',
      iamResources: ['*'],
      parameters: {
        ContentType: 'text/html',
        Bucket: bucket.bucketName,
        Key: 'index.html',
        // TODO: figure out how to get rid of extra quotes
        //'Body.$': '$.CurrentWeather.Body.Html',
        Body: JsonPath.stringAt('$.CurrentWeather.Body.Html'),
      },
      additionalIamStatements: [
        new PolicyStatement({
          actions: ['s3:getObject'],
          resources: [bucket.bucketArn],
        }),
      ],
    })
    updateSite.addCatch(new Fail(this, 'Site update failure'))
    updateSite.next(
      new DynamoUpdateItem(this, 'Update site status', {
        key: {
          PK: DynamoAttributeValue.fromString('SiteStatus'),
        },
        table,
        expressionAttributeValues: {
          ':currentWeather': DynamoAttributeValue.fromString(
            JsonPath.stringAt('$.CurrentWeather.Body.Status')
          ),
        },
        updateExpression: 'SET Weather = :currentWeather',
        comment: 'Update site status in DynamoDB',
        resultPath: '$.DDBUpdateItemResult',
      })
    )

    const definition = getSiteStatus
      .next(checkCurrentWeather)
      .next(
        new Choice(this, 'Is site up to date?')
          .when(
            Condition.stringEqualsJsonPath(
              '$.SiteStatus.Body',
              '$.CurrentWeather.Body.Status'
            ),
            siteIsUpToDate
          )
          .otherwise(updateSite)
      )

    new StateMachine(this, 'WeatherSiteStateMachine', {
      stateMachineName: 'WeatherSiteStateMachine',
      stateMachineType: StateMachineType.EXPRESS,
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        includeExecutionData: true,
        // TODO: Revisit this to possibly set to ERROR to save $$$
        level: LogLevel.ALL,
      },
      definition,
    })

    new CfnOutput(this, 'siteURL', {
      value: bucket.bucketWebsiteUrl,
    })

    // TODO: Add EventBridge Scheduler to invoke SF every 15 minutes
  }
}
