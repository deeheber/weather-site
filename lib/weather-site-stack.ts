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
  DynamoAttributeValue,
  DynamoGetItem,
  DynamoUpdateItem,
  LambdaInvoke,
} from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources'
import * as scheduler from 'aws-cdk-lib/aws-scheduler'
import * as iam from 'aws-cdk-lib/aws-iam'
import { config } from 'dotenv'
import * as path from 'path'
config()

export class WeatherSiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const bucket = new Bucket(this, 'WeatherSiteBucket', {
      // TODO: Uncomment to use a custom bucket name
      // bucketName: process.env.BUCKET_NAME,
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })
    // Upload CSS files to the bucket
    new BucketDeployment(this, 'UploadCssFiles', {
      sources: [Source.asset(path.join(__dirname, '../src/site'))],
      destinationBucket: bucket,
    })

    const table = new Table(this, 'WeatherSiteTable', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    })
    // Add an item to the table to track the current weather
    new AwsCustomResource(this, 'initDBResource', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: table.tableName,
          Item: {
            PK: { S: 'SiteStatus' },
            Weather: { S: 'initial state' },
          },
        },
        physicalResourceId: PhysicalResourceId.of('initDBResource'),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [table.tableArn],
      }),
    })

    const checkCurrentWeatherFunction = new NodejsFunction(
      this,
      'checkCurrentWeatherFunction',
      {
        functionName: 'checkCurrentWeatherFunction',
        runtime: Runtime.NODEJS_18_X,
        entry: 'dist/src/functions/check-current-weather.js',
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

    const updateSiteFunction = new NodejsFunction(this, 'updateSiteFunction', {
      functionName: 'updateSiteFunction',
      runtime: Runtime.NODEJS_18_X,
      entry: 'dist/src/functions/update-site.js',
      logRetention: RetentionDays.ONE_WEEK,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(30),
      memorySize: 3008,
      environment: {
        BUCKET_NAME: bucket.bucketName,
        LOCATION_NAME: process.env.LOCATION_NAME!,
        OPEN_WEATHER_URL: process.env.OPEN_WEATHER_URL!,
        WEATHER_TYPE: process.env.WEATHER_TYPE!,
      },
    })
    bucket.grantWrite(updateSiteFunction)

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
        resultSelector: { 'Status.$': '$.Payload.body' },
      }
    )

    const siteIsUpToDate = new Pass(this, 'Site is up to date')
    /**
     * I tried the s3:PutOjbect direct integration, but was unable to
     *  remove the "" from around the body
     * (needed for HTML to display in a browser properly).
     *
     * So I used the Lambda function to do the update where I
     * could send a Buffer as the body of the PutObject command.
     *
     * Would much prefer the direct integration, suggestions welcome.
     */
    const updateSite = new LambdaInvoke(this, 'Update site', {
      lambdaFunction: updateSiteFunction,
      payload: TaskInput.fromJsonPathAt('$'),
      comment: 'Update site with new weather data ',
      resultPath: '$.BucketPutResult',
      resultSelector: { 'Body.$': '$.Payload.body' },
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
            JsonPath.stringAt('$.CurrentWeather.Status')
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
              '$.CurrentWeather.Status'
            ),
            siteIsUpToDate
          )
          .otherwise(updateSite)
      )
    // End of Tasks for Step Function Definition

    const logGroup = new LogGroup(this, 'WeatherSiteLogGroup', {
      logGroupName: 'WeatherSiteLogGroup',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const stepFunction = new StateMachine(this, 'WeatherSiteStateMachine', {
      stateMachineName: 'WeatherSiteStateMachine',
      stateMachineType: StateMachineType.EXPRESS,
      logs: {
        destination: logGroup,
        includeExecutionData: true,
        // TODO: Consider setting to ERROR if there's a need to save $$$
        level: LogLevel.ALL,
      },
      definition,
    })

    new CfnOutput(this, 'siteURL', {
      value: bucket.bucketWebsiteUrl,
    })

    // Resources for scheduler to periodically invoke the step function
    const invokeStepFunctionPolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          resources: [stepFunction.stateMachineArn],
          actions: ['states:StartExecution'],
        }),
      ],
    })
    const schedulerToStepFunctionRole = new iam.Role(
      this,
      'schedulerToStepFunctionRole',
      {
        assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
        description: 'Role for scheduler to invoke step function',
        inlinePolicies: {
          InvokeSFPolicy: invokeStepFunctionPolicy,
        },
      }
    )
    // TODO: Update to L2 construct when available
    // https://github.com/aws/aws-cdk/issues/23394
    new scheduler.CfnSchedule(this, 'WeatherSiteScheduler', {
      name: 'WeatherSiteScheduler',
      scheduleExpression: 'rate(10 minutes)',
      flexibleTimeWindow: {
        mode: 'OFF',
      },
      target: {
        arn: stepFunction.stateMachineArn,
        roleArn: schedulerToStepFunctionRole.roleArn,
      },
    })
  }
}
