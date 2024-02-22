import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam'
import {
  Architecture,
  LayerVersion,
  LogFormat,
  Runtime,
  Tracing,
} from 'aws-cdk-lib/aws-lambda'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import {
  BlockPublicAccess,
  Bucket,
  BucketAccessControl,
} from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import { CfnSchedule } from 'aws-cdk-lib/aws-scheduler'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import {
  Choice,
  Condition,
  DefinitionBody,
  Errors,
  Fail,
  JitterType,
  JsonPath,
  LogLevel,
  Pass,
  StateMachine,
  StateMachineType,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions'
import {
  CallAwsService,
  LambdaInvoke,
} from 'aws-cdk-lib/aws-stepfunctions-tasks'
import * as path from 'path'

interface WeatherSiteStackProps extends StackProps {
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
  public stepFunction: StateMachine
  private bucket: Bucket

  constructor(scope: Construct, id: string, props: WeatherSiteStackProps) {
    super(scope, id, props)

    // If props.domainName
    // this.createHostedZone(props)
    // If props.domainName
    // this.createCertificate(props)
    this.createBucket(props)
    // this.createDistribution(props) OAI + s3Origin also needed
    // If props.domainName
    // this.createARecord(props)
    this.createStepFunction(props)
    this.addSchedules(props)
  }

  private createBucket(props: WeatherSiteStackProps) {
    // TODO remove website hosting + edit ACL stuff
    /**
      new Bucket(this, 'WeatherSiteBucket', {
        autoDeleteObjects: true,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        removalPolicy: RemovalPolicy.DESTROY,
      });
     */
    this.bucket = new Bucket(this, 'WeatherSiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // https://github.com/aws/aws-cdk/issues/25983
      // https://www.reddit.com/r/aws/comments/12tqqpw/aws_cdk_api_s3_putbucketpolicy_access_denied_and/
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    })
    // TODO add this after the distribution is created
    // should be in this.createDistribution method (doesn't exist yet)
    // Upload CSS file to the bucket
    new BucketDeployment(this, 'UploadCssFiles', {
      sources: [Source.asset(path.join(__dirname, '../src/site'))],
      destinationBucket: this.bucket,
      prune: false,
      logRetention: RetentionDays.ONE_WEEK,
    })
    // TODO remove this after the distribution is created
    new CfnOutput(this, 'siteURL', {
      value: this.bucket.bucketWebsiteUrl,
    })
  }

  private createStepFunction(props: WeatherSiteStackProps) {
    // SSM Parameter to store the current site status
    const siteStatusParam = new StringParameter(this, 'SiteStatusParam', {
      parameterName: 'SiteStatus',
      stringValue: 'Initial value',
      description: `Current status of the weather site for ${this.stackName}`,
    })

    const checkCurrentWeatherLogGroup = new LogGroup(
      this,
      'checkCurrentWeatherLogGroup',
      {
        logGroupName: '/aws/lambda/weatherSite-checkCurrentWeatherFunction',
        retention: RetentionDays.ONE_WEEK,
      },
    )
    const checkCurrentWeatherFunction = new NodejsFunction(
      this,
      'checkCurrentWeatherFunction',
      {
        functionName: 'checkCurrentWeatherFunction',
        runtime: Runtime.NODEJS_LATEST,
        entry: 'dist/src/functions/check-current-weather.js',
        logFormat: LogFormat.JSON,
        logGroup: checkCurrentWeatherLogGroup,
        tracing: Tracing.ACTIVE,
        architecture: Architecture.ARM_64,
        timeout: Duration.seconds(30),
        memorySize: 3008,
        environment: {
          WEATHER_LOCATION_LAT: props.weatherLocationLat,
          WEATHER_LOCATION_LON: props.weatherLocationLon,
          WEATHER_TYPE: props.weatherType,
        },
        layers: [
          LayerVersion.fromLayerVersionArn(
            this,
            'SecretsManagerLayer',
            props.secretsExtensionArn,
          ),
        ],
      },
    )
    checkCurrentWeatherFunction.addToRolePolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.weatherSecretArn],
      }),
    )

    const updateSiteLogGroup = new LogGroup(this, 'updateSiteLogGroup', {
      logGroupName: '/aws/lambda/weatherSite-updateSiteFunction',
      retention: RetentionDays.ONE_WEEK,
    })
    const updateSiteFunction = new NodejsFunction(this, 'updateSiteFunction', {
      functionName: 'updateSiteFunction',
      runtime: Runtime.NODEJS_LATEST,
      entry: 'dist/src/functions/update-site.js',
      logFormat: LogFormat.JSON,
      logGroup: updateSiteLogGroup,
      tracing: Tracing.ACTIVE,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(30),
      memorySize: 3008,
      environment: {
        BUCKET_NAME: this.bucket.bucketName,
        LOCATION_NAME: props.locationName,
        OPEN_WEATHER_URL: props.openWeatherUrl,
        WEATHER_TYPE: props.weatherType,
      },
    })
    this.bucket.grantWrite(updateSiteFunction)

    // Tasks for Step Function Definition
    const getSiteStatus = new CallAwsService(this, 'Get site status', {
      service: 'ssm',
      action: 'getParameter',
      parameters: {
        Name: siteStatusParam.parameterName,
      },
      iamResources: [siteStatusParam.parameterArn],
      resultPath: '$.SiteStatus',
      resultSelector: {
        'Body.$': '$.Parameter.Value',
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
    checkCurrentWeather.addRetry({
      errors: [Errors.ALL],
      maxAttempts: 3,
      interval: Duration.seconds(2),
      backoffRate: 2,
      jitterStrategy: JitterType.FULL,
    })

    const siteIsUpToDate = new Pass(this, 'Site is up to date')

    const updateSite = new LambdaInvoke(this, 'Update site', {
      lambdaFunction: updateSiteFunction,
      payload: TaskInput.fromJsonPathAt('$'),
      comment: 'Update site with new weather data ',
      resultPath: '$.BucketPutResult',
      resultSelector: { 'Body.$': '$.Payload.body' },
    })
    updateSite.addRetry({
      errors: [Errors.ALL],
      maxAttempts: 3,
      interval: Duration.seconds(2),
      backoffRate: 2,
      jitterStrategy: JitterType.FULL,
    })
    updateSite.addCatch(new Fail(this, 'Site update failure'))
    updateSite.next(
      new CallAwsService(this, 'Update site status', {
        service: 'ssm',
        action: 'putParameter',
        parameters: {
          Name: siteStatusParam.parameterName,
          Value: JsonPath.stringAt('$.CurrentWeather.Status'),
          Overwrite: true,
        },
        iamResources: [siteStatusParam.parameterArn],
        resultPath: '$.SsmPutResult',
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
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        includeExecutionData: true,
        // TODO: Consider setting to ERROR if there's a need to save $$$
        level: LogLevel.ALL,
      },
      definitionBody: DefinitionBody.fromChainable(definition),
    })
  }

  private addSchedules(props: WeatherSiteStackProps) {
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
    for (let i = 0; i < props.schedules.length; i++) {
      // TODO: Update to L2 construct when available
      // https://github.com/aws/aws-cdk/issues/23394
      const scheduleId = `WeatherSiteScheduler-${i}`
      new CfnSchedule(this, scheduleId, {
        description: 'Scheduler to invoke WeatherSiteStateMachine',
        flexibleTimeWindow: {
          mode: 'OFF',
        },
        name: scheduleId,
        scheduleExpression: props.schedules[i],
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
