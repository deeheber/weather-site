import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  SecretValue,
  Stack,
  StackProps,
  TimeZone,
} from 'aws-cdk-lib'
import {
  Certificate,
  CertificateValidation,
} from 'aws-cdk-lib/aws-certificatemanager'
import {
  Distribution,
  Function,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront'
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import {
  Authorization,
  Connection,
  HttpParameter,
} from 'aws-cdk-lib/aws-events'
import {
  Architecture,
  LoggingFormat,
  Runtime,
  Tracing,
} from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53'
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets'
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3'
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment'
import {
  Schedule,
  ScheduleExpression,
  ScheduleTargetInput,
} from 'aws-cdk-lib/aws-scheduler'
import { StepFunctionsStartExecution } from 'aws-cdk-lib/aws-scheduler-targets'
import { StringParameter } from 'aws-cdk-lib/aws-ssm'
import {
  Choice,
  Condition,
  DefinitionBody,
  Errors,
  Fail,
  JitterType,
  LogLevel,
  Parallel,
  Pass,
  QueryLanguage,
  StateMachine,
  StateMachineType,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions'
import {
  CallAwsService,
  HttpInvoke,
  LambdaInvoke,
} from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { Construct } from 'constructs'
import * as path from 'path'

interface WeatherSiteStackProps extends StackProps {
  domainName: string
  locationName: string
  openWeatherUrl: string
  schedules: string[]
  weatherLocationLat: string
  weatherLocationLon: string
  weatherType: string
}

export class WeatherSiteStack extends Stack {
  public id: string
  private props: WeatherSiteStackProps
  private hostedZone: HostedZone
  private certificate: Certificate
  private redirectCertificate: Certificate
  private distribution: Distribution
  public stepFunction: StateMachine
  private bucket: Bucket

  constructor(scope: Construct, id: string, props: WeatherSiteStackProps) {
    super(scope, id, props)
    this.id = id
    this.props = props

    if (this.props.domainName) {
      this.createHostedZone()
      this.createCertificates()
      this.createRedirect()
    }

    this.createBucket()
    this.createDistribution()
    this.createStepFunction()
    this.addScheduler()
  }

  private createHostedZone() {
    this.hostedZone = new HostedZone(this, `${this.id}-hosted-zone`, {
      zoneName: this.props.domainName,
    })
  }

  private createCertificates() {
    this.certificate = new Certificate(this, `${this.id}-cert`, {
      domainName: this.props.domainName,
      validation: CertificateValidation.fromDns(this.hostedZone),
    })

    this.redirectCertificate = new Certificate(this, `${this.id}-cert-www`, {
      domainName: `www.${this.props.domainName}`,
      validation: CertificateValidation.fromDns(this.hostedZone),
    })
  }

  private createRedirect() {
    /**
     * Redirect from www to non-www
     * AWS doesn't provide a nicer way to do this 👎🏻
     * Thanks to https://paramvirsingh.com/post/article/redirect-www-to-naked-domain-aws-cloudfront for this idea!
     *
     * www -> CloudFront Dist 1 -> CloudFront function redirect -> non-www -> CloudFront Dist 2
     */
    const redirectFunction = new Function(
      this,
      `${this.id}-redirect-function`,
      {
        code: FunctionCode.fromInline(`function handler(event) {
          console.log(event.request.headers);
          console.log(event.request);
          var response = {
              statusCode: 302,
              statusDescription: 'Found',
              headers: {
                  "location": { "value": 'https://${this.props.domainName}'+event.request.uri }    
              }
            }
          return response;
      }`),
        runtime: FunctionRuntime.JS_2_0,
      },
    )

    const redirectDistribution = new Distribution(
      this,
      `${this.id}-redirect-dist`,
      {
        defaultBehavior: {
          origin: new HttpOrigin(this.props.domainName),
          functionAssociations: [
            {
              function: redirectFunction,
              eventType: FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
        domainNames: [`www.${this.props.domainName}`],
        certificate: this.redirectCertificate,
      },
    )

    new ARecord(this, `${this.id}-a-record-www`, {
      zone: this.hostedZone,
      recordName: `www.${this.props.domainName}`,
      target: RecordTarget.fromAlias(
        new CloudFrontTarget(redirectDistribution),
      ),
    })
  }

  private createBucket() {
    this.bucket = new Bucket(this, `${this.id}-bucket`, {
      autoDeleteObjects: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
    })
  }

  private createDistribution() {
    this.distribution = new Distribution(this, `${this.id}-distribution`, {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      defaultRootObject: 'index.html',
      domainNames: this.props.domainName ? [this.props.domainName] : undefined,
      certificate: this.props.domainName ? this.certificate : undefined,
    })

    if (this.props.domainName) {
      new ARecord(this, `${this.id}-a-record`, {
        zone: this.hostedZone,
        recordName: this.props.domainName,
        target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
      })
    }

    // Upload CSS file to bucket
    new BucketDeployment(this, `${this.id}-file-upload`, {
      sources: [Source.asset(path.join(__dirname, '../src/site'))],
      destinationBucket: this.bucket,
      prune: false,
      logRetention: RetentionDays.ONE_WEEK,
    })

    new CfnOutput(this, `${this.id}-url`, {
      description: 'Distribution URL',
      value: this.distribution.distributionDomainName,
    })

    if (this.props.domainName) {
      new CfnOutput(this, `${this.id}-custom-url`, {
        description: 'Custom Domain URL',
        value: `https://${this.props.domainName}`,
      })
    }
  }

  private createStepFunction() {
    // SSM Parameter to store the current site status
    const paramId = `${this.id}-status-param`
    const siteStatusParam = new StringParameter(this, paramId, {
      parameterName: paramId,
      stringValue: 'Initial value',
      description: `Current status of the weather site for ${this.stackName}`,
    })

    const connection = new Connection(this, `${this.id}-connection`, {
      description: `Connection to OpenWeatherMap API for ${this.id}`,
      connectionName: `${this.id}`,
      authorization: Authorization.apiKey(
        'weather-site-authorization',
        SecretValue.secretsManager('weather-site-api-key'),
      ),
      queryStringParameters: {
        appid: HttpParameter.fromSecret(
          SecretValue.secretsManager('weather-site-api-key'),
        ),
      },
    })

    const updateSiteLogGroupId = `${this.id}-updateSiteLogGroup`
    const updateSiteLogGroup = new LogGroup(this, updateSiteLogGroupId, {
      logGroupName: updateSiteLogGroupId,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    })
    const updateSiteFuncId = `${this.id}-updateSiteFunction`
    const updateSiteFunction = new NodejsFunction(this, updateSiteFuncId, {
      functionName: updateSiteFuncId,
      runtime: Runtime.NODEJS_22_X,
      entry: 'dist/src/functions/update-site.js',
      loggingFormat: LoggingFormat.JSON,
      logGroup: updateSiteLogGroup,
      tracing: Tracing.ACTIVE,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(30),
      memorySize: 3008,
      environment: {
        BUCKET_NAME: this.bucket.bucketName,
        LOCATION_NAME: this.props.locationName,
        OPEN_WEATHER_URL: this.props.openWeatherUrl,
        WEATHER_TYPE: this.props.weatherType,
      },
    })
    this.bucket.grantWrite(updateSiteFunction)

    // Tasks for Step Function Definition
    const getSiteStatus = new CallAwsService(this, 'Get site status', {
      queryLanguage: QueryLanguage.JSONATA,
      service: 'ssm',
      action: 'getParameter',
      parameters: {
        Name: siteStatusParam.parameterName,
      },
      iamResources: [siteStatusParam.parameterArn],
      assign: {
        SiteStatus: '{% $states.result.Parameter.Value %}',
      },
      outputs: {},
    })

    // TODO: remove src/function/check-current-weather.ts
    // And other deps like @aws-sdk/client-secrets-manager
    const checkCurrentWeather = new HttpInvoke(this, 'Get Weather', {
      queryLanguage: QueryLanguage.JSONATA,
      apiRoot: `https://api.openweathermap.org`,
      apiEndpoint: TaskInput.fromText('data/3.0/onecall'),
      connection,
      headers: TaskInput.fromObject({ 'Content-Type': 'application/json' }),
      method: TaskInput.fromText('GET'),
      queryStringParameters: TaskInput.fromObject({
        units: 'imperial',
        exclude: 'minutely,hourly,daily,alerts',
        lat: '{% $states.context.Execution.Input.WEATHER_LOCATION_LAT %}',
        lon: '{% $states.context.Execution.Input.WEATHER_LOCATION_LON %}',
      }),
      outputs: {},
      assign: {
        CurrentWeather:
          '{% $contains($lowercase($states.result.ResponseBody.current.weather[0].main), $states.context.Execution.Input.WEATHER_TYPE) ?  $states.context.Execution.Input.WEATHER_TYPE : "no " & $states.context.Execution.Input.WEATHER_TYPE %}',
      },
    })
    checkCurrentWeather.addRetry({
      errors: [Errors.ALL],
      maxAttempts: 3,
      interval: Duration.seconds(2),
      backoffRate: 2,
      jitterStrategy: JitterType.FULL,
    })

    const siteIsUpToDate = new Pass(this, 'Site is up to date', {
      queryLanguage: QueryLanguage.JSONATA,
      comment: 'The final state',
      outputs: {
        SiteStatus: '{% $CurrentWeather %}',
      },
    })

    const siteUpdateFailure = new Fail(this, 'Site update failure')

    const updateSite = new LambdaInvoke(this, 'Update site', {
      queryLanguage: QueryLanguage.JSONATA,
      lambdaFunction: updateSiteFunction,
      payload: TaskInput.fromObject({
        CurrentWeather: '{% $CurrentWeather %}',
      }),
      comment: 'Update site with new weather data ',
      outputs: {},
    })
    updateSite.addRetry({
      errors: [Errors.ALL],
      maxAttempts: 3,
      interval: Duration.seconds(2),
      backoffRate: 2,
      jitterStrategy: JitterType.FULL,
    })
    updateSite.addCatch(siteUpdateFailure)

    const finishUpdate = new Parallel(this, 'Finish update')
      .branch(
        new CallAwsService(this, 'Update site status parameter', {
          queryLanguage: QueryLanguage.JSONATA,
          service: 'ssm',
          action: 'putParameter',
          parameters: {
            Name: siteStatusParam.parameterName,
            Value: '{% $CurrentWeather %}',
            Overwrite: true,
          },
          iamResources: [siteStatusParam.parameterArn],
          outputs: {},
        }),
      )
      .branch(
        new CallAwsService(this, 'Invalidate CloudFront cache', {
          queryLanguage: QueryLanguage.JSONATA,
          service: 'cloudfront',
          action: 'createInvalidation',
          parameters: {
            DistributionId: this.distribution.distributionId,
            InvalidationBatch: {
              CallerReference: '{% $states.context.State.EnteredTime %}',
              Paths: {
                Quantity: 1,
                Items: ['/index.html'],
              },
            },
          },
          iamResources: [
            `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${this.distribution.distributionId}`,
          ],
          outputs: {},
        }),
      )
    finishUpdate.addCatch(siteUpdateFailure)
    updateSite.next(finishUpdate).next(siteIsUpToDate)

    const definition = getSiteStatus.next(checkCurrentWeather).next(
      new Choice(this, 'Is site up to date?', {
        queryLanguage: QueryLanguage.JSONATA,
      })
        .when(
          Condition.jsonata('{% $CurrentWeather = $SiteStatus %}'),
          siteIsUpToDate,
        )
        .otherwise(updateSite),
    )
    // End of Tasks for Step Function Definition
    const stateMachineId = `${this.id}-state-machine`
    this.stepFunction = new StateMachine(this, stateMachineId, {
      stateMachineType: StateMachineType.EXPRESS,
      stateMachineName: stateMachineId,
      tracingEnabled: true,
      logs: {
        destination: new LogGroup(this, `${this.id}-sf-log`, {
          logGroupName: `${this.id}-sf-log`,
          retention: RetentionDays.ONE_WEEK,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        includeExecutionData: true,
        // TODO: Consider setting to ERROR if there's a need to save $$$
        level: LogLevel.ALL,
      },
      definitionBody: DefinitionBody.fromChainable(definition),
    })
  }

  private addScheduler() {
    const target = new StepFunctionsStartExecution(this.stepFunction, {
      input: ScheduleTargetInput.fromObject({
        WEATHER_TYPE: this.props.weatherType.toLowerCase(),
        WEATHER_LOCATION_LAT: this.props.weatherLocationLat,
        WEATHER_LOCATION_LON: this.props.weatherLocationLon,
      }),
      maxEventAge: Duration.seconds(90),
      retryAttempts: 2,
    })

    // EventBridge Schedules to invoke the Step Function
    for (let i = 0; i < this.props.schedules.length; i++) {
      const scheduleId = `${this.id}-schedule-${i}`
      new Schedule(this, scheduleId, {
        scheduleName: scheduleId,
        schedule: ScheduleExpression.expression(
          this.props.schedules[i],
          TimeZone.AMERICA_LOS_ANGELES,
        ),
        target,
        description: `Invoke Step Function for ${this.id}`,
      })
    }
  }
}
