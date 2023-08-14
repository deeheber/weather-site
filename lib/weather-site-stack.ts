import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
} from 'aws-cdk-lib/aws-s3'
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Architecture, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import {
  Choice,
  Condition,
  DefinitionBody,
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
import { CfnSchedule } from 'aws-cdk-lib/aws-scheduler'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import * as path from 'path'

interface WeatherSiteStackProps extends StackProps {
  bucketName?: string
  locationName: string
  openWeatherUrl: string
  schedules: string[]
  secretsExtensionArn: string
  weatherLocationLat: string
  weatherLocationLon: string
  weatherSecretArn: string
  weatherType: string
}

export class WeatherSiteStack extends Stack {
  public readonly stepFunction: StateMachine

  constructor(scope: Construct, id: string, props: WeatherSiteStackProps) {
    super(scope, id, props)
    const {
      bucketName,
      locationName,
      openWeatherUrl,
      schedules,
      secretsExtensionArn,
      weatherLocationLat,
      weatherLocationLon,
      weatherSecretArn,
      weatherType,
    } = props

    const bucket = new Bucket(this, 'WeatherSiteBucket', {
      bucketName,
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // https://github.com/aws/aws-cdk/issues/25983
      // https://www.reddit.com/r/aws/comments/12tqqpw/aws_cdk_api_s3_putbucketpolicy_access_denied_and/
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    })
    // Upload CSS file to the bucket
    new BucketDeployment(this, 'UploadCssFiles', {
      sources: [Source.asset(path.join(__dirname, '../src/site'))],
      destinationBucket: bucket,
      prune: false,
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
          WEATHER_LOCATION_LAT: weatherLocationLat,
          WEATHER_LOCATION_LON: weatherLocationLon,
          WEATHER_TYPE: weatherType,
        },
        layers: [
          LayerVersion.fromLayerVersionArn(
            this,
            'SecretsManagerLayer',
            secretsExtensionArn,
          ),
        ],
      },
    )
    checkCurrentWeatherFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [weatherSecretArn],
      }),
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
        LOCATION_NAME: locationName,
        OPEN_WEATHER_URL: openWeatherUrl,
        WEATHER_TYPE: weatherType,
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
      },
    )

    const siteIsUpToDate = new Pass(this, 'Site is up to date')

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
            JsonPath.stringAt('$.CurrentWeather.Status'),
          ),
        },
        updateExpression: 'SET Weather = :currentWeather',
        comment: 'Update site status in DynamoDB',
        resultPath: '$.DDBUpdateItemResult',
      }),
    )

    const definition = getSiteStatus
      .next(checkCurrentWeather)
      .next(
        new Choice(this, 'Is site up to date?')
          .when(
            Condition.stringEqualsJsonPath(
              '$.SiteStatus.Body',
              '$.CurrentWeather.Status',
            ),
            siteIsUpToDate,
          )
          .otherwise(updateSite),
      )
    // End of Tasks for Step Function Definition

    const logGroup = new LogGroup(this, 'WeatherSiteLogGroup', {
      logGroupName: 'WeatherSiteLogGroup',
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const stateMachineName = 'WeatherSiteStateMachine'
    this.stepFunction = new StateMachine(this, `${stateMachineName}`, {
      stateMachineName: 'WeatherSiteStateMachine',
      stateMachineType: StateMachineType.EXPRESS,
      logs: {
        destination: logGroup,
        includeExecutionData: true,
        // TODO: Consider setting to ERROR if there's a need to save $$$
        level: LogLevel.ALL,
      },
      definitionBody: DefinitionBody.fromChainable(definition),
    })

    new CfnOutput(this, 'siteURL', {
      value: bucket.bucketWebsiteUrl,
    })

    // Permissions for EventBridge Schedules to invoke the Step Function
    const schedulerToStepFunctionRole = new Role(
      this,
      'schedulerToStepFunctionRole',
      {
        assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
        description: 'Role for EB Schedules to invoke WeatherSiteStateMachine',
      },
    )
    this.stepFunction.grantStartExecution(schedulerToStepFunctionRole)

    // EventBridge Schedules to invoke the Step Function
    for (let i = 0; i < schedules.length; i++) {
      // TODO: Update to L2 construct when available
      // https://github.com/aws/aws-cdk/issues/23394
      const scheduleId = `WeatherSiteScheduler-${i}`
      new CfnSchedule(this, scheduleId, {
        description: 'Scheduler to invoke WeatherSiteStateMachine',
        flexibleTimeWindow: {
          mode: 'OFF',
        },
        name: scheduleId,
        scheduleExpression: schedules[i],
        scheduleExpressionTimezone: 'America/Los_Angeles',
        state: 'ENABLED',
        target: {
          arn: this.stepFunction.stateMachineArn,
          roleArn: schedulerToStepFunctionRole.roleArn,
          retryPolicy: {
            maximumEventAgeInSeconds: 90,
            maximumRetryAttempts: 2,
          },
        },
      })
    }
  }
}
